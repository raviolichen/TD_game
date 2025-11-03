import SocketService from '../services/SocketService.js';

/**
 * EconomyManager - 管理遊戲中的經濟系統
 * 包括金幣獲取、生命扣除、金幣加成計算
 */
export default class EconomyManager {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * 取得 UI 管理器
   */
  getUiManager() {
    return this.scene.uiManager;
  }

  /**
   * 安全地更新 UI
   */
  updateUI() {
    const uiManager = this.getUiManager();
    if (uiManager && uiManager.updateUI) {
      uiManager.updateUI();
    }
  }

  /**
   * 增加金幣
   */
  addGold(amount) {
    this.scene.gold += amount;
    this.scene.score += amount;
    this.updateUI();
  }

  /**
   * 計算怪物擊殺獲得的金幣（考慮金錢塔加成）
   */
  calculateKillGold(baseGold, enemy) {
    let goldMultiplier = 1.0;

    // 檢查是否有金錢塔加成
    if (enemy.lastHitByTower) {
      const tower = enemy.lastHitByTower;

      // 如果最後擊中的塔有金錢加成
      if (tower.config.goldMultiplier && tower.config.goldMultiplier > 1) {
        goldMultiplier = tower.config.goldMultiplier;
      }
    }

    // 計算並返回金幣（向下取整）
    return Math.floor(baseGold * goldMultiplier);
  }

  /**
   * 計算光環塔的金幣加成
   */
  getGoldBonus() {
    let goldBonus = 0;

    this.scene.playerTowers.forEach(tower => {
      if (tower.config.isAura && tower.config.auraGoldBonus) {
        goldBonus += tower.config.auraGoldBonus * tower.level;
      }
    });

    return goldBonus;
  }

  /**
   * 扣除生命
   */
  loseLife(amount) {
    if (this.scene.matchEnded) return;

    this.scene.lives -= amount;
    if (this.scene.lives < 0) this.scene.lives = 0;

    // 多人模式：廣播生命更新
    if (this.scene.gameMode === 'multiplayer' && SocketService.socket && this.scene.roomId) {
      SocketService.emit('life-update', {
        roomId: this.scene.roomId,
        lives: this.scene.lives
      });
    }

    this.updateUI();

    // 檢查是否遊戲結束
    if (this.scene.lives <= 0) {
      this.gameOver();
    } else {
      // 震動效果
      this.scene.cameras.main.shake(200, 0.01);
    }
  }

  /**
   * 遊戲結束處理
   */
  gameOver() {
    if (this.scene.gameMode === 'multiplayer') {
      const uiManager = this.getUiManager();
      if (uiManager && uiManager.showMultiplayerMatchEnd) {
        uiManager.showMultiplayerMatchEnd({
          victory: false,
          title: '你已經失敗！',
          subtitle: `最終分數: ${this.scene.score}`,
          notifyOpponent: true
        });
      }
      return;
    }

    // 單人模式
    const uiManager = this.getUiManager();
    if (uiManager && uiManager.showGameOver) {
      uiManager.showGameOver();
    }
  }
}
