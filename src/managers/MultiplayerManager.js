/**
 * MultiplayerManager - 管理所有多人遊戲相關邏輯
 * 包括網絡同步、幽靈敵人、對手塔、狀態同步等
 */
import SocketService from '../services/SocketService.js';
import Tower from '../entities/Tower.js';
import Enemy from '../entities/Enemy.js';

export default class MultiplayerManager {
  constructor(scene) {
    this.scene = scene;
    this.remoteEnemiesById = new Map();
    this.localEnemiesById = new Map();
    this.stateSyncInterval = null;
    this.lastStateBroadcastHadEnemies = false;
    this.lastGhostLogTime = 0;
    this.nextTowerId = 1;
    this.nextEnemyId = 1;
  }

  // #region 網絡事件監聽

  setupOpponentListeners() {
    SocketService.off('opponent-built-tower');
    SocketService.on('opponent-built-tower', (data) => this.handleOpponentBuild(data));

    SocketService.off('opponent-upgraded-tower');
    SocketService.on('opponent-upgraded-tower', (data) => this.handleOpponentUpgrade(data));

    SocketService.off('opponent-removed-tower');
    SocketService.on('opponent-removed-tower', (data) => this.handleOpponentRemoveTower(data));

    SocketService.off('opponent-life-update');
    SocketService.on('opponent-life-update', (data) => this.handleOpponentLifeUpdate(data));

    SocketService.off('opponent-defeated');
    SocketService.on('opponent-defeated', () => this.handleOpponentDefeated());

    SocketService.off('opponent-disconnected');
    SocketService.on('opponent-disconnected', () => this.handleOpponentDisconnected());

    SocketService.off('wave-start');
    SocketService.on('wave-start', (data) => this.handleWaveStartEvent(data));

    SocketService.off('enemy-spawn');
    SocketService.on('enemy-spawn', (data) => this.handleEnemySpawnNetwork(data));

    SocketService.off('enemy-died');
    SocketService.on('enemy-died', (data) => this.handleEnemyRemovedNetwork(data, 'dead'));

    SocketService.off('enemy-escaped');
    SocketService.on('enemy-escaped', (data) => this.handleEnemyRemovedNetwork(data, 'escaped'));

    // 接收完整狀態同步（用於校正和防止失焦問題）
    SocketService.off('game-state-update');
    SocketService.on('game-state-update', (data) => this.handleGameStateUpdate(data));
  }

  // #endregion

  // #region 處理對手行為

  handleOpponentBuild(data) {
    if (!data || !this.scene.opponentAreaRect) return;
    if (data.towerId && this.scene.towerById.has(data.towerId)) return;

    const worldX = this.scene.opponentAreaRect.x + data.x;
    const worldY = data.y;
    const tower = new Tower(this.scene, worldX, worldY, data.towerType);
    tower.markAsOpponent();
    if (data.towerId) {
      tower.networkId = data.towerId;
      this.scene.towerById.set(data.towerId, tower);
    }

    // 如果有等級資訊，升級塔到對應等級
    if (data.level && data.level > 1) {
      for (let i = 1; i < data.level; i++) {
        tower.upgrade();
      }
    }

    this.scene.opponentTowers.push(tower);
    this.scene.towers.push(tower);
    this.scene.effectManager.createBuildEffect(worldX, worldY, tower.config.color);
  }

