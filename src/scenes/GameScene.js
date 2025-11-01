import Tower from '../entities/Tower.js';
import Enemy from '../entities/Enemy.js';
import { TowerConfig, TowerTypes, canCraftTower, canCraftThreeTowers } from '../config/towerConfig.js';
import SocketService from '../services/SocketService.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // #region Initialization
  init(data) {
    this.gameMode = data.mode || 'singlePlayer';
    this.playerNumber = null;
    this.roomId = null;
    this.gold = 500;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.towers = [];
    this.playerTowers = [];
    this.opponentTowers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedTower = null;
    this.selectedTowerObject = null;
    this.previewTower = null;
    this.playerMapBounds = null;
    this.opponentMapBounds = null;
    this.playerBuildBounds = null;
    this.opponentBuildBounds = null;
    this.playerAreaRect = null;
    this.opponentAreaRect = null;
    this.path = [];
    this.playerPath = null;
    this.opponentPath = null;
    this.craftMode = false;
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;
    this.bossDefeated = false;
    this.bonusEnemiesPerWave = 0;
    this.pathCollisionRadius = 45;
    this.isGameOver = false;
    this.upgradePanel = null;
    this.tooltip = null;
    this.waveTimerEvent = null;
    this.matchStarted = false;
    this.matchEnded = false;
    this.waitingForOpponent = false;
    this.matchStatusText = null;
    this.localPlayerId = null;
    this.opponentPlayerId = null;
    this.opponentLives = 20;
    this.opponentLivesText = null;
    this.nextTowerId = 1;
    this.towerById = new Map();
    this.multiplayerResultOverlay = null;
    this.queueForMatchHandler = null;
    this.nextEnemyId = 1;
    this.localEnemiesById = new Map();
    this.remoteEnemiesById = new Map();
    this.stateSyncInterval = null;
    this.lastStateBroadcastHadEnemies = false;
  }

  preload() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xFFFFFF);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();
  }
  // #endregion

  // #region Scene Create
  create(data) {
    this.cameras.main.setBackgroundColor('#A8D54F');

    if (this.gameMode === 'singlePlayer') {
      this.initializeSinglePlayerGame();
      this.scheduleNextWave(10000);
    } else {
      this.initializeMultiplayerGame();
    }

    this.input.on('pointerdown', (pointer) => this.handleMapClick(pointer));
    this.input.on('pointermove', (pointer) => this.handleMouseMove(pointer));

    this.events.once('shutdown', this.onSceneShutdown, this);
    this.events.once('destroy', this.onSceneShutdown, this);
  }

  initializeSinglePlayerGame() {
    this.createLayout();
    this.createPath();
    this.createBuildableAreas();
    this.createUI();
    this.playerPath = this.path;
    this.playerBuildBounds = this.mapBounds;
  }

  initializeMultiplayerGame() {
    this.matchStatusText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '正在連線到伺服器...', {
      fontSize: '32px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 10, y: 10 }
    }).setOrigin(0.5).setDepth(500);
    this.waitingForOpponent = true;

    SocketService.connect();

    const queueForMatch = () => {
      SocketService.emit('queue-player');
    };
    this.queueForMatchHandler = queueForMatch;

    if (SocketService.socket && SocketService.socket.connected) {
      queueForMatch();
    } else if (SocketService.socket) {
      SocketService.socket.once('connect', queueForMatch);
    }

    SocketService.off('waiting-for-opponent');
    SocketService.on('waiting-for-opponent', () => {
      this.waitingForOpponent = true;
      if (this.matchStatusText) {
        this.matchStatusText.setText('正在等待對手加入...');
      }
    });

    SocketService.off('game-start');
    SocketService.on('game-start', (data) => {
      if (this.matchStatusText) {
        this.matchStatusText.destroy();
        this.matchStatusText = null;
      }
      this.waitingForOpponent = false;
      this.matchStarted = true;
      this.matchEnded = false;

      this.playerNumber = data.playerNumber;
      this.roomId = data.roomId;
      this.opponentPlayerId = data.opponentId || null;
      this.localPlayerId = SocketService.socket ? SocketService.socket.id : null;
      this.opponentLives = 20;
      
      const player1Area = new Phaser.Geom.Rectangle(0, 0, 600, 500);
      const player2Area = new Phaser.Geom.Rectangle(600, 0, 600, 500);
      
      if (this.playerNumber === 1) {
        this.playerAreaRect = player1Area;
        this.opponentAreaRect = player2Area;
      } else {
        this.playerAreaRect = player2Area;
        this.opponentAreaRect = player1Area;
      }

      this.playerMapBounds = this.playerAreaRect;
      this.opponentMapBounds = this.opponentAreaRect;

      this.createMultiplayerLayout();
      this.playerPath = this.createMultiplayerPath(this.playerAreaRect);
      this.opponentPath = this.createMultiplayerPath(this.opponentAreaRect);
      this.createMultiplayerUI();
      if (this.hintText) {
        this.hintText.setText('💡 對戰開始！建造防線');
      }

      this.setupOpponentListeners();
      this.showMessage('⚔️ 對戰開始！5 秒後開啟第一波', 0xFFD700);
      this.startStateSyncBroadcast();
      if (this.playerNumber === 1) {
        this.hostScheduleNextWave(5000);
      }
    });
  }

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

  handleOpponentBuild(data) {
    console.log('[建造] 收到對手建造塔事件:', data);
    if (!data || !this.opponentAreaRect) return;
    if (data.towerId && this.towerById.has(data.towerId)) {
      console.log(`[建造] 警告：塔 ID ${data.towerId} 已存在，跳過建造`);
      return;
    }

    const worldX = this.opponentAreaRect.x + data.x;
    const worldY = data.y;
    const tower = new Tower(this, worldX, worldY, data.towerType);
    tower.markAsOpponent();
    if (data.towerId) {
      tower.networkId = data.towerId;
      this.towerById.set(data.towerId, tower);
      console.log(`[建造] 對手塔已建造，ID: ${data.towerId}，類型: ${data.towerType}，等級: ${data.level || 1}`);
    }

    // 如果有等級資訊，升級塔到對應等級
    if (data.level && data.level > 1) {
      for (let i = 1; i < data.level; i++) {
        tower.upgrade();
      }
    }

    this.opponentTowers.push(tower);
    this.towers.push(tower);
    console.log(`[建造] 當前對手塔數量: ${this.opponentTowers.length}，所有塔 ID:`, Array.from(this.towerById.keys()));
    this.createBuildEffect(worldX, worldY, tower.config.color);
  }

  handleOpponentUpgrade(data) {
    if (!data || !data.towerId) return;
    const tower = this.towerById.get(data.towerId);
    if (!tower || !tower.isRemote) return;
    tower.upgrade();
    this.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);
  }

  handleOpponentRemoveTower(data) {
    console.log('[接收] 收到移除塔事件:', data);
    if (!data || !data.towerId) {
      console.log('[接收] 錯誤：缺少塔 ID');
      return;
    }
    const tower = this.towerById.get(data.towerId);
    if (!tower) {
      console.log(`[接收] 錯誤：找不到塔 ID ${data.towerId}，現有塔 ID:`, Array.from(this.towerById.keys()));
      return;
    }

    console.log(`[接收] 成功移除對手的塔 ID: ${data.towerId}`);
    // 從所有列表中移除塔
    this.opponentTowers = this.opponentTowers.filter(t => t !== tower);
    this.towers = this.towers.filter(t => t !== tower);
    this.towerById.delete(data.towerId);

    // 銷毀塔
    tower.destroy();
  }

  handleOpponentLifeUpdate(data) {
    if (!data || typeof data.lives !== 'number') return;
    this.opponentLives = data.lives;
    if (this.opponentLivesText) {
      this.opponentLivesText.setText(`對手 ❤️ ${this.opponentLives}`);
    }
  }

  handleOpponentDefeated() {
    if (this.matchEnded) return;
    this.endMultiplayerMatch({
      victory: true,
      title: '🎉 你獲得勝利！',
      subtitle: '對手的防線已被突破。'
    });
  }

  handleOpponentDisconnected() {
    if (this.matchEnded) return;
    this.endMultiplayerMatch({
      victory: true,
      title: '⚠️ 對手已離線',
      subtitle: '本局自動判定為勝利。'
    });
  }

  handleWaveStartEvent(data) {
    if (this.matchEnded || this.isGameOver) return;
    if (this.playerNumber === 1) return; // Host drives waves locally
    const waveNumber = typeof data?.wave === 'number' ? data.wave : null;
    this.startWave({ fromNetwork: true, waveNumber });
  }

  // ===== 狀態同步機制 (解決失焦問題) =====
  startStateSyncBroadcast() {
    console.log(`[狀態同步] Player ${this.playerNumber} 開始廣播遊戲狀態`);
    if (this.stateSyncInterval) {
      clearInterval(this.stateSyncInterval);
    }

    this.stateSyncInterval = setInterval(() => {
      if (this.matchEnded || this.isGameOver || !this.roomId) {
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
    if (!SocketService.socket || !this.roomId) return;

    // 收集所有本地敵人的狀態
    const enemiesState = this.enemies
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

    console.log(`[廣播] Player ${this.playerNumber} 廣播狀態: ${enemiesState.length} 個敵人`);
    SocketService.emit('game-state-sync', {
      roomId: this.roomId,
      enemies: enemiesState,
      timestamp: Date.now()
    });
    this.lastStateBroadcastHadEnemies = hasEnemies;
  }

  handleGameStateUpdate(data) {
    if (!data || !data.enemies) return;
    if (this.matchEnded || this.isGameOver) return;

    const senderId = data.ownerId || null;
    const localId = this.localPlayerId || SocketService.socket?.id || null;
    if (senderId && localId && senderId === localId) {
      console.log('[接收狀態] 忽略自己的廣播');
      return;
    }
    if (senderId && this.opponentPlayerId && senderId !== this.opponentPlayerId) {
      console.log('[接收狀態] 發送者不是對手，忽略');
      return;
    }

    console.log(`[接收狀態] Player ${this.playerNumber} 收到 ${data.enemies.length} 個敵人的狀態更新`);
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

  spawnLocalEnemy({ isBoss = false } = {}) {
    if (this.matchEnded) return;
    const path = this.gameMode === 'multiplayer' ? this.playerPath : this.path;
    if (!path || path.length === 0) return;
    const enemy = new Enemy(this, path, this.wave, isBoss);
    enemy.owner = 'self';
    const enemyId = this.createEnemyNetworkId();
    enemy.enemyId = enemyId;
    this.enemies.push(enemy);
    this.localEnemiesById.set(enemyId, enemy);

    if (this.gameMode === 'multiplayer' && SocketService.socket && this.roomId) {
      const payload = {
        roomId: this.roomId,
        enemyId,
        wave: this.wave,
        isBoss,
        emoji: enemy.visualEmoji,
        ownerId: this.localPlayerId || SocketService.socket.id
      };
      console.log('[敵人生成] 發送敵人生成事件:', payload);
      SocketService.emit('enemy-spawn', payload);
    }

    return enemy;
  }

  handleEnemySpawnNetwork(data) {
    console.log('[敵人生成] 收到對手敵人生成事件:', data);
    if (this.matchEnded || this.isGameOver) {
      console.log('[敵人生成] 遊戲已結束，忽略');
      return;
    }
    if (!data || !data.enemyId) {
      console.log('[敵人生成] 數據無效');
      return;
    }
    const socketId = this.localPlayerId || SocketService.socket?.id;
    if (data.ownerId && data.ownerId === socketId) {
      console.log('[敵人生成] 是自己的敵人，忽略');
      return;
    }
    if (!this.opponentPath || this.opponentPath.length === 0) {
      console.log('[敵人生成] 對手路徑不存在');
      return;
    }
    if (this.remoteEnemiesById.has(data.enemyId)) {
      console.log('[敵人生成] 敵人已存在，忽略');
      return;
    }

    const ghost = this.createGhostEnemy({
      enemyId: data.enemyId,
      wave: data.wave || this.wave,
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

  createGhostEnemy({ enemyId, wave = 1, isBoss = false, emoji = null }) {
    if (!this.opponentPath || this.opponentPath.length === 0) return null;
    const startPoint = this.opponentPath[0];
    const fontSize = isBoss ? '96px' : '28px';
    const chosenEmoji = emoji || (isBoss ? '🐲' : '👾');
    const sprite = this.add.text(startPoint.x, startPoint.y, chosenEmoji, {
      fontSize,
      color: '#FFFFFF'
    }).setOrigin(0.5);
    sprite.setDepth(52);
    sprite.setAlpha(0.6);

    const healthWidth = isBoss ? 160 : 40;
    const offsetY = isBoss ? 70 : 20;
    const healthBarLeftX = startPoint.x - (healthWidth / 2);
    const healthBarBg = this.add.rectangle(healthBarLeftX, startPoint.y - offsetY, healthWidth, 6, 0x000000);
    const healthBar = this.add.rectangle(healthBarLeftX, startPoint.y - offsetY, healthWidth, 6, 0xFF6B6B);
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
      path: this.opponentPath,
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
      this.tweens.add({
        targets: elements,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          elements.forEach(element => element.destroy());
        }
      });
    }

    if (cause === 'dead') {
      this.createHitEffect(ghost.x, ghost.y, 0xFFFFFF);
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
        console.log(`[幽靈敵人] Player ${this.playerNumber}: ${activeCount} 個活躍, ${movingCount} 個正在移動`);
      }
      this.lastGhostLogTime = Date.now();
    }
  }

  onEnemyDied(enemy) {
    if (enemy.enemyId && this.localEnemiesById.has(enemy.enemyId)) {
      this.localEnemiesById.delete(enemy.enemyId);
    }
    if (this.gameMode === 'multiplayer' && !this.matchEnded && enemy.owner !== 'opponent' && enemy.enemyId && SocketService.socket && this.roomId) {
      SocketService.emit('enemy-died', {
        roomId: this.roomId,
        enemyId: enemy.enemyId,
        ownerId: this.localPlayerId || SocketService.id
      });
    }
  }

  onEnemyEscaped(enemy) {
    if (enemy.enemyId && this.localEnemiesById.has(enemy.enemyId)) {
      this.localEnemiesById.delete(enemy.enemyId);
    }
    if (this.gameMode === 'multiplayer' && !this.matchEnded && enemy.owner !== 'opponent' && enemy.enemyId && SocketService.socket && this.roomId) {
      SocketService.emit('enemy-escaped', {
        roomId: this.roomId,
        enemyId: enemy.enemyId,
        ownerId: this.localPlayerId || SocketService.id
      });
    }
  }

  createTowerNetworkId() {
    const socketId = SocketService.socket ? SocketService.socket.id : `player${this.playerNumber || 0}`;
    return `${socketId}-${this.nextTowerId++}`;
  }

  createEnemyNetworkId() {
    const socketId = SocketService.socket ? SocketService.socket.id : `player${this.playerNumber || 0}`;
    return `${socketId}-E${this.nextEnemyId++}`;
  }

  endMultiplayerMatch({ victory, title, subtitle = '', notifyOpponent = false } = {}) {
    if (this.matchEnded) return;
    const activeRoomId = this.roomId;
    this.matchEnded = true;
    this.isGameOver = true;
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
    if (notifyOpponent && SocketService.socket && activeRoomId) {
      SocketService.emit('player-defeated', { roomId: activeRoomId });
    }
    this.roomId = null;
    this.localEnemiesById.clear();
    this.remoteEnemiesById.forEach(ghost => this.destroyGhostVisuals(ghost));
    this.remoteEnemiesById.clear();

    const overlayColor = 0x000000;
    const titleColor = victory ? '#2ECC71' : '#FF4444';
    const buttonColor = victory ? 0x2ECC71 : 0x4CAF50;
    const secondaryButtonColor = 0x34495E;

    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    const overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, overlayColor, 0.75).setDepth(400);
    const titleText = this.add.text(centerX, centerY - 100, title || (victory ? '你獲勝了！' : '你已經失敗'), {
      fontSize: '48px',
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(401);

    const subtitleText = this.add.text(centerX, centerY - 40, subtitle, {
      fontSize: '24px',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 640 },
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setDepth(401);

    const primaryButton = this.add.rectangle(centerX, centerY + 40, 240, 60, buttonColor)
      .setStrokeStyle(3, 0xFFFFFF)
      .setInteractive({ useHandCursor: true })
      .setDepth(401);
    const primaryLabel = this.add.text(centerX, centerY + 40, victory ? '返回主選單' : '重新開始配對', {
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(402);

    primaryButton.on('pointerover', () => primaryButton.setFillStyle(victory ? 0x3DFF8C : 0x5CD660));
    primaryButton.on('pointerout', () => primaryButton.setFillStyle(buttonColor));
    primaryButton.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });

    const secondaryButton = this.add.rectangle(centerX, centerY + 120, 240, 50, secondaryButtonColor)
      .setStrokeStyle(2, 0xFFFFFF)
      .setInteractive({ useHandCursor: true })
      .setDepth(401);
    const secondaryLabel = this.add.text(centerX, centerY + 120, '再玩一場', {
      fontSize: '20px',
      color: '#FFFFFF',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(402);

    secondaryButton.on('pointerover', () => secondaryButton.setFillStyle(0x2C3E50));
    secondaryButton.on('pointerout', () => secondaryButton.setFillStyle(secondaryButtonColor));
    secondaryButton.on('pointerdown', () => {
      this.scene.restart({ mode: 'multiplayer' });
    });

    this.multiplayerResultOverlay = {
      overlay,
      titleText,
      subtitleText,
      primaryButton,
      primaryLabel,
      secondaryButton,
      secondaryLabel
    };
  }

  onSceneShutdown() {
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
    // 停止狀態同步
    this.stopStateSyncBroadcast();
    this.towerById.clear();
    this.multiplayerResultOverlay = null;
    if (this.queueForMatchHandler && SocketService.socket) {
      SocketService.off('connect', this.queueForMatchHandler);
      this.queueForMatchHandler = null;
    }
    this.remoteEnemiesById.forEach(ghost => this.destroyGhostVisuals(ghost));
    this.remoteEnemiesById.clear();
    this.localEnemiesById.clear();
    if (this.gameMode === 'multiplayer') {
      SocketService.off('waiting-for-opponent');
      SocketService.off('game-start');
      SocketService.off('opponent-built-tower');
      SocketService.off('opponent-upgraded-tower');
      SocketService.off('opponent-removed-tower');
      SocketService.off('opponent-life-update');
      SocketService.off('opponent-defeated');
      SocketService.off('opponent-disconnected');
      SocketService.off('wave-start');
      SocketService.off('enemy-spawn');
      SocketService.off('enemy-died');
      SocketService.off('enemy-escaped');
      SocketService.off('game-state-update');
    }
  }
  // #endregion

  // #region Layout & UI Creation
  createMultiplayerLayout() {
    if (!this.playerAreaRect || !this.opponentAreaRect) return;

    this.add.rectangle(0, 0, 1200, 500, 0xBCE95A, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(4, 0x000000, 1)
      .setDepth(1);

    const graphics = this.add.graphics();
    graphics.setDepth(2);
    graphics.fillStyle(0xC9F270, 0.65);

    const buildInset = 24;
    const cornerRadius = 24;

    const playerBuildRect = new Phaser.Geom.Rectangle(
      this.playerAreaRect.x + buildInset,
      this.playerAreaRect.y + buildInset,
      this.playerAreaRect.width - buildInset * 2,
      this.playerAreaRect.height - buildInset * 2
    );

    const opponentBuildRect = new Phaser.Geom.Rectangle(
      this.opponentAreaRect.x + buildInset,
      this.opponentAreaRect.y + buildInset,
      this.opponentAreaRect.width - buildInset * 2,
      this.opponentAreaRect.height - buildInset * 2
    );

    graphics.fillRoundedRect(playerBuildRect.x, playerBuildRect.y, playerBuildRect.width, playerBuildRect.height, cornerRadius);
    graphics.fillRoundedRect(opponentBuildRect.x, opponentBuildRect.y, opponentBuildRect.width, opponentBuildRect.height, cornerRadius);

    graphics.lineStyle(3, 0x000000, 0.85);
    graphics.strokeRoundedRect(playerBuildRect.x, playerBuildRect.y, playerBuildRect.width, playerBuildRect.height, cornerRadius);
    graphics.strokeRoundedRect(opponentBuildRect.x, opponentBuildRect.y, opponentBuildRect.width, opponentBuildRect.height, cornerRadius);

    const divider = this.add.graphics();
    divider.setDepth(3);
    divider.lineStyle(4, 0x000000, 0.5);
    divider.lineBetween(600, 0, 600, 500);

    this.add.rectangle(0, 500, 1200, 100, 0xF5F5F5)
      .setOrigin(0)
      .setStrokeStyle(4, 0x000000)
      .setDepth(50);

    this.playerBuildBounds = {
      left: playerBuildRect.x + 12,
      right: playerBuildRect.right - 12,
      top: playerBuildRect.y + 12,
      bottom: playerBuildRect.bottom - 12
    };

    this.opponentBuildBounds = {
      left: opponentBuildRect.x + 12,
      right: opponentBuildRect.right - 12,
      top: opponentBuildRect.y + 12,
      bottom: opponentBuildRect.bottom - 12
    };
  }

  createMultiplayerPath(areaRect) {
    const padding = 70;
    const innerLeft = areaRect.x + padding;
    const innerRight = areaRect.right - padding;
    const innerTop = areaRect.y + padding;
    const innerBottom = areaRect.bottom - padding;
    const midYUpper = Phaser.Math.Linear(innerTop, innerBottom, 0.34);
    const midYLower = Phaser.Math.Linear(innerTop, innerBottom, 0.67);
    const innerRightInset = innerRight - 120;
    const innerLeftInset = innerLeft + 120;

    const waypoints = [
      new Phaser.Math.Vector2(innerLeft, innerTop),
      new Phaser.Math.Vector2(innerRight, innerTop),
      new Phaser.Math.Vector2(innerRight, innerBottom),
      new Phaser.Math.Vector2(innerLeft, innerBottom),
      new Phaser.Math.Vector2(innerLeft, midYUpper),
      new Phaser.Math.Vector2(innerRightInset, midYUpper),
      new Phaser.Math.Vector2(innerRightInset, midYLower),
      new Phaser.Math.Vector2(innerLeftInset, midYLower)
    ];

    const path = new Phaser.Curves.Path(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      path.lineTo(waypoints[i].x, waypoints[i].y);
    }

    const sampledPoints = path.getPoints(220);
    const isPlayerArea = this.playerAreaRect && areaRect.x === this.playerAreaRect.x;

    return this.renderStylizedPath(sampledPoints, {
      pathWidth: 50,
      baseWidth: 84,
      waveAmplitude: 6,
      waveFrequency: 0.35,
      startLabel: isPlayerArea ? '出怪' : '對手出怪',
      endLabel: isPlayerArea ? '出口' : '對手出口',
      arrowColor: 0xFFFFFF
    });
  }

  renderStylizedPath(sampledPoints, {
    pathWidth = 60,
    baseWidth = 100,
    baseColor = 0xA8D74E,
    pathColor = 0xFFFFFF,
    edgeColor = 0xFFFFFF,
    waveAmplitude = 8,
    waveFrequency = 0.25,
    startLabel = '出怪',
    endLabel = '出口',
    arrowColor = 0xFFFFFF,
    depthBase = 3,
    depthPath = 4,
    depthEdge = 4
  } = {}) {
    const halfPath = pathWidth / 2;
    this.pathCollisionRadius = Math.max(this.pathCollisionRadius || 0, halfPath + waveAmplitude);

    const baseGraphics = this.add.graphics();
    baseGraphics.setDepth(depthBase);
    baseGraphics.lineStyle(baseWidth, baseColor, 1, 'round', 'round');
    baseGraphics.strokePoints(sampledPoints, false);

    const pathGraphics = this.add.graphics();
    pathGraphics.setDepth(depthPath);
    pathGraphics.lineStyle(pathWidth, pathColor, 1, 'round', 'round');
    pathGraphics.strokePoints(sampledPoints, false);

    const edgeGraphics = this.add.graphics();
    edgeGraphics.setDepth(depthEdge);
    edgeGraphics.fillStyle(edgeColor, 1);

    const addWave = (pointIndex) => {
      const current = sampledPoints[pointIndex];
      const prev = sampledPoints[Math.max(pointIndex - 1, 0)];
      const next = sampledPoints[Math.min(pointIndex + 1, sampledPoints.length - 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const nx = -dy;
      const ny = dx;
      const wave = Math.sin(pointIndex * waveFrequency) * waveAmplitude * 0.6;
      const offset = halfPath + wave;
      const radius = waveAmplitude + 2;

      edgeGraphics.fillCircle(
        current.x + nx * offset,
        current.y + ny * offset,
        radius
      );

      edgeGraphics.fillCircle(
        current.x - nx * offset,
        current.y - ny * offset,
        radius
      );
    };

    for (let i = 0; i < sampledPoints.length - 1; i += 3) {
      addWave(i);
    }
    addWave(sampledPoints.length - 1);

    const pathPoints = sampledPoints.map(point => ({ x: point.x, y: point.y }));

    if (sampledPoints.length > 1) {
      const startPoint = pathPoints[0];
      const startDirection = Math.atan2(
        pathPoints[1].y - startPoint.y,
        pathPoints[1].x - startPoint.x
      );
      const startCircle = this.add.circle(startPoint.x, startPoint.y, 34, 0x000000, 1);
      startCircle.setStrokeStyle(6, 0xFFFFFF);
      startCircle.setDepth(5);
      this.drawArrow(startPoint.x, startPoint.y, startDirection, arrowColor, 6);
      this.add.text(startPoint.x, startPoint.y + 46, startLabel, {
        fontSize: '14px',
        color: '#FFFFFF',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6);

      const endPoint = pathPoints[pathPoints.length - 1];
      const endDirection = Math.atan2(
        endPoint.y - pathPoints[pathPoints.length - 2].y,
        endPoint.x - pathPoints[pathPoints.length - 2].x
      );
      const endCircle = this.add.circle(endPoint.x, endPoint.y, 34, 0x000000, 1);
      endCircle.setStrokeStyle(6, 0xFFFFFF);
      endCircle.setDepth(5);
      this.drawArrow(endPoint.x, endPoint.y, endDirection, arrowColor, 6);
      this.add.text(endPoint.x, endPoint.y + 46, endLabel, {
        fontSize: '14px',
        color: '#FFFFFF',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6);
    }

    return pathPoints;
  }

  createMultiplayerUI() {
    // 添加底部 UI 背景條
    const uiBar = this.add.rectangle(0, 500, 1200, 100, 0xF5F5F5, 0.95)
      .setOrigin(0, 0)
      .setDepth(100)
      .setStrokeStyle(3, 0x000000, 1);

    // 基礎資訊顯示
    this.waveText = this.add.text(20, 515, `🌊 波數: ${this.wave}`, {
      fontSize: '18px',
      color: '#3498DB',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      padding: { x: 8, y: 5 }
    }).setDepth(101);

    this.goldText = this.add.text(20, 545, `💰 ${this.gold}`, {
      fontSize: '20px',
      color: '#F39C12',
      fontStyle: 'bold',
      padding: { x: 8, y: 5 },
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(101);

    this.livesText = this.add.text(180, 545, `❤️ ${this.lives}`, {
      fontSize: '20px',
      color: '#E74C3C',
      fontStyle: 'bold',
      padding: { x: 8, y: 5 },
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(101);

    this.opponentLivesText = this.add.text(1180, 530, `對手 ❤️ ${this.opponentLives}`, {
      fontSize: '18px',
      color: '#D35400',
      fontStyle: 'bold',
      align: 'right',
      stroke: '#000000',
      strokeThickness: 2,
      padding: { x: 8, y: 5 }
    }).setOrigin(1, 0.5).setDepth(101);

    // 基礎塔按鈕
    const towerTypes = [TowerTypes.ARROW, TowerTypes.FIRE, TowerTypes.ICE, TowerTypes.MAGIC];
    towerTypes.forEach((type, index) => {
      const x = 320 + index * 110;
      const y = 550;
      this.createTowerButton(x, y, type, 60);
    });

    // 合成按鈕
    const craftButton = this.add.rectangle(780, 550, 60, 60, 0xB565D8)
      .setStrokeStyle(3, 0x000000)
      .setInteractive({ useHandCursor: true });
    craftButton.setDepth(101);

    const craftIcon = this.add.text(780, 540, '🔨', {
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    const craftLabel = this.add.text(780, 565, '合成', {
      fontSize: '10px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    craftButton.on('pointerdown', () => this.toggleCraftMode());
    craftButton.on('pointerover', () => {
      craftButton.setFillStyle(0xC67EE8);
      craftButton.setScale(1.05);
      craftIcon.setScale(1.05);
      craftLabel.setScale(1.05);
    });
    craftButton.on('pointerout', () => {
      craftButton.setFillStyle(0xB565D8);
      craftButton.setScale(1);
      craftIcon.setScale(1);
      craftLabel.setScale(1);
    });

    this.hintText = this.add.text(950, 540, '💡 選擇基礎塔建造\n或點擊🔨進入合成模式', {
      fontSize: '14px',
      color: '#333333',
      padding: { x: 12, y: 8 },
      stroke: '#FFFFFF',
      strokeThickness: 3,
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(101);
  }

  createLayout() {
    const mapBg = this.add.rectangle(220, 0, 980, 600, 0xBCE95A, 1);
    mapBg.setOrigin(0, 0);
    mapBg.setStrokeStyle(4, 0x000000, 1);
    mapBg.setDepth(1);

    const leftPanel = this.add.rectangle(0, 0, 220, 600, 0xF5F5F5, 1);
    leftPanel.setOrigin(0, 0);
    leftPanel.setStrokeStyle(3, 0x000000);
    leftPanel.setDepth(100);

    const title = this.add.text(110, 20, '資訊及功能區', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 2, y: 4 }
    }).setOrigin(0.5);
    title.setDepth(101);

    const divider = this.add.graphics();
    divider.lineStyle(3, 0x000000, 1);
    divider.lineBetween(220, 0, 220, 600);
    divider.setDepth(100);

    const mapTitle = this.add.text(240, 20, '地圖區', {
      fontSize: '18px',
      color: '#1B1B1B',
      fontStyle: 'bold'
    }).setOrigin(0, 0);
    mapTitle.setDepth(102);
  }

  createPath() {
    const pathWidth = 60;
    const baseWidth = pathWidth + 40;
    const halfPath = pathWidth / 2;
    const waveAmplitude = 8;
    const waveFrequency = 0.25;

    this.pathCollisionRadius = halfPath + waveAmplitude;

    const waypoints = [
      new Phaser.Math.Vector2(310, 90),
      new Phaser.Math.Vector2(1110, 90),
      new Phaser.Math.Vector2(1110, 510),
      new Phaser.Math.Vector2(310, 510),
      new Phaser.Math.Vector2(310, 230),
      new Phaser.Math.Vector2(970, 230),
      new Phaser.Math.Vector2(970, 370),
      new Phaser.Math.Vector2(450, 370)
    ];

    const path = new Phaser.Curves.Path(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      path.lineTo(waypoints[i].x, waypoints[i].y);
    }

    const sampledPoints = path.getPoints(320);
    this.path = this.renderStylizedPath(sampledPoints, {
      pathWidth,
      baseWidth,
      waveAmplitude,
      waveFrequency,
      startLabel: '出怪',
      endLabel: '出口',
      arrowColor: 0xFFFFFF
    });
  }

  createBuildableAreas() {
    const graphics = this.add.graphics();
    graphics.setDepth(2);
    graphics.fillStyle(0xC9F270, 0.6);
    graphics.fillRoundedRect(250, 40, 920, 520, 36);

    this.mapBounds = {
      left: 250,
      right: 1170,
      top: 40,
      bottom: 560
    };
  }

  createUI() {
    const panelX = 110;
    const panelWidth = 190;

    const resourceY = 60;
    const resourceTitle = this.add.text(panelX, resourceY, '📊 遊戲資源', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 4, y: 4 }
    }).setOrigin(0.5);
    resourceTitle.setDepth(101);

    const resourceBg = this.add.rectangle(panelX, resourceY + 70, panelWidth, 110, 0xFFFFFF, 1);
    resourceBg.setStrokeStyle(2, 0xCCCCCC);
    resourceBg.setDepth(100);

    const textStartX = 25;
    this.goldText = this.add.text(textStartX, resourceY + 25, `💰 金幣: ${this.gold}`, {
      fontSize: '15px',
      color: '#F39C12',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.goldText.setDepth(102);

    this.livesText = this.add.text(textStartX, resourceY + 50, `❤️ 生命: ${this.lives}`, {
      fontSize: '15px',
      color: '#E74C3C',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.livesText.setDepth(102);

    this.waveText = this.add.text(textStartX, resourceY + 75, `🌊 波數: ${this.wave}`, {
      fontSize: '15px',
      color: '#3498DB',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.waveText.setDepth(102);

    this.scoreText = this.add.text(textStartX, resourceY + 100, `⭐ 分數: ${this.score}`, {
      fontSize: '15px',
      color: '#9B59B6',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.scoreText.setDepth(102);

    const towerY = 210;
    const towerTitle = this.add.text(panelX, towerY, '🏰 基礎塔', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 4, y: 4 }
    }).setOrigin(0.5);
    towerTitle.setDepth(101);

    const buttonSize = 70;
    const buttonGap = 20;
    const rowSpacing = buttonSize + buttonGap;
    const columnOffset = (buttonSize + buttonGap) / 2;
    const buttonStartY = towerY + 70;
    const towerTypes = [
      TowerTypes.ARROW,
      TowerTypes.FIRE,
      TowerTypes.ICE,
      TowerTypes.MAGIC
    ];

    towerTypes.forEach((type, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = panelX + (col === 0 ? -columnOffset : columnOffset);
      const y = buttonStartY + row * rowSpacing;
      this.createTowerButton(x, y, type, buttonSize);
    });

    const cancelY = towerY + 230;
    const cancelButton = this.add.rectangle(panelX, cancelY, panelWidth - 10, 40, 0xFF6B6B)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    cancelButton.setDepth(101);

    this.add.text(panelX, cancelY, '❌ 取消選擇', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    cancelButton.on('pointerdown', () => this.cancelTowerSelection());
    cancelButton.on('pointerover', () => {
      cancelButton.setFillStyle(0xFF8E8E);
      cancelButton.setScale(1.05);
    });
    cancelButton.on('pointerout', () => {
      cancelButton.setFillStyle(0xFF6B6B);
      cancelButton.setScale(1);
    });

    const craftY = towerY + 280;
    const craftButton = this.add.rectangle(panelX, craftY, panelWidth - 10, 50, 0xB565D8)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    craftButton.setDepth(101);

    this.add.text(panelX, craftY, '🔨 合成塔', {
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    craftButton.on('pointerdown', () => this.toggleCraftMode());
    craftButton.on('pointerover', () => {
      craftButton.setFillStyle(0xC67EE8);
      craftButton.setScale(1.05);
    });
    craftButton.on('pointerout', () => {
      craftButton.setFillStyle(0xB565D8);
      craftButton.setScale(1);
    });

    const hintY = 555;
    const hintBg = this.add.rectangle(panelX, hintY, panelWidth, 60, 0xE8F5E9, 1);
    hintBg.setStrokeStyle(2, 0x4CAF50);
    hintBg.setDepth(100);

    this.hintText = this.add.text(panelX, hintY, '💡 選擇塔建造', {
      fontSize: '13px',
      color: '#333333',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 170 },
      padding: { x: 2, y: 2 }
    }).setOrigin(0.5);
    this.hintText.setDepth(102);
  }
  // #endregion

  // #region Core Game Logic & Interaction
  handleMapClick(pointer) {
    if (this.gameMode === 'singlePlayer' && pointer.x < 220) return;

    // 多人模式：忽略底部 UI 區域的點擊（y >= 500）
    if (this.gameMode === 'multiplayer' && pointer.y >= 500) return;

    const clickedTower = this.playerTowers.find(tower => Phaser.Math.Distance.Between(pointer.x, pointer.y, tower.x, tower.y) < 25);

    if (clickedTower) {
      if (this.craftMode) {
        this.selectTowerForCraft(clickedTower);
      } else {
        this.showTowerInfo(clickedTower);
      }
      return;
    }

    if (this.upgradePanel) {
      this.hideUpgradePanel();
      if (this.selectedTowerObject) {
        if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
          this.selectedTowerObject.hideRange();
        }
        this.selectedTowerObject = null;
      }
    }

    // 只有當玩家選擇了塔要建造時，才檢查區域限制
    if (this.selectedTower && !this.craftMode) {
      if (this.gameMode === 'multiplayer') {
        if (!this.playerMapBounds || !Phaser.Geom.Rectangle.Contains(this.playerMapBounds, pointer.x, pointer.y)) {
          this.showMessage('只能在自己的區域建造！', 0xFF0000);
          return;
        }
      }
      this.buildTower(pointer.x, pointer.y, this.selectedTower);
    }
  }

  buildTower(x, y, towerType) {
    if (this.gameMode === 'multiplayer') {
      if (this.matchEnded) {
        this.showMessage('⚔️ 對戰已結束，無法建造。', 0xFFA500);
        return;
      }
      if (!this.matchStarted) {
        this.showMessage('⌛ 正在等待對手加入，稍後再試！', 0xFFA500);
        return;
      }
    }

    const config = TowerConfig[towerType];
    if (this.gold < config.cost) {
      this.showMessage('💸 金幣不足！', 0xFF0000);
      return;
    }

    const placement = this.getPlacementStatus(x, y);
    if (!placement.valid) {
      this.showMessage(placement.reason, 0xFF0000);
      return;
    }

    const tower = new Tower(this, x, y, towerType);
    this.playerTowers.push(tower);
    this.towers.push(tower);

    let towerId = null;
    if (this.gameMode === 'multiplayer') {
      towerId = this.createTowerNetworkId();
      tower.networkId = towerId;
      this.towerById.set(towerId, tower);
    }

    this.gold -= config.cost;
    this.updateUI();

    this.selectedTower = null;
    if(this.hintText) this.hintText.setText(`✅ 建造成功
${config.emoji}
${config.name}`);
    
    if (this.previewTower) {
      Object.values(this.previewTower).forEach(p => p.destroy());
      this.previewTower = null;
    }
    this.createBuildEffect(x, y, config.color);

    if (this.gameMode === 'multiplayer') {
      const localX = x - this.playerMapBounds.x;
      const ownerId = this.localPlayerId || (SocketService.socket ? SocketService.socket.id : null);
      if (!this.localPlayerId && ownerId) this.localPlayerId = ownerId;
      if (SocketService.socket && this.roomId && towerId) {
        SocketService.emit('build-tower', {
          roomId: this.roomId,
          towerId,
          towerType,
          x: localX,
          y,
          ownerId
        });
      }
    }
  }

  getPlacementStatus(x, y) {
    const isSinglePlayer = this.gameMode === 'singlePlayer';
    const bounds = isSinglePlayer ? this.mapBounds : this.playerBuildBounds;
    const pathPoints = isSinglePlayer ? this.path : this.playerPath;
    const towers = isSinglePlayer ? this.towers : this.playerTowers;

    if (!bounds) {
      return { valid: true };
    }

    const margin = 12;
    if (x < bounds.left + margin || x > bounds.right - margin || y < bounds.top + margin || y > bounds.bottom - margin) {
      return { valid: false, reason: '🚧 超出可建造範圍！' };
    }

    if (pathPoints && this.isPointOnPath(x, y, pathPoints)) {
      return { valid: false, reason: '🚫 不能在路徑上建造！' };
    }

    const minDistance = 55;
    if (towers && towers.some(tower => Phaser.Math.Distance.Between(x, y, tower.x, tower.y) < minDistance)) {
      return { valid: false, reason: '⚠️ 塔太靠近了！' };
    }

    return { valid: true };
  }

  isPointOnPath(x, y, pathPoints, collisionRadius = null) {
    if (!pathPoints || pathPoints.length < 2) return false;
    const threshold = Math.max(30, (collisionRadius ?? this.pathCollisionRadius ?? 45) - 5);
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];
      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (distance < threshold) {
        return true;
      }
    }
    return false;
  }

  distanceToLineSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx;
    let yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  handleMouseMove(pointer) {
    if (this.gameMode === 'singlePlayer' && pointer.x < 220) {
        if (this.previewTower) {
            Object.values(this.previewTower).forEach(p => p.setVisible(false));
        }
        return;
    }
    if (!this.selectedTower || this.craftMode) {
        if (this.previewTower) {
            Object.values(this.previewTower).forEach(p => p.destroy());
            this.previewTower = null;
        }
        return;
    }

    let targetBounds = this.playerMapBounds;
    if (this.gameMode === 'multiplayer') {
        if (!targetBounds || !Phaser.Geom.Rectangle.Contains(targetBounds, pointer.x, pointer.y)) {
             if (this.previewTower) {
                Object.values(this.previewTower).forEach(p => p.setVisible(false));
            }
            return;
        }
    }

    if (this.previewTower && this.previewTower.circle && !this.previewTower.circle.visible) {
        Object.values(this.previewTower).forEach(p => p.setVisible(true));
    }

    const config = TowerConfig[this.selectedTower];
    const status = this.getPlacementStatus(pointer.x, pointer.y);
    const valid = status.valid;

    if (!this.previewTower) {
      this.previewTower = {
        circle: this.add.circle(pointer.x, pointer.y, 20, config.color, 0.5),
        range: this.add.circle(pointer.x, pointer.y, config.range, config.effectColor, 0.1).setStrokeStyle(2, config.effectColor, 0.3),
        dot: this.add.circle(pointer.x, pointer.y, 6, 0xFFFFFF, 1)
      };
      this.previewTower.range.setDepth(98);
      this.previewTower.circle.setDepth(99);
      this.previewTower.dot.setDepth(100);
      this.previewTower.dot.setStrokeStyle(2, 0x2ECC71, 0.6);
    } else {
      this.previewTower.circle.setPosition(pointer.x, pointer.y);
      this.previewTower.range.setPosition(pointer.x, pointer.y);
      this.previewTower.dot.setPosition(pointer.x, pointer.y);
    }

    this.previewTower.circle.setFillStyle(valid ? config.color : 0xE74C3C, valid ? 0.35 : 0.4);
    this.previewTower.range.setStrokeStyle(2, valid ? config.effectColor : 0xE74C3C, valid ? 0.35 : 0.7);
    this.previewTower.dot.setFillStyle(valid ? 0xFFFFFF : 0xFFCDD2, 1);
    this.previewTower.dot.setStrokeStyle(2, valid ? 0x2ECC71 : 0xC0392B, valid ? 0.7 : 0.9);
  }

  update(time, delta) {
    if (this.isGameOver) return;
    const auraBonus = this.getAuraBonus();

    // 在多人模式下，分別更新己方塔和對手塔
    if (this.gameMode === 'multiplayer') {
      // 己方塔攻擊己方敵人
      this.playerTowers.forEach(tower => tower.update(time, this.enemies, auraBonus));

      // 對手塔不參與實際攻擊邏輯（視覺由對手端處理）
      // this.opponentTowers.forEach(tower => {
      //   // 可以在這裡添加對手塔的視覺效果同步
      // });
    } else {
      // 單人模式：所有塔攻擊所有敵人
      this.towers.forEach(tower => tower.update(time, this.enemies, auraBonus));
    }

    this.enemies = this.enemies.filter(enemy => {
      if (enemy.active) {
        enemy.update(delta, auraBonus);
        return true;
      }
      return false;
    });
    this.updateProjectiles(delta);
    if (this.gameMode === 'multiplayer') {
      this.updateGhostEnemies(delta);
    }
  }
  
  updateUI() {
    if (this.gameMode === 'singlePlayer') {
        if (this.goldText) this.goldText.setText(`💰 金幣: ${this.gold}`);
        if (this.livesText) this.livesText.setText(`❤️ 生命: ${this.lives}`);
        if (this.waveText) this.waveText.setText(`🌊 波數: ${this.wave}`);
        if (this.scoreText) this.scoreText.setText(`⭐ 分數: ${this.score}`);
    } else {
        if (this.goldText) this.goldText.setText(`💰 ${this.gold}`);
        if (this.livesText) this.livesText.setText(`❤️ ${this.lives}`);
        if (this.waveText) this.waveText.setText(`🌊 波數: ${this.wave}`);
        if (this.opponentLivesText) this.opponentLivesText.setText(`對手 ❤️ ${this.opponentLives}`);
    }
  }
  // #endregion

  // #region Tower Interaction (Single Player)
  selectTowerForCraft(tower) {
    console.log(`[合成選擇] 選中塔，類型: ${tower.type}，networkId: ${tower.networkId || '無'}`);
    if (!this.craftTower1) {
      this.craftTower1 = tower;
      tower.showRange();
      this.hintText.setText(`🔨 已選第一座
${tower.config.emoji}
選第二座`);
    } else if (!this.craftTower2) {
      if (tower === this.craftTower1) {
        this.showMessage('❌ 不能選擇同一座塔！', 0xFF0000);
        this.hintText.setText(`⚠️ 請選擇
不同的塔
進行合成`);
        return;
      }
      this.craftTower2 = tower;
      tower.showRange();
      const twoTowerResult = canCraftTower(this.craftTower1.type, this.craftTower2.type);
      if (twoTowerResult) {
        this.attemptCraft();
      } else {
        this.hintText.setText(`🔨 已選兩座
${this.craftTower1.config.emoji}${this.craftTower2.config.emoji}
選第三座或重選`);
      }
    } else if (!this.craftTower3) {
      if (tower === this.craftTower1 || tower === this.craftTower2) {
        this.showMessage('❌ 不能選擇同一座塔！', 0xFF0000);
        return;
      }
      this.craftTower3 = tower;
      tower.showRange();
      this.attemptCraft();
    } else {
      this.clearCraftSelection();
      this.craftTower1 = tower;
      tower.showRange();
      this.hintText.setText(`🔨 已選第一座
${tower.config.emoji}
選第二座`);
    }
  }

  attemptCraft() {
    let newTowerType = null;
    let towersToRemove = [];
    let newX, newY;

    if (this.craftTower3) {
      newTowerType = canCraftThreeTowers(this.craftTower1.type, this.craftTower2.type, this.craftTower3.type);
      if (!newTowerType) {
        this.showMessage('❌ 這三座塔無法合成！', 0xFF0000);
        this.clearCraftSelection();
        return;
      }
      towersToRemove = [this.craftTower1, this.craftTower2, this.craftTower3];
      newX = this.craftTower2.x;
      newY = this.craftTower2.y;
    } else {
      newTowerType = canCraftTower(this.craftTower1.type, this.craftTower2.type);
      if (!newTowerType) {
        this.showMessage('❌ 這兩座塔無法合成！', 0xFF0000);
        this.clearCraftSelection();
        return;
      }
      towersToRemove = [this.craftTower1, this.craftTower2];
      newX = this.craftTower2.x;
      newY = this.craftTower2.y;
    }

    const newConfig = TowerConfig[newTowerType];
    let inheritLevel = Infinity;
    const towerIdsToRemove = [];
    towersToRemove.forEach(t => {
      if (t.sprite && t.sprite.active) t.hideRange();
      inheritLevel = Math.min(inheritLevel, t.level);
      if (t.networkId) {
        towerIdsToRemove.push(t.networkId);
        console.log(`[合成] 準備移除塔 ID: ${t.networkId}`);
      } else {
        console.log(`[合成] 警告：塔沒有 networkId`, t);
      }
    });

    // 在多人模式中，通知對手移除舊塔
    if (this.gameMode === 'multiplayer' && SocketService.socket && this.roomId) {
      console.log(`[合成] 發送移除塔事件，數量: ${towerIdsToRemove.length}`, towerIdsToRemove);
      towerIdsToRemove.forEach(towerId => {
        SocketService.emit('remove-tower', { roomId: this.roomId, towerId });
      });
    }

    this.playerTowers = this.playerTowers.filter(t => !towersToRemove.includes(t));
    this.towers = this.towers.filter(t => !towersToRemove.includes(t));
    towersToRemove.forEach(t => {
      if (t.networkId) this.towerById.delete(t.networkId);
      t.destroy();
    });

    const newTower = new Tower(this, newX, newY, newTowerType);
    this.playerTowers.push(newTower);
    this.towers.push(newTower);

    if (inheritLevel > 1) {
      for (let i = 1; i < inheritLevel; i++) newTower.upgrade();
    }

    // 在多人模式中，給新塔分配 ID 並通知對手
    if (this.gameMode === 'multiplayer' && SocketService.socket && this.roomId) {
      const towerId = this.createTowerNetworkId();
      newTower.networkId = towerId;
      this.towerById.set(towerId, newTower);
      console.log(`[合成] 新塔已建造，ID: ${towerId}，類型: ${newTowerType}，等級: ${inheritLevel}`);

      const relativeX = newX - (this.playerAreaRect ? this.playerAreaRect.x : 0);
      const buildData = {
        roomId: this.roomId,
        x: relativeX,
        y: newY,
        towerType: newTowerType,
        towerId: towerId,
        level: inheritLevel
      };
      console.log(`[合成] 發送新塔建造事件:`, buildData);
      SocketService.emit('build-tower', buildData);
    }

    this.createCraftEffect(newX, newY, newConfig.color);
    this.showMessage(`🎉 成功合成 ${newConfig.emoji} ${newConfig.name}！Lv.${inheritLevel}`, 0xFFD700);
    this.clearCraftSelection();
    this.craftMode = false;
    if (this.hintText) {
      const hintTextContent = this.gameMode === 'multiplayer'
        ? '💡 選擇基礎塔建造\n或點擊🔨進入合成模式'
        : `🎉 合成成功
${newConfig.emoji}
${newConfig.name}`;
      this.hintText.setText(hintTextContent);
    }
  }

  clearCraftSelection() {
    if (this.craftTower1 && this.craftTower1.sprite && this.craftTower1.sprite.active) this.craftTower1.hideRange();
    if (this.craftTower2 && this.craftTower2.sprite && this.craftTower2.sprite.active) this.craftTower2.hideRange();
    if (this.craftTower3 && this.craftTower3.sprite && this.craftTower3.sprite.active) this.craftTower3.hideRange();
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;
  }

  showTowerInfo(tower) {
    if (!tower || !tower.sprite || !tower.sprite.active) return;
    this.hideUpgradePanel();
    if (this.selectedTowerObject && this.selectedTowerObject !== tower) {
      if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
        this.selectedTowerObject.hideRange();
      }
    }
    this.selectedTowerObject = tower;
    tower.showRange();
    const info = tower.getInfo();
    this.hintText.setText(`📊 ${tower.config.emoji}
${info.name}
💥${info.damage} 📏${info.range}`);
    this.showUpgradePanel(tower);
  }

  showUpgradePanel(tower) {
    if (this.upgradePanel) this.hideUpgradePanel();

    const info = tower.getInfo();
    const upgradeCost = Math.floor(tower.config.cost * 0.6);
    const maxAllowedLevel = Math.floor(this.wave / 5);
    const isLevelCapped = tower.level >= maxAllowedLevel;
    const nextUnlockWave = (tower.level + 1) * 5;

    const panelX = tower.x;
    const panelY = tower.y - 80;
    const panelWidth = 160;
    const panelHeight = 130;
    const BASE_DEPTH = 200;

    this.upgradePanel = {};
    this.upgradePanel.bg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2C3E50, 0.95).setStrokeStyle(3, 0xFFD700).setDepth(BASE_DEPTH).setInteractive();
    this.upgradePanel.bg.on('pointerdown', (p) => p.event.stopPropagation());
    this.upgradePanel.title = this.add.text(panelX, panelY - 50, `${info.name}`, { fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);
    const levelText = isLevelCapped ? `等級: ${info.level} (上限)` : `等級: ${info.level}/${maxAllowedLevel}`;
    this.upgradePanel.level = this.add.text(panelX, panelY - 33, levelText, { fontSize: '12px', color: isLevelCapped ? '#FF6B6B' : '#FFD700' }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);
    if (isLevelCapped) {
      this.upgradePanel.levelHint = this.add.text(panelX, panelY - 18, `⏳ 第${nextUnlockWave}波解鎖`, { fontSize: '10px', color: '#FFA500' }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);
    }
    const statsText = `💥 ${Math.floor(info.damage)} | 📏 ${Math.floor(info.range)}`;
    this.upgradePanel.stats = this.add.text(panelX, panelY - 3, statsText, { fontSize: '11px', color: '#FFFFFF' }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    const buttonY = panelY + 25;
    const buttonColor = isLevelCapped ? 0x7F8C8D : 0x27AE60;
    this.upgradePanel.upgradeButton = this.add.rectangle(panelX, buttonY, 130, 35, buttonColor).setStrokeStyle(2, 0x000000).setInteractive({ useHandCursor: true }).setDepth(BASE_DEPTH + 2);
    const buttonText = isLevelCapped ? `🔒 已達上限` : `⬆️ 升級 ($${upgradeCost})`;
    this.upgradePanel.upgradeText = this.add.text(panelX, buttonY, buttonText, { fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setDepth(BASE_DEPTH + 3);

    if (!isLevelCapped) {
      this.upgradePanel.upgradeButton.on('pointerdown', (p) => { p.event.stopPropagation(); this.upgradeTower(tower, upgradeCost); });
      this.upgradePanel.upgradeButton.on('pointerover', () => { if(this.upgradePanel) { this.upgradePanel.upgradeButton.setFillStyle(0x2ECC71).setScale(1.05); } });
      this.upgradePanel.upgradeButton.on('pointerout', () => { if(this.upgradePanel) { this.upgradePanel.upgradeButton.setFillStyle(0x27AE60).setScale(1); } });
    } else {
      this.upgradePanel.upgradeButton.on('pointerdown', (p) => { p.event.stopPropagation(); this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升級！`, 0xFFA500); });
    }

    const closeY = panelY + 55;
    this.upgradePanel.closeButton = this.add.rectangle(panelX, closeY, 60, 25, 0xE74C3C).setStrokeStyle(2, 0x000000).setInteractive({ useHandCursor: true }).setDepth(BASE_DEPTH + 4);
    this.upgradePanel.closeText = this.add.text(panelX, closeY, '❌ 關閉', { fontSize: '11px', color: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setDepth(BASE_DEPTH + 5).setInteractive({ useHandCursor: true });
    
    const closeAction = (p) => {
        p.event.stopPropagation();
        const selected = this.selectedTowerObject;
        this.hideUpgradePanel();
        if (selected && selected.sprite && selected.sprite.active) {
            selected.hideRange();
        }
        this.selectedTowerObject = null;
    };
    this.upgradePanel.closeButton.on('pointerdown', closeAction);
    this.upgradePanel.closeText.on('pointerdown', closeAction);
    this.upgradePanel.closeButton.on('pointerover', () => { if(this.upgradePanel) this.upgradePanel.closeButton.setFillStyle(0xC0392B); });
    this.upgradePanel.closeButton.on('pointerout', () => { if(this.upgradePanel) this.upgradePanel.closeButton.setFillStyle(0xE74C3C); });
  }

  hideUpgradePanel() {
    if (this.upgradePanel) {
      Object.values(this.upgradePanel).forEach(obj => {
        if (obj && obj.destroy) {
          if (obj.removeAllListeners) obj.removeAllListeners();
          obj.destroy();
        }
      });
      this.upgradePanel = null;
    }
  }

  upgradeTower(tower, cost) {
    const maxAllowedLevel = Math.floor(this.wave / 5);
    if (tower.level >= maxAllowedLevel) {
      const nextUnlockWave = (tower.level + 1) * 5;
      this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升到${tower.level + 1}級！`, 0xFFA500);
      return;
    }
    if (this.gold < cost) {
      this.showMessage('💸 金幣不足，無法升級！', 0xFF0000);
      return;
    }
    this.gold -= cost;
    this.updateUI();
    tower.upgrade();
    if (this.gameMode === 'multiplayer' && tower.networkId && SocketService.socket && this.roomId) {
      SocketService.emit('upgrade-tower', { roomId: this.roomId, towerId: tower.networkId });
    }
    this.showMessage(`✨ ${tower.config.emoji} 升級成功！`, 0xFFD700);
    this.hideUpgradePanel();
    this.showUpgradePanel(tower);
    this.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);
  }
  // #endregion

  // #region All Other Helper Functions
  createTowerButton(x, y, towerType, size = 70) {
    const config = TowerConfig[towerType];
    const button = this.add.rectangle(x, y, size, size, config.color).setStrokeStyle(3, 0x000000).setInteractive();
    button.setDepth(101);

    const emojiSize = this.gameMode === 'singlePlayer' ? '26px' : `${size/2.5}px`;
    // 多人模式: 降低 icon 位置 (從 size/3 改為 size/6，讓 y 值更大 = 更靠下)
    const emojiY = this.gameMode === 'singlePlayer' ? y - 10 : y - (size/6);
    const emoji = this.add.text(x, emojiY, config.emoji, { fontSize: emojiSize }).setOrigin(0.5);
    emoji.setDepth(102);

    const costY = this.gameMode === 'singlePlayer' ? y + 20 : y + (size/3.5);
    const costSize = this.gameMode === 'singlePlayer' ? '13px' : `${size/5}px`;
    const costText = this.add.text(x, costY, `$${config.cost}`, { fontSize: costSize, color: '#FFD700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5);
    costText.setDepth(102);
    
    button.on('pointerdown', () => this.selectTower(towerType));
    button.on('pointerover', () => {
      button.setStrokeStyle(4, 0xFFFF00);
      button.setScale(1.1);
      if (this.gameMode === 'singlePlayer') this.showTowerTooltip(config, x + 80, y);
    });
    button.on('pointerout', () => {
      button.setStrokeStyle(3, 0x000000);
      button.setScale(1);
      if (this.gameMode === 'singlePlayer') this.hideTooltip();
    });
  }

  showTowerTooltip(config, x, y) {
    if (this.tooltip) this.tooltip.destroy();
    const text = `${config.name}
💰${config.cost} 💥${config.damage}
📏${config.range}
${config.description}`;
    this.tooltip = this.add.text(x, y, text, { fontSize: '12px', color: '#FFFFFF', backgroundColor: '#1a1a1a', padding: { x: 8, y: 6 }, fontStyle: 'bold', align: 'left' }).setOrigin(0, 0.5).setDepth(300);
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  selectTower(towerType) {
    this.selectedTower = towerType;
    const config = TowerConfig[towerType];
    if (this.gold < config.cost) {
      this.showMessage('💸 金幣不足！', 0xFF0000);
      return;
    }
    if (this.hintText) {
        if (this.gameMode === 'singlePlayer') {
            this.hintText.setText(`✅ 已選擇
${config.emoji} ${config.name}
點擊地圖建造`);
        } else {
            this.hintText.setText(`✅ 已選擇: ${config.emoji}`);
        }
    }
  }

  cancelTowerSelection() {
    this.selectedTower = null;
    if (this.hintText) this.hintText.setText('💡 選擇塔建造');
    this.hideUpgradePanel();
    if (this.selectedTowerObject) {
      if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
        this.selectedTowerObject.hideRange();
      }
      this.selectedTowerObject = null;
    }
    if (this.craftMode) {
      this.craftMode = false;
      this.clearCraftSelection();
    }
  }

  toggleCraftMode() {
    this.craftMode = !this.craftMode;
    this.clearCraftSelection();
    if (this.craftMode) {
      const hintTextContent = this.gameMode === 'multiplayer'
        ? '🔨 合成模式\n點擊已建造的2-3座塔進行合成'
        : `🔨 合成模式
點擊2-3座塔
進行合成`;
      this.hintText.setText(hintTextContent);
      this.showMessage('🔨 合成模式：選擇2-3座塔合成', 0xB565D8);
    } else {
      const hintTextContent = this.gameMode === 'multiplayer'
        ? '💡 選擇基礎塔建造\n或點擊🔨進入合成模式'
        : `💡 退出
合成模式`;
      this.hintText.setText(hintTextContent);
      this.showMessage('退出合成模式', 0x888888);
    }
  }

  scheduleNextWave(delay = 10000) {
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
    if (this.isGameOver || this.matchEnded) return;
    this.waveTimerEvent = this.time.delayedCall(delay, () => {
      this.waveTimerEvent = null;
      this.startWave();
    });
  }

  hostScheduleNextWave(delay = 10000) {
    if (this.playerNumber !== 1) return;
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
    if (this.isGameOver || this.matchEnded) return;
    this.waveTimerEvent = this.time.delayedCall(delay, () => {
      this.waveTimerEvent = null;
      this.startWave({ fromNetwork: false });
    });
  }

  startWave({ fromNetwork = false, waveNumber = null } = {}) {
    if (this.isGameOver || this.matchEnded) return;

    if (typeof waveNumber === 'number' && Number.isFinite(waveNumber)) {
      this.wave = waveNumber - 1;
    }

    this.wave++;
    this.updateUI();

    const isBossWave = this.gameMode === 'singlePlayer' && (this.wave % 10 === 0);
    let nextDelay = 30000;

    if (isBossWave) {
      this.showMessage(`👑 第 ${this.wave} 波 - BOSS來襲！！！`, 0xFF0000);
      this.bonusEnemiesPerWave = 0;
      nextDelay = 32000;
      this.time.delayedCall(2000, () => {
        if (this.isGameOver || this.matchEnded) return;
        this.spawnLocalEnemy({ isBoss: true });
      });
    } else {
      let enemyCount = 10 + this.wave * 4;
      if (this.gameMode === 'singlePlayer' && this.bossDefeated) {
        enemyCount += this.bonusEnemiesPerWave;
        this.showMessage(`🌊 第 ${this.wave} 波來襲！(+${this.bonusEnemiesPerWave} 額外怪物)`, 0xFF6B6B);
      } else {
        this.showMessage(`🌊 第 ${this.wave} 波來襲！`);
      }
      nextDelay = (enemyCount + 10) * 1000;
      for (let i = 0; i < enemyCount; i++) {
        this.time.delayedCall(i * 1000, () => {
          if (this.isGameOver || this.matchEnded) return;
          this.spawnLocalEnemy({ isBoss: false });
        });
      }
    }

    if (this.gameMode === 'singlePlayer') {
      if (this.lives > 0) {
        this.scheduleNextWave(nextDelay);
      }
      return;
    }

    if (this.playerNumber === 1 && !fromNetwork && SocketService.socket && this.roomId) {
      SocketService.emit('wave-start', { roomId: this.roomId, wave: this.wave });
    }

    if (this.playerNumber === 1 && this.lives > 0 && !this.matchEnded) {
      this.hostScheduleNextWave(nextDelay);
    }
  }

  onBossDefeated() {
    this.bossDefeated = true;
    this.bonusEnemiesPerWave = Math.floor(Math.random() * 5) + 3;
    if (this.playerTowers.length > 0) {
      const randomTower = this.playerTowers[Math.floor(Math.random() * this.playerTowers.length)];
      randomTower.upgrade();
      this.showMessage(`🎁 Boss獎勵！
${randomTower.config.emoji} 升至Lv.${randomTower.level}
下一輪+${this.bonusEnemiesPerWave}怪`, 0xFFD700);
    } else {
      this.showMessage(`⚠️ 無塔可升級
下一輪+${this.bonusEnemiesPerWave}怪`, 0xFFA500);
    }
  }

  getAuraBonus() {
    let attackSpeedBonus = 0;
    let damageBonus = 0;
    let enemySlowBonus = 0;
    this.playerTowers.forEach(tower => {
      if (tower.config.isAura) {
        attackSpeedBonus += tower.config.auraAttackSpeedBonus * tower.level;
        damageBonus += tower.config.auraDamageBonus * tower.level;
        enemySlowBonus += tower.config.auraEnemySlowBonus * tower.level;
      }
    });
    return { attackSpeedBonus, damageBonus, enemySlowBonus };
  }

  updateProjectiles(delta) {
    this.projectiles = this.projectiles.filter(projectile => {
      if (!projectile.target.active) {
        projectile.graphic.destroy();
        if (projectile.glow) projectile.glow.destroy();
        return false;
      }
      const angle = Math.atan2(projectile.target.y - projectile.y, projectile.target.x - projectile.x);
      const moveDistance = projectile.speed * (delta / 1000);
      projectile.x += Math.cos(angle) * moveDistance;
      projectile.y += Math.sin(angle) * moveDistance;
      projectile.graphic.setPosition(projectile.x, projectile.y);
      if (projectile.glow) projectile.glow.setPosition(projectile.x, projectile.y);
      const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, projectile.target.x, projectile.target.y);
      if (distance < 10) {
        this.handleProjectileHit(projectile);
        return false;
      }
      return true;
    });
  }

  handleProjectileHit(projectile) {
    const target = projectile.target;
    const config = projectile.config;
    target.takeDamage(projectile.damage);
    if (config.dotDamage) target.applyBurn(config.dotDamage, config.dotDuration);
    if (config.poisonDamage) target.applyPoison(config.poisonDamage, config.poisonDuration);
    if (config.slow) target.applySlow(config.slow, config.slowDuration);
    if (config.freeze) target.applyFreeze(config.freezeDuration);
    if (config.splashRadius) this.applySplashDamage(projectile.x, projectile.y, config);
    if (config.chainCount) this.applyLightningChain(target, config);
    this.createHitEffect(projectile.x, projectile.y, config.effectColor);
    projectile.graphic.destroy();
    if (projectile.glow) projectile.glow.destroy();
  }

  applySplashDamage(x, y, config) {
    this.enemies.forEach(enemy => {
      if (!enemy.active) return;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= config.splashRadius) {
        enemy.takeDamage(config.damage * 0.5);
        if (config.poisonDamage) enemy.applyPoison(config.poisonDamage, config.poisonDuration);
      }
    });
    const explosionRing = this.add.circle(x, y, 10, config.effectColor, 0.4).setDepth(55);
    this.tweens.add({ targets: explosionRing, radius: config.splashRadius, alpha: 0, duration: 400, ease: 'Power2', onComplete: () => explosionRing.destroy() });
  }

  applyLightningChain(startTarget, config) {
    let currentTarget = startTarget;
    const hitTargets = [startTarget];
    for (let i = 1; i < config.chainCount; i++) {
      let nextTarget = null;
      let closestDistance = config.chainRange;
      this.enemies.forEach(enemy => {
        if (!enemy.active || hitTargets.includes(enemy)) return;
        const distance = Phaser.Math.Distance.Between(currentTarget.x, currentTarget.y, enemy.x, enemy.y);
        if (distance < closestDistance) {
          nextTarget = enemy;
          closestDistance = distance;
        }
      });
      if (nextTarget) {
        this.drawLightning(currentTarget.x, currentTarget.y, nextTarget.x, nextTarget.y);
        nextTarget.takeDamage(config.damage * 0.7);
        hitTargets.push(nextTarget);
        currentTarget = nextTarget;
      } else {
        break;
      }
    }
  }

  drawLightning(x1, y1, x2, y2) {
    const graphics = this.add.graphics().setDepth(55);
    graphics.lineStyle(3, 0xFFFF00, 1).lineBetween(x1, y1, x2, y2);
    graphics.lineStyle(1, 0xFFFFFF, 1).lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: graphics, alpha: 0, duration: 200, onComplete: () => graphics.destroy() });
  }
  
  drawArrow(x, y, angle, color, depth) {
    const arrowGraphics = this.add.graphics().setDepth(depth);
    arrowGraphics.fillStyle(color, 1).lineStyle(2, 0x000000, 1);
    const arrowLength = 18; const arrowWidth = 12;
    const tipX = arrowLength / 2; const tipY = 0;
    const leftX = -arrowLength / 2; const leftY = -arrowWidth / 2;
    const rightX = -arrowLength / 2; const rightY = arrowWidth / 2;
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const tip = { x: x + tipX * cos - tipY * sin, y: y + tipX * sin + tipY * cos };
    const left = { x: x + leftX * cos - leftY * sin, y: y + leftX * sin + leftY * cos };
    const right = { x: x + rightX * cos - rightY * sin, y: y + rightX * sin + rightY * cos };
    arrowGraphics.beginPath().moveTo(tip.x, tip.y).lineTo(left.x, left.y).lineTo(right.x, right.y).closePath().fillPath().strokePath();
    return arrowGraphics;
  }

  createHitEffect(x, y, color) {
    const particles = this.add.particles(x, y, 'particle', { speed: { min: 50, max: 150 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 }, tint: color, lifespan: 300, quantity: 10, blendMode: 'ADD' }).setDepth(55);
    this.time.delayedCall(300, () => particles.destroy());
  }
  
  createBuildEffect(x, y, color) {
    const circle = this.add.circle(x, y, 5, color);
    this.tweens.add({ targets: circle, radius: 50, alpha: 0, duration: 500, ease: 'Power2', onComplete: () => circle.destroy() });
  }

  createUpgradeEffect(x, y, color) {
    const particles = this.add.particles(x, y, 'particle', { speed: { min: 80, max: 150 }, scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 }, tint: [color, 0xFFD700, 0xFFFFFF], lifespan: 600, quantity: 20, blendMode: 'ADD' });
    this.time.delayedCall(600, () => particles.destroy());
    const ring = this.add.circle(x, y, 10, color, 0.6).setDepth(100);
    this.tweens.add({ targets: ring, radius: 60, alpha: 0, duration: 500, ease: 'Power2', onComplete: () => ring.destroy() });
  }

  createCraftEffect(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(x, y, 10, color, 0.5);
      this.tweens.add({ targets: ring, radius: 80 + i * 20, alpha: 0, duration: 800, delay: i * 100, ease: 'Power2', onComplete: () => ring.destroy() });
    }
    const particles = this.add.particles(x, y, 'particle', { speed: { min: 100, max: 300 }, scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: [color, 0xFFD700, 0xFFFFFF], lifespan: 800, quantity: 30, blendMode: 'ADD' });
    this.time.delayedCall(800, () => particles.destroy());
  }

  showMessage(text, color = 0x4ECDC4) {
    const message = this.add.text(this.cameras.main.width / 2, 30, text, {
      fontSize: '24px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      padding: {x: 5, y: 5}
    }).setOrigin(0.5).setDepth(400);
    this.tweens.add({ targets: message, y: 20, alpha: 0, duration: 2500, ease: 'Power2', onComplete: () => message.destroy() });
  }

  addGold(amount) {
    this.gold += amount;
    this.score += amount;
    this.updateUI();
  }

  loseLife(amount) {
    if (this.matchEnded) return;
    this.lives -= amount;
    if (this.lives < 0) this.lives = 0;
    if (this.gameMode === 'multiplayer' && SocketService.socket && this.roomId) {
      SocketService.emit('life-update', { roomId: this.roomId, lives: this.lives });
    }
    this.updateUI();
    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.cameras.main.shake(200, 0.01);
    }
  }

  gameOver() {
    if (this.gameMode === 'multiplayer') {
      this.endMultiplayerMatch({
        victory: false,
        title: '你已經失敗！',
        subtitle: `最終分數: ${this.score}`,
        notifyOpponent: true
      });
      return;
    }

    this.isGameOver = true;
    this.matchEnded = true;
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
    const overlay = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7).setDepth(300);
    this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 100, '你已經失敗！', { fontSize: '48px', color: '#FF4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6, padding: {x:10, y:10} }).setOrigin(0.5).setDepth(301);
    this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, `最終分數: ${this.score}`, { fontSize: '24px', color: '#FFD700', padding: { y: 10 } }).setOrigin(0.5).setDepth(301);
    const buttonX = this.cameras.main.width / 2;
    const buttonY = this.cameras.main.height / 2 + 100;
    const restartButton = this.add.rectangle(buttonX, buttonY, 200, 60, 0x4CAF50).setStrokeStyle(3, 0xFFFFFF).setInteractive({ useHandCursor: true }).setDepth(301);
    const buttonText = this.add.text(buttonX, buttonY, '重新開始', { fontSize: '28px', color: '#FFFFFF', fontStyle: 'bold', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(302);
    restartButton.on('pointerover', () => { restartButton.setFillStyle(0x5CD660); this.tweens.add({ targets: restartButton, scale: 1.05, duration: 200 }); });
    restartButton.on('pointerout', () => { restartButton.setFillStyle(0x4CAF50); this.tweens.add({ targets: restartButton, scale: 1, duration: 200 }); });
    restartButton.on('pointerdown', () => { this.scene.restart({ mode: this.gameMode }); });
  }
  // #endregion
}
