import Tower from '../entities/Tower.js';
import Enemy from '../entities/Enemy.js';
import { TowerConfig, TowerTypes, canCraftTower, canCraftThreeTowers } from '../config/towerConfig.js';
import SocketService from '../services/SocketService.js';
import EffectManager from '../managers/EffectManager.js';
import ProjectileManager from '../managers/ProjectileManager.js';
import WaveManager from '../managers/WaveManager.js';
import TowerManager from '../managers/TowerManager.js';
import UIManager from '../managers/UIManager.js';
import EconomyManager from '../managers/EconomyManager.js';
import AudioManager from '../managers/AudioManager.js';
import MapManager, { DEFAULT_MAP } from '../managers/MapManager.js';

// 遊戲配置參數
const BOSS_WAVE_INTERVAL = 10; // 每幾波出現一次Boss
const BASE_ENEMY_COUNT = 20; // 每波基礎怪物數量
const ENEMY_COUNT_PER_10_WAVES_MIN = 3; // 每10波增加的最少怪物數量
const ENEMY_COUNT_PER_10_WAVES_MAX = 7; // 每10波增加的最多怪物數量

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // #region Initialization
  init(data) {
    this.gameMode = data.mode || 'singlePlayer';
    this.playerNumber = null;
    this.roomId = null;
    this.gold = 5000;
    this.lives = 20;
    this.wave = 0;
    this.score = 0;
    this.towers = [];
    this.playerTowers = [];
    this.opponentTowers = [];
    this.enemies = [];
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
    this.enemyIncreasePerTenWaves = {}; // 記錄每10波增加的怪物數量
    this.scaledGameTime = 0;
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

    // 初始化遊戲速度設置 (確保正常速度)
    this.physics.world.timeScale = 1;
    this.time.timeScale = 1;
    this.gameSpeedMultiplier = 1;
    this.scaledGameTime = 0;

    // 初始化所有管理器
    this.effectManager = new EffectManager(this);
    this.projectileManager = new ProjectileManager(this, this.effectManager);
    this.waveManager = new WaveManager(this);
    this.towerManager = new TowerManager(this);
    this.uiManager = new UIManager(this);
    this.economyManager = new EconomyManager(this);
    this.audioManager = new AudioManager(this);
    this.mapManager = new MapManager(this);

    if (this.gameMode === 'singlePlayer') {
      this.initializeSinglePlayerGame();
      this.waveManager.scheduleNextWave(10000);
    } else {
      this.initializeMultiplayerGame();
    }

    this.input.on('pointerdown', (pointer) => this.handleMapClick(pointer));
    this.input.on('pointermove', (pointer) => this.towerManager.handleMouseMove(pointer));

    // 添加鍵盤快捷鍵 (只在單機模式下)
    if (this.gameMode === 'singlePlayer') {
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.uiManager && this.uiManager.toggleGameSpeed) {
          this.uiManager.toggleGameSpeed();
        }
      });
    }

    this.events.once('shutdown', this.onSceneShutdown, this);
    this.events.once('destroy', this.onSceneShutdown, this);

    // 監聽瀏覽器標籤頁可見性變化，解決 Chrome tab 切換後速度異常問題
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * 處理瀏覽器標籤頁可見性變化
   * 當用戶從其他 tab 切回遊戲時，重新同步遊戲速度設置
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // 標籤頁恢復可見
      const targetSpeed = this.uiManager?.gameSpeed || 1;

      // 確保 timeScale 保持正確
      this.physics.world.timeScale = targetSpeed;
      this.time.timeScale = targetSpeed;
      this.gameSpeedMultiplier = targetSpeed;

      // 標記需要進行時間補償，讓遊戲立即恢復正常速度感
      // Chrome 會在恢復時暫時節流，我們需要補償這段時間
      this.tabRecoveryTime = Date.now();
      this.tabRecoveryFrames = 0;
    } else {
      // 標籤頁進入背景，記錄離開時間
      this.tabHiddenTime = Date.now();
    }
  }

  initializeSinglePlayerGame() {
    this.createLayout();

    // 初始化音效管理器
    if (!this.audioManager) {
      this.audioManager = new AudioManager(this);
    }
    this.audioManager.startBGM();

    // 使用瓦片地圖系統
    this.path = this.mapManager.createMap(DEFAULT_MAP);
    this.mapBounds = this.mapManager.getMapBounds();

    this.uiManager.createUI();
    this.playerPath = this.path;
    this.playerBuildBounds = this.mapBounds;

    // 格線覆蓋層現在由 MapManager 的瓦片邊框提供視覺輔助
    // 不再需要額外的 createGridOverlay
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
      this.uiManager.createMultiplayerUI();
      if (this.uiManager.hintText) {
        this.uiManager.hintText.setText('💡 對戰開始！建造防線');
      }

      this.setupOpponentListeners();
      this.uiManager.showMessage('⚔️ 對戰開始！5 秒後開啟第一波', 0xFFD700);
      this.startStateSyncBroadcast();
      if (this.playerNumber === 1) {
        this.waveManager.hostScheduleNextWave(5000);
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
    if (!data || !this.opponentAreaRect) return;
    if (data.towerId && this.towerById.has(data.towerId)) return;

    const worldX = this.opponentAreaRect.x + data.x;
    const worldY = data.y;
    const tower = new Tower(this, worldX, worldY, data.towerType);
    tower.markAsOpponent();
    if (data.towerId) {
      tower.networkId = data.towerId;
      this.towerById.set(data.towerId, tower);
    }

    // 如果有等級資訊，升級塔到對應等級
    if (data.level && data.level > 1) {
      for (let i = 1; i < data.level; i++) {
        tower.upgrade();
      }
    }

    this.opponentTowers.push(tower);
    this.towers.push(tower);
    this.effectManager.createBuildEffect(worldX, worldY, tower.config.color);
  }

  handleOpponentUpgrade(data) {
    if (!data || !data.towerId) return;
    const tower = this.towerById.get(data.towerId);
    if (!tower || !tower.isRemote) return;
    tower.upgrade();
    this.effectManager.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);
  }

  handleOpponentRemoveTower(data) {
    if (!data || !data.towerId) return;
    const tower = this.towerById.get(data.towerId);
    if (!tower) return;

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
    this.waveManager.startWave({ fromNetwork: true, waveNumber });
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

    // 根據波數和是否為BOSS調整體型
    let fontSize, healthWidth, offsetY;
    if (isBoss) {
      if (wave > 100) {
        fontSize = '192px'; // 101波之後BOSS雙倍體型 (原96px的雙倍)
        healthWidth = 320;
        offsetY = 140;
      } else {
        fontSize = '96px';
        healthWidth = 160;
        offsetY = 70;
      }
    } else {
      if (wave > 100) {
        fontSize = '56px'; // 101波之後普通怪物雙倍體型 (原28px的雙倍)
        healthWidth = 80;
        offsetY = 40;
      } else {
        fontSize = '28px';
        healthWidth = 40;
        offsetY = 20;
      }
    }

    const chosenEmoji = emoji || (isBoss ? '🤡' : '🤡');
    const sprite = this.add.text(startPoint.x, startPoint.y, chosenEmoji, {
      fontSize,
      color: '#FFFFFF'
    }).setOrigin(0.5);
    sprite.setDepth(52);
    sprite.setAlpha(0.6);
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

    if (cause === 'dead' && this.effectManager && this.effectManager.createHitEffect) {
      this.effectManager.createHitEffect(ghost.x, ghost.y, 0xFFFFFF);
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

    // 計算並給予金幣獎勵（包含加成）
    if (enemy.reward) {
      const goldBonus = this.calculateGoldBonus(enemy);
      const finalGold = Math.round(enemy.reward * (1 + goldBonus));
      this.economyManager.addGold(finalGold);
    }

    if (this.gameMode === 'multiplayer' && !this.matchEnded && enemy.owner !== 'opponent' && enemy.enemyId && SocketService.socket && this.roomId) {
      SocketService.emit('enemy-died', {
        roomId: this.roomId,
        enemyId: enemy.enemyId,
        ownerId: this.localPlayerId || SocketService.id
      });
    }
  }

  calculateGoldBonus(enemy) {
    let totalBonus = 0;
    const killerTower = enemy.lastHitByTower;

    // 計算全局金幣加成（蒸汽工廠 + 光環塔等）
    this.playerTowers.forEach(tower => {
      if (tower.config.goldBonus) {
        totalBonus += tower.config.goldBonus * tower.level;
      }
    });

    // 金錢塔自身擊殺加成
    if (killerTower && killerTower.config.goldMultiplier) {
      totalBonus += (killerTower.config.goldMultiplier - 1); // 例如 1.5 變成 +0.5 (50%)
    }

    // 金錢塔光環範圍加成（金錢塔增益範圍內的其他塔）
    if (killerTower) {
      this.playerTowers.forEach(moneyTower => {
        if (moneyTower.config.goldAuraRange && moneyTower.config.goldAuraBonus) {
          const distance = Phaser.Math.Distance.Between(
            killerTower.x, killerTower.y, moneyTower.x, moneyTower.y
          );
          if (distance <= moneyTower.config.goldAuraRange) {
            totalBonus += moneyTower.config.goldAuraBonus;
          }
        }
      });
    }

    return totalBonus;
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
    // 清理 visibilitychange 事件監聽器
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // 清理音效
    if (this.audioManager) {
      this.audioManager.cleanup();
    }

    // 重置遊戲速度到正常
    this.physics.world.timeScale = 1;
    this.time.timeScale = 1;
    this.gameSpeedMultiplier = 1;
    this.scaledGameTime = 0;

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

  // #endregion

  // #region Core Game Logic & Interaction
  update(time, delta) {
    if (this.isGameOver || this.matchEnded) return;

    // 限制最大 delta 以避免切換分頁後的瞬間移動或邏輯錯誤
    // 這能解決長時間背景執行後切回來導致的數值崩壞，也能避免過大的時間跳躍
    if (delta > 500) delta = 500;

    // Chrome tab 恢復期間的時間補償
    // Chrome 切 tab 回來後會暫時節流幀率（約 100-500ms 才恢復到 60fps）
    // 在恢復期間的前 30 幀，我們強制使用理想的 delta 值來避免遊戲看起來變慢
    let deltaAlreadyScaled = false;
    if (this.tabRecoveryTime) {
      const timeSinceRecovery = Date.now() - this.tabRecoveryTime;
      this.tabRecoveryFrames = (this.tabRecoveryFrames || 0) + 1;

      // 恢復期間（500ms 內或前 30 幀），使用理想的 delta 值
      if (timeSinceRecovery < 500 && this.tabRecoveryFrames < 30) {
        // 使用目標速度計算理想 delta（60fps = 16.67ms），已包含速度倍率
        const targetSpeed = this.uiManager?.gameSpeed || 1;
        delta = 16.67 * targetSpeed;
        deltaAlreadyScaled = true;
      } else {
        // 恢復完成，清除標記
        this.tabRecoveryTime = null;
        this.tabRecoveryFrames = 0;
      }
    }

    // 重要：Phaser 的 scene.time.timeScale 只影響計時器（如 delayedCall），
    // 不影響 update 回調的 delta 值。必須手動乘以遊戲速度倍率。
    // Tab 恢復期間 delta 已包含速度倍率，無需重複乘。
    const gameSpeed = this.gameSpeedMultiplier || 1;
    const scaledDelta = deltaAlreadyScaled ? delta : delta * gameSpeed;
    this.scaledGameTime = (this.scaledGameTime || 0) + scaledDelta;
    const scaledTime = this.scaledGameTime;

    const auraBonus = this.waveManager ? this.waveManager.getAuraBonus() : null;

    // 更新所有玩家塔
    if (this.playerTowers && this.playerTowers.length > 0) {
      this.playerTowers.forEach(tower => {
        if (tower && tower.update) {
          tower.update(scaledTime, this.enemies, auraBonus, scaledDelta);
        }
      });
    }

    // 更新敵人位置與狀態
    if (this.enemies && this.enemies.length > 0) {
      this.enemies = this.enemies.filter(enemy => {
        if (!enemy) return false;
        if (enemy.update) {
          enemy.update(scaledDelta, auraBonus);
        }
        return enemy.active;
      });
    }

    // 更新範圍持續效果（例如地面火焰）
    if (this.effectManager && this.effectManager.updateGroundFires) {
      this.effectManager.updateGroundFires(scaledDelta, this.enemies);
    }

    // 更新陷阱系統
    if (this.effectManager && this.effectManager.updateTraps) {
      this.effectManager.updateTraps(scaledDelta, this.enemies);
    }

    // 更新投射物
    if (this.projectileManager && this.projectileManager.update) {
      this.projectileManager.update(scaledDelta, this.enemies);
    }

    // 多人模式同步幽靈敵人
    if (this.gameMode === 'multiplayer') {
      this.updateGhostEnemies(scaledDelta);
    }
  }

  handleMapClick(pointer) {
    if (this.gameMode === 'singlePlayer' && pointer.x < 220) return;

    // 多人模式：忽略底部 UI 區域的點擊（y >= 500）
    if (this.gameMode === 'multiplayer' && pointer.y >= 500) return;

    const clickedTower = this.playerTowers.find(tower => Phaser.Math.Distance.Between(pointer.x, pointer.y, tower.x, tower.y) < 25);

    if (clickedTower) {
      if (this.towerManager.craftMode) {
        this.towerManager.selectTowerForCraft(clickedTower);
      } else {
        this.towerManager.showTowerInfo(clickedTower);
      }
      return;
    }

    if (this.towerManager.upgradePanel) {
      this.towerManager.hideUpgradePanel();
      if (this.towerManager.selectedTowerObject) {
        if (this.towerManager.selectedTowerObject.sprite && this.towerManager.selectedTowerObject.sprite.active) {
          this.towerManager.selectedTowerObject.hideRange();
        }
        this.towerManager.selectedTowerObject = null;
      }
    }

    // 只有當玩家選擇了塔要建造時，才檢查區域限制
    if (this.towerManager.selectedTower && !this.towerManager.craftMode) {
      if (this.gameMode === 'multiplayer') {
        if (!this.playerMapBounds || !Phaser.Geom.Rectangle.Contains(this.playerMapBounds, pointer.x, pointer.y)) {
          this.uiManager.showMessage('只能在自己的區域建造！', 0xFF0000);
          return;
        }
      }
      this.towerManager.buildTower(pointer.x, pointer.y, this.towerManager.selectedTower);
    }
  }


  // 波次管理方法已移至 WaveManager
  // 投射物、特效等方法已移至 ProjectileManager 和 EffectManager

  drawArrow(x, y, angle, color, depth) {
    const arrowSize = 15;
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 0.6);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x - arrowSize * Math.cos(angle - Math.PI / 6), y - arrowSize * Math.sin(angle - Math.PI / 6));
    graphics.lineTo(x - arrowSize * Math.cos(angle + Math.PI / 6), y - arrowSize * Math.sin(angle + Math.PI / 6));
    graphics.closePath();
    graphics.fillPath();
    graphics.setDepth(depth);
  }

  // #endregion
}