  handleOpponentUpgrade(data) {
    if (!data || !data.towerId) return;
    const tower = this.scene.towerById.get(data.towerId);
    if (!tower || !tower.isRemote) return;
    tower.upgrade();
    this.scene.effectManager.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);
  }

  handleOpponentRemoveTower(data) {
    if (!data || !data.towerId) return;
    const tower = this.scene.towerById.get(data.towerId);
    if (!tower) return;

    // 從所有列表中移除塔
    this.scene.opponentTowers = this.scene.opponentTowers.filter(t => t !== tower);
    this.scene.towers = this.scene.towers.filter(t => t !== tower);
    this.scene.towerById.delete(data.towerId);

    // 銷毀塔
    tower.destroy();
  }

  handleOpponentLifeUpdate(data) {
    if (!data || typeof data.lives !== 'number') return;
    this.scene.opponentLives = data.lives;
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.opponentLivesText) {
      uiManager.opponentLivesText.setText(`對手 ❤️ ${this.scene.opponentLives}`);
    }
  }

  handleOpponentDefeated() {
    if (this.scene.matchEnded) return;
    this.endMultiplayerMatch({
      victory: true,
      title: '🎉 你獲得勝利！',
      subtitle: '對手的防線已被突破。'
    });
  }

  handleOpponentDisconnected() {
    if (this.scene.matchEnded) return;
    this.endMultiplayerMatch({
      victory: true,
      title: '⚠️ 對手已離線',
      subtitle: '本局自動判定為勝利。'
    });
  }

  handleWaveStartEvent(data) {
    if (this.scene.matchEnded || this.scene.isGameOver) return;
    if (this.scene.playerNumber === 1) return; // Host drives waves locally
    const waveNumber = typeof data?.wave === 'number' ? data.wave : null;
    if (this.scene.startWave) {
      this.scene.startWave({ fromNetwork: true, waveNumber });
    }
  }

  // #endregion

  // #region 狀態同步機制

  startStateSyncBroadcast() {
    console.log(`[狀態同步] Player ${this.scene.playerNumber} 開始廣播遊戲狀態`);
    if (this.stateSyncInterval) {
      clearInterval(this.stateSyncInterval);
    }

    this.stateSyncInterval = setInterval(() => {
      if (this.scene.matchEnded || this.scene.isGameOver || !this.scene.roomId) {
        this.stopStateSyncBroadcast();
        return;
      }
      this.broadcastGameState();
    }, 150); // 約 6-7 FPS 的同步頻率，兼顧流暢與效能
  }

  stopStateSyncBroadcast() {
    if (this.stateSyncInterval) {
      clearInterval(this.stateSyncInterval);
      this.stateSyncInterval = null;
    }
    this.lastStateBroadcastHadEnemies = false;
  }

  broadcastGameState() {
    if (!SocketService.socket || !this.scene.roomId) return;

    // 收集所有本地敵人的狀態
    const enemiesState = this.scene.enemies
      .filter(enemy => enemy.active && enemy.owner === 'self' && enemy.enemyId)
      .map(enemy => {
        // 計算路徑進度 (0-1)
        const pathProgress = enemy.path && enemy.path.length > 0
          ? (enemy.pathIndex || 0) / enemy.path.length
          : 0;

        return {
          id: enemy.enemyId,
          pathProgress: pathProgress,
          pathIndex: enemy.pathIndex || 0,
          healthPercent: enemy.health / enemy.maxHealth,
          x: enemy.x,
          y: enemy.y,
          isBoss: enemy.isBoss || false
        };
      });

    const hasEnemies = enemiesState.length > 0;
    if (!hasEnemies && !this.lastStateBroadcastHadEnemies) {
      return;
    }

    console.log(`[廣播] Player ${this.scene.playerNumber} 廣播狀態: ${enemiesState.length} 個敵人`);
    SocketService.emit('game-state-sync', {
      roomId: this.scene.roomId,
      enemies: enemiesState,
      timestamp: Date.now()
    });
    this.lastStateBroadcastHadEnemies = hasEnemies;
  }

  handleGameStateUpdate(data) {
    if (!data || !data.enemies) return;
    if (this.scene.matchEnded || this.scene.isGameOver) return;

    const senderId = data.ownerId || null;
    const localId = this.scene.localPlayerId || SocketService.socket?.id || null;
    if (senderId && localId && senderId === localId) {
      console.log('[接收狀態] 忽略自己的廣播');
      return;
    }
    if (senderId && this.scene.opponentPlayerId && senderId !== this.scene.opponentPlayerId) {
      console.log('[接收狀態] 發送者不是對手，忽略');
      return;
    }

    console.log(`[接收狀態] Player ${this.scene.playerNumber} 收到 ${data.enemies.length} 個敵人的狀態更新`);
    console.log(`[接收狀態] 當前幽靈敵人數量: ${this.remoteEnemiesById.size}`);

    // 更新幽靈敵人的狀態
    let updatedCount = 0;
    data.enemies.forEach(enemyState => {
      const ghost = this.remoteEnemiesById.get(enemyState.id);
      if (!ghost || !ghost.active) {
        console.log(`[接收狀態] 找不到幽靈敵人: ${enemyState.id}`);
        return;
      }

      ghost.hasNetworkSync = true;
      ghost.lastSyncTime = Date.now();

      // 更新位置（使用插值平滑移動）
      if (enemyState.x !== undefined && enemyState.y !== undefined) {
        ghost.targetX = enemyState.x;
        ghost.targetY = enemyState.y;
        updatedCount++;
      }

      // 更新血量
      if (enemyState.healthPercent !== undefined && ghost.healthBar) {
        const targetWidth = ghost.maxHealthWidth * enemyState.healthPercent;
        const clampedWidth = Phaser.Math.Clamp(targetWidth, 0, ghost.maxHealthWidth);
        ghost.healthBar.width = clampedWidth;
        ghost.healthBar.displayWidth = clampedWidth;
      }

      // 更新路徑進度（用於精確同步）
      if (enemyState.pathProgress !== undefined) {
        ghost.pathProgress = enemyState.pathProgress;
      }
      if (enemyState.pathIndex !== undefined && Array.isArray(ghost.path)) {
        const nextIndex = Phaser.Math.Clamp(enemyState.pathIndex, 0, ghost.path.length - 1);
        ghost.targetIndex = nextIndex;
      }
    });

    console.log(`[接收狀態] 成功更新 ${updatedCount} 個幽靈敵人`);

    // 移除不存在的幽靈敵人（可能因為網絡延遲或失焦導致的）
    const activeEnemyIds = new Set(data.enemies.map(e => e.id));
    const ghostsToRemove = [];
    this.remoteEnemiesById.forEach((ghost, id) => {
      if (!activeEnemyIds.has(id)) {
        ghostsToRemove.push(id);
      }
    });
    ghostsToRemove.forEach(id => {
      const ghost = this.remoteEnemiesById.get(id);
      if (ghost) {
        this.remoteEnemiesById.delete(id);
        this.fadeOutGhostEnemy(ghost, 'dead');
      }
    });
  }

  // #endregion

  // #region 敵人網絡事件處理

  spawnLocalEnemy({ isBoss = false } = {}) {
    if (this.scene.matchEnded) return;
    const path = this.scene.gameMode === 'multiplayer' ? this.scene.playerPath : this.scene.path;
    if (!path || path.length === 0) return;
    const enemy = new Enemy(this.scene, path, this.scene.wave, isBoss);
    enemy.owner = 'self';
    const enemyId = this.createEnemyNetworkId();
    enemy.enemyId = enemyId;
    this.scene.enemies.push(enemy);
    this.localEnemiesById.set(enemyId, enemy);

    if (this.scene.gameMode === 'multiplayer' && SocketService.socket && this.scene.roomId) {
      const payload = {
        roomId: this.scene.roomId,
        enemyId,
        wave: this.scene.wave,
        isBoss,
        emoji: enemy.visualEmoji,
        ownerId: this.scene.localPlayerId || SocketService.socket.id
      };
      console.log('[敵人生成] 發送敵人生成事件:', payload);
      SocketService.emit('enemy-spawn', payload);
    }

    return enemy;
  }

  handleEnemySpawnNetwork(data) {
    console.log('[敵人生成] 收到對手敵人生成事件:', data);
    if (this.scene.matchEnded || this.scene.isGameOver) {
      console.log('[敵人生成] 遊戲已結束，忽略');
      return;
    }
    if (!data || !data.enemyId) {
      console.log('[敵人生成] 數據無效');
      return;
    }
    const socketId = this.scene.localPlayerId || SocketService.socket?.id;
    if (data.ownerId && data.ownerId === socketId) {
      console.log('[敵人生成] 是自己的敵人，忽略');
      return;
    }
    if (!this.scene.opponentPath || this.scene.opponentPath.length === 0) {
      console.log('[敵人生成] 對手路徑不存在');
      return;
    }
    if (this.remoteEnemiesById.has(data.enemyId)) {
      console.log('[敵人生成] 敵人已存在，忽略');
      return;
    }

    const ghost = this.createGhostEnemy({
      enemyId: data.enemyId,
      wave: data.wave || this.scene.wave,
      isBoss: !!data.isBoss,
      emoji: data.emoji
    });

    if (ghost) {
      this.remoteEnemiesById.set(data.enemyId, ghost);
      console.log('[敵人生成] 幽靈敵人創建成功:', ghost.id, '總數:', this.remoteEnemiesById.size);
    } else {
      console.log('[敵人生成] 幽靈敵人創建失敗');
    }
  }

  handleEnemyRemovedNetwork(data, cause) {
    if (!data || !data.enemyId) return;
    const ghost = this.remoteEnemiesById.get(data.enemyId);
    if (!ghost) return;
    this.remoteEnemiesById.delete(data.enemyId);
    this.fadeOutGhostEnemy(ghost, cause);
  }

  onEnemyDied(enemy) {
    if (enemy.enemyId && this.localEnemiesById.has(enemy.enemyId)) {
      this.localEnemiesById.delete(enemy.enemyId);
    }

    if (this.scene.gameMode === 'multiplayer' && !this.scene.matchEnded && enemy.owner !== 'opponent' && enemy.enemyId && SocketService.socket && this.scene.roomId) {
      SocketService.emit('enemy-died', {
        roomId: this.scene.roomId,
        enemyId: enemy.enemyId,
        ownerId: this.scene.localPlayerId || SocketService.id
      });
    }
  }

  onEnemyEscaped(enemy) {
    if (enemy.enemyId && this.localEnemiesById.has(enemy.enemyId)) {
      this.localEnemiesById.delete(enemy.enemyId);
    }
    if (this.scene.gameMode === 'multiplayer' && !this.scene.matchEnded && enemy.owner !== 'opponent' && enemy.enemyId && SocketService.socket && this.scene.roomId) {
      SocketService.emit('enemy-escaped', {
        roomId: this.scene.roomId,
        enemyId: enemy.enemyId,
        ownerId: this.scene.localPlayerId || SocketService.id
      });
    }
  }

  // #endregion

  // #region 幽靈敵人系統

  createGhostEnemy({ enemyId, wave = 1, isBoss = false, emoji = null }) {
    if (!this.scene.opponentPath || this.scene.opponentPath.length === 0) return null;
    const startPoint = this.scene.opponentPath[0];
    const fontSize = isBoss ? '96px' : '28px';
    const chosenEmoji = emoji || (isBoss ? '🐲' : '👾');
    const sprite = this.scene.add.text(startPoint.x, startPoint.y, chosenEmoji, {
      fontSize,
      color: '#FFFFFF'
    }).setOrigin(0.5);
    sprite.setDepth(52);
    sprite.setAlpha(0.6);

    const healthWidth = isBoss ? 160 : 40;
    const offsetY = isBoss ? 70 : 20;
    const healthBarLeftX = startPoint.x - (healthWidth / 2);
    const healthBarBg = this.scene.add.rectangle(healthBarLeftX, startPoint.y - offsetY, healthWidth, 6, 0x000000);
    const healthBar = this.scene.add.rectangle(healthBarLeftX, startPoint.y - offsetY, healthWidth, 6, 0xFF6B6B);
    healthBarBg.setDepth(52).setAlpha(0.4).setOrigin(0, 0.5);
    healthBarBg.displayWidth = healthWidth;
    healthBarBg.width = healthWidth;
    healthBar.setDepth(53).setAlpha(0.7).setOrigin(0, 0.5);
    healthBar.displayWidth = healthWidth;
    healthBar.width = healthWidth;

    const ghost = {
      id: enemyId,
      wave,
      isBoss,
      emoji: chosenEmoji,
      sprite,
      healthBar,
      healthBarBg,
      maxHealthWidth: healthWidth, // 儲存最大血量寬度用於狀態同步
      path: this.scene.opponentPath,
      x: startPoint.x,
      y: startPoint.y,
      targetX: startPoint.x,
      targetY: startPoint.y,
      hasNetworkSync: false,
      targetIndex: 1,
      pathProgress: 0, // 路徑進度（0-1）
      speed: 50 + (wave * 2),
      active: true,
      lastSyncTime: 0
    };

    return ghost;
  }

  moveGhostEnemy(ghost, delta) {
    if (!ghost.active) return;
    if (ghost.targetIndex >= ghost.path.length) {
      this.handleGhostReachEnd(ghost);
      return;
    }

    const target = ghost.path[ghost.targetIndex];
    const dx = target.x - ghost.x;
    const dy = target.y - ghost.y;
    const distance = Math.hypot(dx, dy);
    const moveDistance = ghost.speed * (delta / 1000);

    if (distance <= moveDistance) {
      ghost.x = target.x;
      ghost.y = target.y;
      ghost.targetIndex += 1;
    } else {
      const angle = Math.atan2(dy, dx);
      ghost.x += Math.cos(angle) * moveDistance;
      ghost.y += Math.sin(angle) * moveDistance;
    }

    this.positionGhostVisuals(ghost);

    if (ghost.targetIndex >= ghost.path.length) {
      this.handleGhostReachEnd(ghost);
    }
  }

  handleGhostReachEnd(ghost) {
    if (!ghost.active) return;
    ghost.active = false;
    this.remoteEnemiesById.delete(ghost.id);
    this.fadeOutGhostEnemy(ghost, 'escaped');
  }

  fadeOutGhostEnemy(ghost, cause = 'dead') {
    ghost.active = false;
    const elements = [ghost.sprite, ghost.healthBar, ghost.healthBarBg].filter(Boolean);
    if (elements.length > 0) {
      this.scene.tweens.add({
        targets: elements,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          elements.forEach(element => element.destroy());
        }
      });
    }

    if (cause === 'dead' && this.scene.effectManager) {
      this.scene.effectManager.createHitEffect(ghost.x, ghost.y, 0xFFFFFF);
    }
  }

  destroyGhostVisuals(ghost) {
    if (ghost.sprite && ghost.sprite.destroy) ghost.sprite.destroy();
    if (ghost.healthBar && ghost.healthBar.destroy) ghost.healthBar.destroy();
    if (ghost.healthBarBg && ghost.healthBarBg.destroy) ghost.healthBarBg.destroy();
  }

  positionGhostVisuals(ghost) {
    if (!ghost) return;
    const offsetY = ghost.isBoss ? 70 : 20;
    const leftX = ghost.x - (ghost.maxHealthWidth / 2);
    if (ghost.healthBarBg && ghost.healthBarBg.setPosition) {
      ghost.healthBarBg.setPosition(leftX, ghost.y - offsetY);
    }
    if (ghost.healthBar && ghost.healthBar.setPosition) {
      ghost.healthBar.setPosition(leftX, ghost.y - offsetY);
    }
    if (ghost.sprite && ghost.sprite.setPosition) {
      ghost.sprite.setPosition(ghost.x, ghost.y);
    }
  }

  updateGhostEnemies(delta) {
    if (!this.remoteEnemiesById || this.remoteEnemiesById.size === 0) return;
    let activeCount = 0;
    let movingCount = 0;
    this.remoteEnemiesById.forEach(ghost => {
      if (ghost && ghost.active) {
        const hasNetworkTarget = ghost.targetX !== undefined && ghost.targetY !== undefined;
        const hasRecentSync = hasNetworkTarget && ghost.lastSyncTime && (Date.now() - ghost.lastSyncTime) < 360;
        const prevX = ghost.x;
        const prevY = ghost.y;

        if (hasRecentSync) {
          const lerpFactor = Phaser.Math.Clamp(delta / 160, 0.2, 0.55);
          ghost.x = Phaser.Math.Linear(ghost.x, ghost.targetX, lerpFactor);
          ghost.y = Phaser.Math.Linear(ghost.y, ghost.targetY, lerpFactor);
          this.positionGhostVisuals(ghost);
        } else {
          this.moveGhostEnemy(ghost, delta);
        }

        if (Math.abs(prevX - ghost.x) > 0.1 || Math.abs(prevY - ghost.y) > 0.1) {
          movingCount++;
        }
        activeCount++;
      }
    });
    // 每 2 秒打印一次幽靈敵人狀態（更頻繁的 debug）
    if (!this.lastGhostLogTime || Date.now() - this.lastGhostLogTime > 2000) {
      if (activeCount > 0) {
        console.log(`[幽靈敵人] Player ${this.scene.playerNumber}: ${activeCount} 個活躍, ${movingCount} 個正在移動`);
      }
      this.lastGhostLogTime = Date.now();
    }
  }

  // #endregion

  // #region 工具方法

  createTowerNetworkId() {
    const socketId = SocketService.socket ? SocketService.socket.id : `player${this.scene.playerNumber || 0}`;
    return `${socketId}-${this.nextTowerId++}`;
  }

  createEnemyNetworkId() {
    const socketId = SocketService.socket ? SocketService.socket.id : `player${this.scene.playerNumber || 0}`;
    return `${socketId}-E${this.nextEnemyId++}`;
  }

  // #endregion

  // #region 遊戲結束

  endMultiplayerMatch({ victory, title, subtitle = '', notifyOpponent = false } = {}) {
    if (this.scene.matchEnded) return;
    const activeRoomId = this.scene.roomId;
    this.scene.matchEnded = true;
    this.scene.isGameOver = true;
    if (this.scene.waveTimerEvent) {
      this.scene.waveTimerEvent.remove(false);
      this.scene.waveTimerEvent = null;
    }
    if (notifyOpponent && SocketService.socket && activeRoomId) {
      SocketService.emit('player-defeated', { roomId: activeRoomId });
    }
    this.scene.roomId = null;
    this.localEnemiesById.clear();
    this.remoteEnemiesById.forEach(ghost => this.destroyGhostVisuals(ghost));
    this.remoteEnemiesById.clear();

    const overlayColor = 0x000000;
    const titleColor = victory ? '#2ECC71' : '#FF4444';
    const buttonColor = victory ? 0x2ECC71 : 0x4CAF50;
    const secondaryButtonColor = 0x34495E;

    const centerX = this.scene.cameras.main.width / 2;
    const centerY = this.scene.cameras.main.height / 2;

    const overlay = this.scene.add.rectangle(centerX, centerY, this.scene.cameras.main.width, this.scene.cameras.main.height, overlayColor, 0.75).setDepth(400);
    const titleText = this.scene.add.text(centerX, centerY - 100, title || (victory ? '你獲勝了！' : '你已經失敗'), {
      fontSize: '48px',
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(401);

    if (subtitle) {
      const subtitleText = this.scene.add.text(centerX, centerY - 40, subtitle, {
        fontSize: '20px',
        color: '#FFFFFF',
        fontStyle: 'normal',
        stroke: '#000000',
        strokeThickness: 3,
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setDepth(401);
    }

    const backButton = this.scene.add.rectangle(centerX, centerY + 50, 200, 50, secondaryButtonColor).setDepth(401).setInteractive();
    const backButtonText = this.scene.add.text(centerX, centerY + 50, '返回主選單', {
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(402);

    backButton.on('pointerover', () => backButton.setFillStyle(0x5D6D7E));
    backButton.on('pointerout', () => backButton.setFillStyle(secondaryButtonColor));
    backButton.on('pointerdown', () => {
      this.scene.scene.start('MenuScene');
    });

    this.scene.multiplayerResultOverlay = {
      overlay, titleText, backButton, backButtonText
    };
  }

  // #endregion

  // #region 清理

  cleanup() {
    this.stopStateSyncBroadcast();
    this.localEnemiesById.clear();
    this.remoteEnemiesById.forEach(ghost => this.destroyGhostVisuals(ghost));
    this.remoteEnemiesById.clear();
  }

  // #endregion
}
