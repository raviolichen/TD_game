import { TowerTypes } from '../config/towerConfig.js';

/**
 * UIManager - 管理遊戲中的所有UI元素
 * 包括單人/多人UI、訊息顯示、更新資源文字
 */
export default class UIManager {
  constructor(scene) {
    this.scene = scene;

    // UI元素引用
    this.goldText = null;
    this.livesText = null;
    this.waveText = null;
    this.scoreText = null;
    this.hintText = null;
    this.opponentLivesText = null;
    this.matchStatusText = null;

    // 遊戲速度控制
    this.gameSpeed = 1; // 預設1倍速
    this.speedButton = null;
    this.speedText = null;
  }

  /**
   * 創建單人模式UI
   */
  createUI() {
    const panelX = 110;
    const panelWidth = 190;

    // 資源面板
    const resourceY = 60;
    const resourceTitle = this.scene.add.text(panelX, resourceY, '📊 遊戲資源', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 4, y: 4 }
    }).setOrigin(0.5);
    resourceTitle.setDepth(101);

    const resourceBg = this.scene.add.rectangle(panelX, resourceY + 70, panelWidth, 110, 0xFFFFFF, 1);
    resourceBg.setStrokeStyle(2, 0xCCCCCC);
    resourceBg.setDepth(100);

    const textStartX = 25;
    this.goldText = this.scene.add.text(textStartX, resourceY + 25, `💰 金幣: ${this.scene.gold}`, {
      fontSize: '15px',
      color: '#F39C12',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.goldText.setDepth(102);

    this.livesText = this.scene.add.text(textStartX, resourceY + 50, `❤️ 生命: ${this.scene.lives}`, {
      fontSize: '15px',
      color: '#E74C3C',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.livesText.setDepth(102);

    this.waveText = this.scene.add.text(textStartX, resourceY + 75, `🌊 波數: ${this.scene.waveManager.getCurrentWave()}`, {
      fontSize: '15px',
      color: '#3498DB',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.waveText.setDepth(102);

    this.scoreText = this.scene.add.text(textStartX, resourceY + 100, `⭐ 分數: ${this.scene.score}`, {
      fontSize: '15px',
      color: '#9B59B6',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }
    });
    this.scoreText.setDepth(102);

    // 塔選擇面板
    const towerY = 210;
    const towerTitle = this.scene.add.text(panelX, towerY, '🏰 基礎塔', {
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
      this.scene.towerManager.createTowerButton(x, y, type, buttonSize);
    });

    // 取消選擇按鈕
    const cancelY = towerY + 230;
    const cancelButton = this.scene.add.rectangle(panelX, cancelY, panelWidth - 10, 40, 0xFF6B6B)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    cancelButton.setDepth(101);

    this.scene.add.text(panelX, cancelY, '❌ 取消選擇', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    cancelButton.on('pointerdown', () => this.scene.towerManager.cancelTowerSelection());
    cancelButton.on('pointerover', () => {
      cancelButton.setFillStyle(0xFF8E8E);
      cancelButton.setScale(1.05);
    });
    cancelButton.on('pointerout', () => {
      cancelButton.setFillStyle(0xFF6B6B);
      cancelButton.setScale(1);
    });

    // 合成按鈕
    const craftY = towerY + 280;
    const craftButton = this.scene.add.rectangle(panelX, craftY, panelWidth - 10, 50, 0xB565D8)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    craftButton.setDepth(101);

    this.scene.add.text(panelX, craftY, '🔨 合成塔', {
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    craftButton.on('pointerdown', () => this.scene.towerManager.toggleCraftMode());
    craftButton.on('pointerover', () => {
      craftButton.setFillStyle(0xC67EE8);
      craftButton.setScale(1.05);
    });
    craftButton.on('pointerout', () => {
      craftButton.setFillStyle(0xB565D8);
      craftButton.setScale(1);
    });

    // 提示文字
    const hintY = craftY + 70;
    const hintBg = this.scene.add.rectangle(panelX, hintY, panelWidth, 60, 0xE8F5E9, 1);
    hintBg.setStrokeStyle(2, 0x4CAF50);
    hintBg.setDepth(100);

    this.hintText = this.scene.add.text(panelX, hintY, '💡 選擇塔建造', {
      fontSize: '13px',
      color: '#333333',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 170 },
      padding: { x: 2, y: 2 }
    }).setOrigin(0.5);
    this.hintText.setDepth(102);

    // 右上角速度控制按鈕 (只在單機模式下顯示)
    if (this.scene.gameMode === 'singlePlayer') {
      this.createSpeedControl();
    }
  }

  /**
   * 創建多人模式UI
   */
  createMultiplayerUI() {
    // 底部UI背景條
    const uiBar = this.scene.add.rectangle(0, 500, 1200, 100, 0xF5F5F5, 0.95)
      .setOrigin(0, 0)
      .setDepth(100)
      .setStrokeStyle(3, 0x000000, 1);

    // 基礎資訊顯示
    this.waveText = this.scene.add.text(20, 515, `🌊 波數: ${this.scene.waveManager.getCurrentWave()}`, {
      fontSize: '18px',
      color: '#3498DB',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
      padding: { x: 8, y: 5 }
    }).setDepth(101);

    this.goldText = this.scene.add.text(20, 545, `💰 ${this.scene.gold}`, {
      fontSize: '20px',
      color: '#F39C12',
      fontStyle: 'bold',
      padding: { x: 8, y: 5 },
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(101);

    this.livesText = this.scene.add.text(180, 545, `❤️ ${this.scene.lives}`, {
      fontSize: '20px',
      color: '#E74C3C',
      fontStyle: 'bold',
      padding: { x: 8, y: 5 },
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(101);

    this.opponentLivesText = this.scene.add.text(1180, 530, `對手 ❤️ ${this.scene.opponentLives}`, {
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
      this.scene.towerManager.createTowerButton(x, y, type, 60);
    });

    // 合成按鈕
    const craftButton = this.scene.add.rectangle(780, 550, 60, 60, 0xB565D8)
      .setStrokeStyle(3, 0x000000)
      .setInteractive({ useHandCursor: true });
    craftButton.setDepth(101);

    const craftIcon = this.scene.add.text(780, 540, '🔨', {
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    const craftLabel = this.scene.add.text(780, 565, '合成', {
      fontSize: '10px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    craftButton.on('pointerdown', () => this.scene.towerManager.toggleCraftMode());
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

    this.hintText = this.scene.add.text(950, 540, '💡 選擇基礎塔建造\n或點擊🔨進入合成模式', {
      fontSize: '14px',
      color: '#333333',
      padding: { x: 12, y: 8 },
      stroke: '#FFFFFF',
      strokeThickness: 3,
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(101);
  }

  /**
   * 更新UI文字
   */
  updateUI() {
    if (this.scene.gameMode === 'singlePlayer') {
      if (this.goldText) this.goldText.setText(`💰 金幣: ${this.scene.gold}`);
      if (this.livesText) this.livesText.setText(`❤️ 生命: ${this.scene.lives}`);
      if (this.waveText) this.waveText.setText(`🌊 波數: ${this.scene.waveManager.getCurrentWave()}`);
      if (this.scoreText) this.scoreText.setText(`⭐ 分數: ${this.scene.score}`);
    } else {
      if (this.goldText) this.goldText.setText(`💰 ${this.scene.gold}`);
      if (this.livesText) this.livesText.setText(`❤️ ${this.scene.lives}`);
      if (this.waveText) this.waveText.setText(`🌊 波數: ${this.scene.waveManager.getCurrentWave()}`);
      if (this.opponentLivesText) this.opponentLivesText.setText(`對手 ❤️ ${this.scene.opponentLives}`);
    }
  }

  /**
   * 顯示訊息
   */
  showMessage(text, color = 0x4ECDC4) {
    const message = this.scene.add.text(this.scene.cameras.main.width / 2, 30, text, {
      fontSize: '24px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      padding: { x: 5, y: 5 }
    }).setOrigin(0.5).setDepth(400);

    this.scene.tweens.add({
      targets: message,
      y: 20,
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => message.destroy()
    });
  }

  /**
   * 遊戲結束（單人模式）
   */
  showGameOver() {
    this.scene.isGameOver = true;
    this.scene.matchEnded = true;

    if (this.scene.waveManager.waveTimerEvent) {
      this.scene.waveManager.waveTimerEvent.remove(false);
      this.scene.waveManager.waveTimerEvent = null;
    }

    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.7
    ).setDepth(300);

    this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 100,
      '你已經失敗！',
      {
        fontSize: '48px',
        color: '#FF4444',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 10, y: 10 }
      }
    ).setOrigin(0.5).setDepth(301);

    this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      `最終分數: ${this.scene.score}`,
      {
        fontSize: '24px',
        color: '#FFD700',
        padding: { y: 10 }
      }
    ).setOrigin(0.5).setDepth(301);

    const buttonX = this.scene.cameras.main.width / 2;
    const buttonY = this.scene.cameras.main.height / 2 + 100;
    const restartButton = this.scene.add.rectangle(buttonX, buttonY, 200, 60, 0x4CAF50)
      .setStrokeStyle(3, 0xFFFFFF)
      .setInteractive({ useHandCursor: true })
      .setDepth(301);

    const buttonText = this.scene.add.text(buttonX, buttonY, '重新開始', {
      fontSize: '28px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(302);

    restartButton.on('pointerover', () => {
      restartButton.setFillStyle(0x5CD660);
      this.scene.tweens.add({ targets: restartButton, scale: 1.05, duration: 200 });
    });
    restartButton.on('pointerout', () => {
      restartButton.setFillStyle(0x4CAF50);
      this.scene.tweens.add({ targets: restartButton, scale: 1, duration: 200 });
    });
    restartButton.on('pointerdown', () => {
      this.scene.scene.restart({ mode: this.scene.gameMode });
    });
  }

  /**
   * 多人模式對戰結束
   */
  showMultiplayerMatchEnd({ victory, title, subtitle, notifyOpponent = false }) {
    if (this.scene.matchEnded) return;

    this.scene.matchEnded = true;
    this.scene.isGameOver = true;

    if (this.scene.waveManager.waveTimerEvent) {
      this.scene.waveManager.waveTimerEvent.remove(false);
      this.scene.waveManager.waveTimerEvent = null;
    }

    // 清理狀態同步
    if (this.scene.stateSyncInterval) {
      clearInterval(this.scene.stateSyncInterval);
      this.scene.stateSyncInterval = null;
    }

    // 通知對手（如果需要）
    if (notifyOpponent && this.scene.roomId) {
      const SocketService = require('../services/SocketService.js').default;
      if (SocketService.socket) {
        SocketService.emit('opponent-defeated', { roomId: this.scene.roomId });
      }
    }

    // 創建結果覆蓋層
    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.8
    ).setDepth(500);

    const titleColor = victory ? '#4CAF50' : '#E74C3C';
    const titleText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 80,
      title,
      {
        fontSize: '48px',
        color: titleColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
        padding: { x: 10, y: 10 }
      }
    ).setOrigin(0.5).setDepth(501);

    const subtitleText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 10,
      subtitle,
      {
        fontSize: '20px',
        color: '#FFFFFF',
        padding: { y: 10 }
      }
    ).setOrigin(0.5).setDepth(501);

    const buttonX = this.scene.cameras.main.width / 2;
    const buttonY = this.scene.cameras.main.height / 2 + 80;
    const returnButton = this.scene.add.rectangle(buttonX, buttonY, 220, 60, 0x3498DB)
      .setStrokeStyle(3, 0xFFFFFF)
      .setInteractive({ useHandCursor: true })
      .setDepth(501);

    const buttonText = this.scene.add.text(buttonX, buttonY, '回到主選單', {
      fontSize: '24px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(502);

    returnButton.on('pointerover', () => {
      returnButton.setFillStyle(0x5DADE2);
      this.scene.tweens.add({ targets: returnButton, scale: 1.05, duration: 200 });
    });
    returnButton.on('pointerout', () => {
      returnButton.setFillStyle(0x3498DB);
      this.scene.tweens.add({ targets: returnButton, scale: 1, duration: 200 });
    });
    returnButton.on('pointerdown', () => {
      this.scene.scene.start('MenuScene');
    });

    this.scene.multiplayerResultOverlay = {
      overlay,
      titleText,
      subtitleText,
      returnButton,
      buttonText
    };
  }

  /**
   * 創建右上角速度控制
   */
  createSpeedControl() {
    // 右上角位置計算
    const buttonWidth = 120;
    const buttonHeight = 35;
    const margin = 20;
    const buttonX = this.scene.cameras.main.width - margin - (buttonWidth / 2);
    const buttonY = margin + (buttonHeight / 2);

    // 速度控制按鈕
    this.speedButton = this.scene.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0x27AE60)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true });
    this.speedButton.setDepth(150); // 較高深度確保在最上層

    this.speedText = this.scene.add.text(buttonX, buttonY, '⚡ 速度: 1x', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.speedText.setDepth(151);

    // 添加半透明背景
    const bgPadding = 5;
    this.speedBg = this.scene.add.rectangle(
      buttonX, buttonY,
      buttonWidth + bgPadding * 2,
      buttonHeight + bgPadding * 2,
      0x000000, 0.3
    );
    this.speedBg.setDepth(149);

    // 按鈕事件
    this.speedButton.on('pointerdown', () => this.toggleGameSpeed());
    this.speedButton.on('pointerover', () => {
      this.speedButton.setFillStyle(0x2ECC71);
      this.speedButton.setScale(1.05);
      this.speedText.setScale(1.05);
    });
    this.speedButton.on('pointerout', () => {
      this.speedButton.setFillStyle(this.getSpeedButtonColor());
      this.speedButton.setScale(1);
      this.speedText.setScale(1);
    });
  }

  /**
   * 獲取當前速度對應的按鈕顏色
   */
  getSpeedButtonColor() {
    switch (this.gameSpeed) {
      case 1: return 0x27AE60; // 綠色 - 正常速度
      case 2: return 0xF39C12; // 橙色 - 2倍速
      case 4: return 0xE74C3C; // 紅色 - 4倍速
      default: return 0x27AE60;
    }
  }

  /**
   * 切換遊戲速度 (1x -> 2x -> 4x -> 1x)
   */
  toggleGameSpeed() {
    // 只在單機模式下允許調整速度
    if (this.scene.gameMode !== 'singlePlayer') return;

    switch (this.gameSpeed) {
      case 1:
        this.gameSpeed = 2;
        break;
      case 2:
        this.gameSpeed = 4;
        break;
      case 4:
        this.gameSpeed = 1;
        break;
      default:
        this.gameSpeed = 1;
    }

    // 更新UI文字
    if (this.speedText) {
      this.speedText.setText(`⚡ 速度: ${this.gameSpeed}x`);
    }

    // 更新按鈕顏色以反映當前速度
    if (this.speedButton) {
      this.speedButton.setFillStyle(this.getSpeedButtonColor());
    }

    // 應用速度到遊戲引擎 - Phaser 會自動處理依賴 timeScale 的系統 (包含 Timer Event)
    this.scene.physics.world.timeScale = this.gameSpeed;
    this.scene.time.timeScale = this.gameSpeed;
    this.scene.gameSpeedMultiplier = this.gameSpeed;

    // 重置所有塔的攻擊計時，避免時間縮放衝突
    if (this.scene.playerTowers) {
      this.scene.playerTowers.forEach(tower => {
        if (tower) {
          tower.lastFired = 0; // 重置攻擊計時，讓塔能立即適應新的時間縮放
        }
      });
    }

    // 顯示速度變更提示
    this.showMessage(`⚡ 遊戲速度: ${this.gameSpeed}x`, 0x2ECC71);
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.goldText = null;
    this.livesText = null;
    this.waveText = null;
    this.scoreText = null;
    this.hintText = null;
    this.opponentLivesText = null;
    this.matchStatusText = null;
    this.speedButton = null;
    this.speedText = null;
    this.speedBg = null;
  }
}
