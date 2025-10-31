export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#A8D54F');

    // 遊戲標題
    this.add.text(this.cameras.main.width / 2, 150, 'Pixel Tower Defense', {
      fontSize: '48px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    // 單人遊戲按鈕
    const singlePlayerButton = this.createButton(this.cameras.main.height / 2, '單人遊戲');
    singlePlayerButton.on('pointerdown', () => {
      this.scene.start('GameScene', { mode: 'singlePlayer' });
    });

    // 多人對戰按鈕
    const multiplayerButton = this.createButton(this.cameras.main.height / 2 + 100, '多人對戰');
    multiplayerButton.on('pointerdown', () => {
      // 目前多人模式會顯示一個開發中的提示
      this.scene.start('GameScene', { mode: 'multiplayer' });
    });
  }

  createButton(y, text) {
    const button = this.add.rectangle(this.cameras.main.width / 2, y, 300, 70, 0x4CAF50)
      .setStrokeStyle(4, 0xFFFFFF)
      .setInteractive({ useHandCursor: true });

    this.add.text(this.cameras.main.width / 2, y, text, {
      fontSize: '28px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);

    button.on('pointerover', () => {
      button.setFillStyle(0x5CD660);
      this.tweens.add({ targets: button, scale: 1.05, duration: 150 });
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x4CAF50);
      this.tweens.add({ targets: button, scale: 1, duration: 150 });
    });

    return button;
  }
}
