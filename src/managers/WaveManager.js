import Enemy from '../entities/Enemy.js';
import SocketService from '../services/SocketService.js';

// 波次相關常數
const BOSS_WAVE_INTERVAL = 10; // 每幾波出現一次Boss
const BASE_ENEMY_COUNT = 20; // 每波基礎怪物數量
const ENEMY_COUNT_PER_10_WAVES_MIN = 3; // 每10波增加的最少怪物數量
const ENEMY_COUNT_PER_10_WAVES_MAX = 7; // 每10波增加的最多怪物數量

/**
 * WaveManager - 管理遊戲中的波次系統
 * 包括波次調度、敵人生成、Boss獎勵、光環加成計算
 */
export default class WaveManager {
  constructor(scene) {
    this.scene = scene;

    // 波次狀態
    this.wave = 0;
    this.bossDefeated = false;
    this.bonusEnemiesPerWave = 0;
    this.enemyIncreasePerTenWaves = {}; // 記錄每10波增加的怪物數量
    this.waveTimerEvent = null;
    this.nextEnemyNetworkId = 1;
  }

  /**
   * 安全地更新 UI
   */
  updateUI() {
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.updateUI) {
      uiManager.updateUI();
    }
  }

  /**
   * 安全地顯示提示訊息
   */
  showMessage(text, color) {
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.showMessage) {
      uiManager.showMessage(text, color);
    }
  }

  /**
   * 初始化波次系統
   */
  init() {
    this.wave = 0;
    this.bossDefeated = false;
    this.bonusEnemiesPerWave = 0;
    this.enemyIncreasePerTenWaves = {};
  }

  /**
   * 單人模式：調度下一波
   */
  scheduleNextWave(delay = 10000) {
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }

    if (this.scene.isGameOver || this.scene.matchEnded) return;

    this.waveTimerEvent = this.scene.time.delayedCall(delay, () => {
      this.waveTimerEvent = null;
      this.startWave();
    });
  }

  /**
   * 多人模式：主機調度下一波
   */
  hostScheduleNextWave(delay = 10000) {
    // 只有主機（玩家1）才能調度波次
    if (this.scene.playerNumber !== 1) return;

    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }

    if (this.scene.isGameOver || this.scene.matchEnded) return;

    this.waveTimerEvent = this.scene.time.delayedCall(delay, () => {
      this.waveTimerEvent = null;
      this.startWave({ fromNetwork: false });
    });
  }

  /**
   * 開始新的一波
   */
  startWave({ fromNetwork = false, waveNumber = null } = {}) {
    if (this.scene.isGameOver || this.scene.matchEnded) return;

    // 允許從網絡同步波次編號
    if (typeof waveNumber === 'number' && Number.isFinite(waveNumber)) {
      this.wave = waveNumber - 1;
    }

    this.wave++;
    this.updateUI();

    const isBossWave = (this.wave % BOSS_WAVE_INTERVAL === 0);
    let nextDelay = 30000;

    if (isBossWave) {
      this.handleBossWave();
      nextDelay = 32000;
    } else {
      nextDelay = this.handleNormalWave();
    }

    // 調度下一波
    if (this.scene.gameMode === 'singlePlayer') {
      if (this.scene.lives > 0) {
        this.scheduleNextWave(nextDelay);
      }
      return;
    }

    // 多人模式：主機廣播波次開始
    if (this.scene.playerNumber === 1 && !fromNetwork && SocketService.socket && this.scene.roomId) {
      SocketService.emit('wave-start', {
        roomId: this.scene.roomId,
        wave: this.wave
      });
    }

    // 多人模式：主機調度下一波
    if (this.scene.playerNumber === 1 && this.scene.lives > 0 && !this.scene.matchEnded) {
      this.hostScheduleNextWave(nextDelay);
    }
  }

  /**
   * 處理Boss波次
   */
  handleBossWave() {
    this.showMessage(`👑 第 ${this.wave} 波 - BOSS來襲！！！`, 0xFF0000);
    this.bonusEnemiesPerWave = 0; // Boss波重置額外怪物數量

    // 延遲2秒生成Boss
    this.scene.time.delayedCall(2000, () => {
      if (this.scene.isGameOver || this.scene.matchEnded) return;
      this.spawnLocalEnemy({ isBoss: true });
    });
  }

  /**
   * 處理普通波次
   */
  handleNormalWave() {
    // 計算難度相關數值
    const bonusRounds = Math.floor(this.wave / BOSS_WAVE_INTERVAL);

    // 計算累積增加的怪物數量
    let totalIncrease = 0;
    for (let i = 1; i <= bonusRounds; i++) {
      const roundKey = i * BOSS_WAVE_INTERVAL;
      // 如果這個10波還沒有隨機過，就隨機一次並記錄
      if (!this.enemyIncreasePerTenWaves[roundKey]) {
        this.enemyIncreasePerTenWaves[roundKey] = Math.floor(
          Math.random() * (ENEMY_COUNT_PER_10_WAVES_MAX - ENEMY_COUNT_PER_10_WAVES_MIN + 1)
        ) + ENEMY_COUNT_PER_10_WAVES_MIN;
      }
      totalIncrease += this.enemyIncreasePerTenWaves[roundKey];
    }

    const baseEnemyCount = BASE_ENEMY_COUNT + totalIncrease;
    let totalEnemyCount = baseEnemyCount;

    // 計算每10波後的間隔縮短（每10波縮短100ms，最低400ms）
    const spawnInterval = Math.max(400, 1000 - bonusRounds * 100);

    // Boss擊敗後的額外怪物
    if (this.scene.gameMode === 'singlePlayer' && this.bossDefeated) {
      totalEnemyCount += this.bonusEnemiesPerWave;
      this.showMessage(
        `🌊 第 ${this.wave} 波來襲！(+${this.bonusEnemiesPerWave} 額外怪物) [間隔${spawnInterval}ms]`,
        0xFF6B6B
      );
    } else {
      this.showMessage(`🌊 第 ${this.wave} 波來襲！`);
    }

    // 生成隨機生怪時間序列
    const spawnTimes = [];
    for (let i = 0; i < totalEnemyCount; i++) {
      spawnTimes.push(i * spawnInterval);
    }

    // 如果有額外怪物，將它們隨機插入到現有時間點（允許同時生多個）
    if (this.scene.gameMode === 'singlePlayer' && this.bossDefeated && this.bonusEnemiesPerWave > 0) {
      for (let i = 0; i < this.bonusEnemiesPerWave; i++) {
        // 隨機選擇一個已存在的時間點，讓額外怪和基礎怪同時生成
        const randomIndex = Math.floor(Math.random() * baseEnemyCount);
        spawnTimes[baseEnemyCount + i] = randomIndex * spawnInterval;
      }
      // 重新排序確保按時間順序生怪
      spawnTimes.sort((a, b) => a - b);
    }

    // 根據時間序列生怪
    spawnTimes.forEach(delay => {
      this.scene.time.delayedCall(delay, () => {
        if (this.scene.isGameOver || this.scene.matchEnded) return;
        this.spawnLocalEnemy({ isBoss: false });
      });
    });

    // 計算下一波的延遲時間
    const nextDelay = (totalEnemyCount * spawnInterval / 1000 + 10) * 1000;
    return nextDelay;
  }

  /**
   * 生成本地敵人（並廣播到網絡）
   */
  spawnLocalEnemy({ isBoss = false } = {}) {
    if (this.scene.matchEnded) return;

    const path = this.scene.gameMode === 'multiplayer' ? this.scene.playerPath : this.scene.path;
    if (!path || path.length === 0) return;

    // 創建敵人
    const enemy = new Enemy(this.scene, path, this.wave, isBoss);
    enemy.owner = 'self';
    const enemyId = this.createEnemyNetworkId();
    enemy.enemyId = enemyId;

    this.scene.enemies.push(enemy);
    this.scene.localEnemiesById.set(enemyId, enemy);

    // 多人模式：廣播敵人生成
    if (this.scene.gameMode === 'multiplayer' && SocketService.socket && this.scene.roomId) {
      const payload = {
        roomId: this.scene.roomId,
        enemyId,
        wave: this.wave,
        isBoss,
        emoji: enemy.visualEmoji,
        ownerId: this.scene.localPlayerId || SocketService.socket.id
      };
      console.log('[敵人生成] 發送敵人生成事件:', payload);
      SocketService.emit('enemy-spawn', payload);
    }

    return enemy;
  }

  /**
   * Boss擊敗獎勵
   */
  onBossDefeated() {
    this.bossDefeated = true;
    this.bonusEnemiesPerWave = Math.floor(Math.random() * 5) + 3; // 3-7個額外怪物

    // 隨機升級一座塔
    if (this.scene.playerTowers.length > 0) {
      const randomTower = this.scene.playerTowers[
        Math.floor(Math.random() * this.scene.playerTowers.length)
      ];
      randomTower.upgrade();

      this.showMessage(
        `🎁 Boss獎勵！\n${randomTower.config.emoji} 升至Lv.${randomTower.level}\n下一輪+${this.bonusEnemiesPerWave}怪`,
        0xFFD700
      );
    } else {
      this.showMessage(
        `⚠️ 無塔可升級\n下一輪+${this.bonusEnemiesPerWave}怪`,
        0xFFA500
      );
    }
  }

  /**
   * 計算所有光環塔的全局加成
   */
  getAuraBonus() {
    let attackSpeedBonus = 0;
    let damageBonus = 0;
    let enemySlowBonus = 0;

    this.scene.playerTowers.forEach(tower => {
      if (tower.config.isAura) {
        attackSpeedBonus += tower.config.auraAttackSpeedBonus * tower.level;
        damageBonus += tower.config.auraDamageBonus * tower.level;
        enemySlowBonus += tower.config.auraEnemySlowBonus * tower.level;
      }
    });

    return { attackSpeedBonus, damageBonus, enemySlowBonus };
  }

  /**
   * 創建敵人網絡ID
   */
  createEnemyNetworkId() {
    const timestamp = Date.now();
    const playerId = this.scene.localPlayerId || SocketService.socket?.id || 'local';
    return `${playerId}_${timestamp}_${this.nextEnemyNetworkId++}`;
  }

  /**
   * 獲取當前波次編號
   */
  getCurrentWave() {
    return this.wave;
  }

  /**
   * 清理波次定時器
   */
  cleanup() {
    if (this.waveTimerEvent) {
      this.waveTimerEvent.remove(false);
      this.waveTimerEvent = null;
    }
  }
}
