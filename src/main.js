import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#2d5016',
  scene: [MainMenuScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  pixelArt: true,
  antialias: false
};

const game = new Phaser.Game(config);

// 導出遊戲實例
export default game;
