import Tower from '../entities/Tower.js';
import Enemy from '../entities/Enemy.js';
import { TowerConfig, TowerTypes, canCraftTower, canCraftThreeTowers } from '../config/towerConfig.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // 遊戲狀態
    this.gold = 500;
    this.lives = 2;
    this.wave = 0;
    this.score = 0;

    // 遊戲物件陣列
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];

    // 選擇狀態
    this.selectedTower = null;
    this.selectedTowerObject = null;
    this.previewTower = null;
    this.mapBounds = null;

    // 合成模式
    this.craftMode = false;
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;

    // Boss挑戰系統
    this.bossDefeated = false; // 是否打敗過王
    this.bonusEnemiesPerWave = 0; // 每波額外怪物數量

    this.pathCollisionRadius = 45;
    this.isGameOver = false;
  }

  preload() {
    // 創建粒子紋理
    const graphics = this.add.graphics();
    graphics.fillStyle(0xFFFFFF);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();
  }

  create() {
    // 設置明亮的背景
    this.cameras.main.setBackgroundColor('#A8D54F');

    // 創建佈局區域
    this.createLayout();

    // 創建路徑
    this.createPath();

    // 創建可建造區域
    this.createBuildableAreas();

    // 創建UI
    this.createUI();

    // 開始第一波（增加準備時間到10秒）
    this.time.delayedCall(10000, () => this.startWave());
  }

  createLayout() {
    // 右側地圖區域背景（先繪製，作為底層）
    const mapBg = this.add.rectangle(220, 0, 980, 600, 0xBCE95A, 1);
    mapBg.setOrigin(0, 0);
    mapBg.setStrokeStyle(4, 0x000000, 1);
    mapBg.setDepth(1); // 設置為底層，但仍顯示邊框

    // 左側UI區域背景
    const leftPanel = this.add.rectangle(0, 0, 220, 600, 0xF5F5F5, 1);
    leftPanel.setOrigin(0, 0);
    leftPanel.setStrokeStyle(3, 0x000000);
    leftPanel.setDepth(100); // UI層級較高

    // 標題
    const title = this.add.text(110, 20, '資訊及功能區', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding:{x:2,y:4}
    }).setOrigin(0.5);
    title.setDepth(101);

    // 分隔線
    const divider = this.add.graphics();
    divider.lineStyle(3, 0x000000, 1);
    divider.lineBetween(220, 0, 220, 600);
    divider.setDepth(100);

    // 地圖區域標題
    const mapTitle = this.add.text(240, 20, '地圖區', {
      fontSize: '18px',
      color: '#1B1B1B',
      fontStyle: 'bold'
    }).setOrigin(0, 0);
    mapTitle.setDepth(102);
  }

  createPath() {
    // 依照提供的座標繪製等寬回字形路徑
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

    this.path = sampledPoints.map(point => ({
      x: point.x,
      y: point.y
    }));

    const baseGraphics = this.add.graphics();
    baseGraphics.setDepth(3);
    baseGraphics.lineStyle(baseWidth, 0xA8D74E, 1, 'round', 'round');
    baseGraphics.strokePoints(sampledPoints, false);

    const pathGraphics = this.add.graphics();
    pathGraphics.setDepth(4);
    pathGraphics.lineStyle(pathWidth, 0xFFFFFF, 1, 'round', 'round');
    pathGraphics.strokePoints(sampledPoints, false);

    const edgeGraphics = this.add.graphics();
    edgeGraphics.setDepth(4);
    edgeGraphics.fillStyle(0xFFFFFF, 1);

    const addWave = (pointIndex) => {
      const current = sampledPoints[pointIndex];
      const prev =
        sampledPoints[Math.max(pointIndex - 1, 0)];
      const next =
        sampledPoints[Math.min(pointIndex + 1, sampledPoints.length - 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
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

    // 起點標記（出怪）- 使用箭頭指示
    const startPoint = this.path[0];
    const startCircle = this.add.circle(startPoint.x, startPoint.y, 34, 0x000000, 1);
    startCircle.setStrokeStyle(6, 0xFFFFFF);
    startCircle.setDepth(5);

    const startDirection = Math.atan2(
      this.path[1].y - startPoint.y,
      this.path[1].x - startPoint.x
    );
    this.drawArrow(startPoint.x, startPoint.y, startDirection, 0xFFFFFF, 6);
    this.add.text(startPoint.x, startPoint.y + 46, '出怪', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(6);

    // 終點標記（出口）- 使用箭頭指示
    const endPoint = this.path[this.path.length - 1];
    const endCircle = this.add.circle(endPoint.x, endPoint.y, 34, 0x000000, 1);
    endCircle.setStrokeStyle(6, 0xFFFFFF);
    endCircle.setDepth(5);

    const endDirection = Math.atan2(
      endPoint.y - this.path[this.path.length - 2].y,
      endPoint.x - this.path[this.path.length - 2].x
    );
    this.drawArrow(endPoint.x, endPoint.y, endDirection, 0xFFFFFF, 6);
    this.add.text(endPoint.x, endPoint.y + 46, '出口', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(6);
  }

  createBuildableAreas() {
    // 創建可建造區域背景，保持與設計稿一致的柔和色塊
    const graphics = this.add.graphics();
    graphics.setDepth(2); // 在地圖層上方
    graphics.fillStyle(0xC9F270, 0.6);
    graphics.fillRoundedRect(250, 40, 920, 520, 36);

    this.mapBounds = {
      left: 250,
      right: 1170,
      top: 40,
      bottom: 560
    };
  }

  drawArrow(x, y, angle, color, depth) {
    // 創建箭頭圖形
    const arrowGraphics = this.add.graphics();
    arrowGraphics.setDepth(depth);

    // 設置顏色
    arrowGraphics.fillStyle(color, 1);
    arrowGraphics.lineStyle(2, 0x000000, 1);

    // 箭頭尺寸
    const arrowLength = 18;
    const arrowWidth = 12;

    // 計算箭頭的三個頂點（相對於原點）
    const tipX = arrowLength / 2;
    const tipY = 0;
    const leftX = -arrowLength / 2;
    const leftY = -arrowWidth / 2;
    const rightX = -arrowLength / 2;
    const rightY = arrowWidth / 2;

    // 旋轉並平移到正確位置
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const tip = {
      x: x + tipX * cos - tipY * sin,
      y: y + tipX * sin + tipY * cos
    };
    const left = {
      x: x + leftX * cos - leftY * sin,
      y: y + leftX * sin + leftY * cos
    };
    const right = {
      x: x + rightX * cos - rightY * sin,
      y: y + rightX * sin + rightY * cos
    };

    // 繪製箭頭三角形
    arrowGraphics.beginPath();
    arrowGraphics.moveTo(tip.x, tip.y);
    arrowGraphics.lineTo(left.x, left.y);
    arrowGraphics.lineTo(right.x, right.y);
    arrowGraphics.closePath();
    arrowGraphics.fillPath();
    arrowGraphics.strokePath();

    return arrowGraphics;
  }

  createUI() {
    // === 左側面板UI - 整齊排版 ===
    const panelX = 110; // 面板中心X軸
    const panelWidth = 190;

    // 1. 資源顯示區域
    const resourceY = 60;
    const resourceTitle = this.add.text(panelX, resourceY, '📊 遊戲資源', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 4, y: 4 }  // 添加內邊距防止文字被切
    }).setOrigin(0.5);
    resourceTitle.setDepth(101);

    // 資源背景框
    const resourceBg = this.add.rectangle(panelX, resourceY + 70, panelWidth, 110, 0xFFFFFF, 1);
    resourceBg.setStrokeStyle(2, 0xCCCCCC);
    resourceBg.setDepth(100);

    // 資源文字 - 左對齊
    const textStartX = 25;
    this.goldText = this.add.text(textStartX, resourceY + 25, `💰 金幣: ${this.gold}`, {
      fontSize: '15px',
      color: '#F39C12',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }  // 添加內邊距防止文字被切
    });
    this.goldText.setDepth(102);

    this.livesText = this.add.text(textStartX, resourceY + 50, `❤️ 生命: ${this.lives}`, {
      fontSize: '15px',
      color: '#E74C3C',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }  // 添加內邊距防止文字被切
    });
    this.livesText.setDepth(102);

    this.waveText = this.add.text(textStartX, resourceY + 75, `🌊 波數: ${this.wave}`, {
      fontSize: '15px',
      color: '#3498DB',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }  // 添加內邊距防止文字被切
    });
    this.waveText.setDepth(102);

    this.scoreText = this.add.text(textStartX, resourceY + 100, `⭐ 分數: ${this.score}`, {
      fontSize: '15px',
      color: '#9B59B6',
      fontStyle: 'bold',
      padding: { x: 2, y: 2 }  // 添加內邊距防止文字被切
    });
    this.scoreText.setDepth(102);

    // 2. 塔選擇區域
    const towerY = 210;
    const towerTitle = this.add.text(panelX, towerY, '🏰 基礎塔', {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold',
      padding: { x: 4, y: 4 }  // 添加內邊距防止文字被切
    }).setOrigin(0.5);
    towerTitle.setDepth(101);

    // 基礎塔按鈕（2x2網格，置中且留有間距）
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

    // 3. 取消選擇按鈕
    const cancelY = towerY + 230;
    const cancelButton = this.add.rectangle(panelX, cancelY, panelWidth - 10, 40, 0xFF6B6B)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    cancelButton.setDepth(101);

    const cancelText = this.add.text(panelX, cancelY, '❌ 取消選擇', {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    cancelText.setDepth(102);

    cancelButton.on('pointerdown', () => this.cancelTowerSelection());
    cancelButton.on('pointerover', () => {
      cancelButton.setFillStyle(0xFF8E8E);
      cancelButton.setScale(1.05);
    });
    cancelButton.on('pointerout', () => {
      cancelButton.setFillStyle(0xFF6B6B);
      cancelButton.setScale(1);
    });

    // 4. 合成按鈕
    const craftY = towerY + 280;
    const craftButton = this.add.rectangle(panelX, craftY, panelWidth - 10, 50, 0xB565D8)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    craftButton.setDepth(101);

    const craftText = this.add.text(panelX, craftY, '🔨 合成塔', {
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    craftText.setDepth(102);

    craftButton.on('pointerdown', () => this.toggleCraftMode());
    craftButton.on('pointerover', () => {
      craftButton.setFillStyle(0xC67EE8);
      craftButton.setScale(1.05);
    });
    craftButton.on('pointerout', () => {
      craftButton.setFillStyle(0xB565D8);
      craftButton.setScale(1);
    });

    // 5. 提示訊息區域（底部）
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
      padding: { x: 2, y: 2 }  // 添加內邊距防止文字被切
    }).setOrigin(0.5);
    this.hintText.setDepth(102);

    // 滑鼠點擊事件
    this.input.on('pointerdown', (pointer) => this.handleMapClick(pointer));
    this.input.on('pointermove', (pointer) => this.handleMouseMove(pointer));
  }

  createTowerButton(x, y, towerType, size = 70) {
    const config = TowerConfig[towerType];

    const button = this.add.rectangle(x, y, size, size, config.color)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    button.setDepth(101);

    const emoji = this.add.text(x, y - 10, config.emoji, {
      fontSize: '26px'
    }).setOrigin(0.5);
    emoji.setDepth(102);

    const costText = this.add.text(x, y + 20, `$${config.cost}`, {
      fontSize: '13px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    costText.setDepth(102);

    button.on('pointerdown', () => this.selectTower(towerType));
    button.on('pointerover', () => {
      button.setStrokeStyle(4, 0xFFFF00);
      button.setScale(1.1);
      this.showTowerTooltip(config, x + 80, y);
    });
    button.on('pointerout', () => {
      button.setStrokeStyle(3, 0x000000);
      button.setScale(1);
      this.hideTooltip();
    });
  }

  showTowerTooltip(config, x, y) {
    if (this.tooltip) this.tooltip.destroy();

    const text = `${config.name}\n💰${config.cost} 💥${config.damage}\n📏${config.range}\n${config.description}`;
    this.tooltip = this.add.text(x, y, text, {
      fontSize: '12px',
      color: '#FFFFFF',
      backgroundColor: '#1a1a1a',
      padding: { x: 8, y: 6 },
      fontStyle: 'bold',
      align: 'left'
    }).setOrigin(0, 0.5);
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

    this.hintText.setText(`✅ 已選擇\n${config.emoji} ${config.name}\n點擊地圖建造`);
  }

  cancelTowerSelection() {
    this.selectedTower = null;
    this.hintText.setText('💡 選擇塔建造');

    // 關閉升級面板和隱藏塔範圍
    this.hideUpgradePanel();
    if (this.selectedTowerObject) {
      // 檢查塔對象是否仍然有效
      if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
        this.selectedTowerObject.hideRange();
      }
      this.selectedTowerObject = null;
    }

    // 退出合成模式
    if (this.craftMode) {
      this.craftMode = false;
      this.clearCraftSelection();
    }
  }

  toggleCraftMode() {
    this.craftMode = !this.craftMode;
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;

    if (this.craftMode) {
      this.hintText.setText('🔨 合成模式\n點擊2-3座塔\n進行合成');
      this.showMessage('🔨 進入合成模式', 0xB565D8);
    } else {
      this.hintText.setText('💡 退出\n合成模式');
      this.clearCraftSelection();
    }
  }

  handleMapClick(pointer) {
    const x = pointer.x;
    const y = pointer.y;

    // 左側UI區域不處理
    if (x < 220) return;

    // 檢查是否點擊現有塔
    const clickedTower = this.towers.find(tower =>
      Phaser.Math.Distance.Between(x, y, tower.x, tower.y) < 25
    );

    if (clickedTower) {
      if (this.craftMode) {
        this.selectTowerForCraft(clickedTower);
      } else {
        this.showTowerInfo(clickedTower);
      }
      return;
    }

    // 點擊空白處：關閉升級面板並隱藏塔範圍
    if (this.upgradePanel) {
      this.hideUpgradePanel();
      if (this.selectedTowerObject) {
        if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
          this.selectedTowerObject.hideRange();
        }
        this.selectedTowerObject = null;
      }
    }

    // 建造塔
    if (this.selectedTower && !this.craftMode) {
      this.buildTower(x, y, this.selectedTower);
    }
  }

  buildTower(x, y, towerType) {
    const config = TowerConfig[towerType];

    // 檢查金幣
    if (this.gold < config.cost) {
      this.showMessage('💸 金幣不足！', 0xFF0000);
      return;
    }

    const placement = this.getPlacementStatus(x, y);
    if (!placement.valid) {
      this.showMessage(placement.reason, 0xFF0000);
      return;
    }

    // 建造塔
    const tower = new Tower(this, x, y, towerType);
    this.towers.push(tower);

    this.gold -= config.cost;
    this.updateUI();

    this.selectedTower = null;
    this.hintText.setText(`✅ 建造成功\n${config.emoji}\n${config.name}`);

    if (this.previewTower) {
      if (this.previewTower.circle) this.previewTower.circle.destroy();
      if (this.previewTower.range) this.previewTower.range.destroy();
      if (this.previewTower.dot) this.previewTower.dot.destroy();
      this.previewTower = null;
    }

    // 建造特效
    this.createBuildEffect(x, y, config.color);
  }

  selectTowerForCraft(tower) {
    if (!this.craftTower1) {
      this.craftTower1 = tower;
      tower.showRange();
      this.hintText.setText(`🔨 已選第一座\n${tower.config.emoji}\n選第二座`);
    } else if (!this.craftTower2) {
      // 檢查是否選擇同一座塔
      if (tower === this.craftTower1) {
        this.showMessage('❌ 不能選擇同一座塔！', 0xFF0000);
        this.hintText.setText(`⚠️ 請選擇\n不同的塔\n進行合成`);
        return;
      }

      this.craftTower2 = tower;
      tower.showRange();

      // 先嘗試兩塔合成
      const twoTowerResult = canCraftTower(this.craftTower1.type, this.craftTower2.type);
      if (twoTowerResult) {
        this.attemptCraft();
      } else {
        // 如果兩塔無法合成，提示選擇第三座
        this.hintText.setText(`🔨 已選兩座\n${this.craftTower1.config.emoji}${this.craftTower2.config.emoji}\n選第三座或重選`);
      }
    } else if (!this.craftTower3) {
      // 檢查是否選擇同一座塔
      if (tower === this.craftTower1 || tower === this.craftTower2) {
        this.showMessage('❌ 不能選擇同一座塔！', 0xFF0000);
        return;
      }

      this.craftTower3 = tower;
      tower.showRange();
      this.attemptCraft();
    } else {
      // 重置選擇
      this.clearCraftSelection();
      this.craftTower1 = tower;
      tower.showRange();
      this.hintText.setText(`🔨 已選第一座\n${tower.config.emoji}\n選第二座`);
    }
  }

  attemptCraft() {
    let newTowerType = null;
    let towersToRemove = [];
    let newX, newY;

    // 嘗試三塔合成
    if (this.craftTower3) {
      newTowerType = canCraftThreeTowers(
        this.craftTower1.type,
        this.craftTower2.type,
        this.craftTower3.type
      );

      if (!newTowerType) {
        this.showMessage('❌ 這三座塔無法合成！', 0xFF0000);
        this.clearCraftSelection();
        return;
      }

      towersToRemove = [this.craftTower1, this.craftTower2, this.craftTower3];
      newX = this.craftTower2.x;
      newY = this.craftTower2.y;
    } else {
      // 嘗試兩塔合成
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

    // 先隱藏範圍圈並計算最低等級
    let inheritLevel = Infinity;
    for (const tower of towersToRemove) {
      if (tower.sprite && tower.sprite.active) tower.hideRange();
      inheritLevel = Math.min(inheritLevel, tower.level);
    }

    // 從陣列中移除塔（按索引從大到小移除）
    const indices = towersToRemove
      .map(tower => this.towers.indexOf(tower))
      .filter(index => index !== -1)
      .sort((a, b) => b - a);

    for (const index of indices) {
      this.towers.splice(index, 1);
    }

    // 銷毀舊塔的視覺元素
    for (const tower of towersToRemove) {
      tower.destroy();
    }

    // 創建新塔
    const newTower = new Tower(this, newX, newY, newTowerType);
    this.towers.push(newTower);

    // 繼承最低等級（無需消耗金幣）
    if (inheritLevel > 1) {
      for (let i = 1; i < inheritLevel; i++) {
        newTower.upgrade();
      }
    }

    // 合成特效
    this.createCraftEffect(newX, newY, newConfig.color);
    this.showMessage(`🎉 成功合成 ${newConfig.emoji} ${newConfig.name}！Lv.${inheritLevel}`, 0xFFD700);

    // 清理狀態
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;
    this.craftMode = false;
    this.hintText.setText(`🎉 合成成功\n${newConfig.emoji}\n${newConfig.name}`);
  }

  clearCraftSelection() {
    if (this.craftTower1) {
      if (this.craftTower1.sprite && this.craftTower1.sprite.active) {
        this.craftTower1.hideRange();
      }
    }
    if (this.craftTower2) {
      if (this.craftTower2.sprite && this.craftTower2.sprite.active) {
        this.craftTower2.hideRange();
      }
    }
    if (this.craftTower3) {
      if (this.craftTower3.sprite && this.craftTower3.sprite.active) {
        this.craftTower3.hideRange();
      }
    }
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;
  }

  isOnPath(x, y) {
    const threshold = Math.max(30, (this.pathCollisionRadius || 45) - 5);
    for (let i = 0; i < this.path.length - 1; i++) {
      const p1 = this.path[i];
      const p2 = this.path[i + 1];

      const distance = this.distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (distance < threshold) return true;
    }
    return false;
  }

  getPlacementStatus(x, y) {
    if (!this.mapBounds) {
      return { valid: true };
    }

    const margin = 12;
    const { left, right, top, bottom } = this.mapBounds;
    if (x < left + margin || x > right - margin || y < top + margin || y > bottom - margin) {
      return { valid: false, reason: '🚧 超出可建造範圍！' };
    }

    if (this.isOnPath(x, y)) {
      return { valid: false, reason: '🚫 不能在路徑上建造！' };
    }

    const minDistance = 55;
    const tooClose = this.towers.some(tower =>
      Phaser.Math.Distance.Between(x, y, tower.x, tower.y) < minDistance
    );

    if (tooClose) {
      return { valid: false, reason: '⚠️ 塔太靠近了！' };
    }

    return { valid: true };
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;

    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  handleMouseMove(pointer) {
    // 只在地圖區域顯示預覽
    if (this.selectedTower && !this.craftMode && pointer.x >= 220) {
      const config = TowerConfig[this.selectedTower];
      const status = this.getPlacementStatus(pointer.x, pointer.y);
      const valid = status.valid;

      // 顯示塔的預覽
      if (!this.previewTower) {
        this.previewTower = {
          circle: this.add.circle(pointer.x, pointer.y, 20, config.color, 0.5),
          range: this.add.circle(pointer.x, pointer.y, config.range, config.effectColor, 0.1)
            .setStrokeStyle(2, config.effectColor, 0.3),
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

      const fillColor = valid ? config.color : 0xE74C3C;
      const fillAlpha = valid ? 0.35 : 0.4;
      this.previewTower.circle.setFillStyle(fillColor, fillAlpha);

      const strokeColor = valid ? config.effectColor : 0xE74C3C;
      const strokeAlpha = valid ? 0.35 : 0.7;
      this.previewTower.range.setStrokeStyle(2, strokeColor, strokeAlpha);

      this.previewTower.dot.setFillStyle(valid ? 0xFFFFFF : 0xFFCDD2, 1);
      this.previewTower.dot.setStrokeStyle(2, valid ? 0x2ECC71 : 0xC0392B, valid ? 0.7 : 0.9);
    } else if (this.previewTower) {
      this.previewTower.circle.destroy();
      this.previewTower.range.destroy();
      if (this.previewTower.dot) this.previewTower.dot.destroy();
      this.previewTower = null;
    }
  }

  showTowerInfo(tower) {
    // 檢查塔是否有效
    if (!tower || !tower.sprite || !tower.sprite.active) {
      return;
    }

    // 先關閉之前的升級面板
    this.hideUpgradePanel();

    // 如果之前有選中的塔，隱藏其範圍
    if (this.selectedTowerObject && this.selectedTowerObject !== tower) {
      // 檢查之前選中的塔是否仍然有效
      if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
        this.selectedTowerObject.hideRange();
      }
    }

    this.selectedTowerObject = tower;
    tower.showRange();

    const info = tower.getInfo();
    this.hintText.setText(`📊 ${tower.config.emoji}\n${info.name}\n💥${info.damage} 📏${info.range}`);

    // 顯示升級UI
    this.showUpgradePanel(tower);
  }

  showUpgradePanel(tower) {
    // 確保沒有舊的升級面板（由showTowerInfo已經調用過，這裡是雙重保險）
    if (this.upgradePanel) {
      this.hideUpgradePanel();
    }

    const info = tower.getInfo();
    const upgradeCost = Math.floor(tower.config.cost * 0.6); // 升級成本為建造成本的60%

    // 計算等級限制
    const maxAllowedLevel = Math.floor(this.wave / 5);
    const isLevelCapped = tower.level >= maxAllowedLevel;
    const nextUnlockWave = (tower.level + 1) * 5;

    // 升級面板背景
    const panelX = tower.x;
    const panelY = tower.y - 80;
    const panelWidth = 160;
    const panelHeight = 130; // 增加高度以容納等級限制信息

    this.upgradePanel = {};

    // 使用更高的深度層級，確保UI在所有元素之上
    const BASE_DEPTH = 200;

    // 背景
    this.upgradePanel.bg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2C3E50, 0.95);
    this.upgradePanel.bg.setStrokeStyle(3, 0xFFD700);
    this.upgradePanel.bg.setDepth(BASE_DEPTH);
    this.upgradePanel.bg.setInteractive(); // 背景也設為可互動，防止點擊穿透
    // 阻止點擊穿透
    this.upgradePanel.bg.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
    });

    // 塔名稱
    this.upgradePanel.title = this.add.text(panelX, panelY - 50, `${info.name}`, {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.upgradePanel.title.setDepth(BASE_DEPTH + 1);

    // 等級顯示（顯示當前等級和等級上限）
    const levelText = isLevelCapped
      ? `等級: ${info.level} (上限)`
      : `等級: ${info.level}/${maxAllowedLevel}`;
    this.upgradePanel.level = this.add.text(panelX, panelY - 33, levelText, {
      fontSize: '12px',
      color: isLevelCapped ? '#FF6B6B' : '#FFD700'
    }).setOrigin(0.5);
    this.upgradePanel.level.setDepth(BASE_DEPTH + 1);

    // 等級限制提示
    if (isLevelCapped) {
      this.upgradePanel.levelHint = this.add.text(panelX, panelY - 18, `⏳ 第${nextUnlockWave}波解鎖`, {
        fontSize: '10px',
        color: '#FFA500'
      }).setOrigin(0.5);
      this.upgradePanel.levelHint.setDepth(BASE_DEPTH + 1);
    }

    // 屬性顯示
    const statsText = `💥 ${Math.floor(info.damage)} | 📏 ${Math.floor(info.range)}`;
    this.upgradePanel.stats = this.add.text(panelX, panelY - 3, statsText, {
      fontSize: '11px',
      color: '#FFFFFF'
    }).setOrigin(0.5);
    this.upgradePanel.stats.setDepth(BASE_DEPTH + 1);

    // 升級按鈕
    const buttonY = panelY + 25;
    const buttonColor = isLevelCapped ? 0x7F8C8D : 0x27AE60; // 達到上限時灰色
    this.upgradePanel.upgradeButton = this.add.rectangle(panelX, buttonY, 130, 35, buttonColor)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true });
    this.upgradePanel.upgradeButton.setDepth(BASE_DEPTH + 2);

    const buttonText = isLevelCapped ? `🔒 已達上限` : `⬆️ 升級 ($${upgradeCost})`;
    this.upgradePanel.upgradeText = this.add.text(panelX, buttonY, buttonText, {
      fontSize: '13px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.upgradePanel.upgradeText.setDepth(BASE_DEPTH + 3);

    // 升級按鈕事件（只在未達上限時響應）
    if (!isLevelCapped) {
      this.upgradePanel.upgradeButton.on('pointerover', () => {
        if (this.upgradePanel && this.upgradePanel.upgradeButton) {
          this.upgradePanel.upgradeButton.setFillStyle(0x2ECC71);
          this.upgradePanel.upgradeButton.setScale(1.05);
        }
      });
      this.upgradePanel.upgradeButton.on('pointerout', () => {
        if (this.upgradePanel && this.upgradePanel.upgradeButton) {
          this.upgradePanel.upgradeButton.setFillStyle(0x27AE60);
          this.upgradePanel.upgradeButton.setScale(1);
        }
      });
      this.upgradePanel.upgradeButton.on('pointerdown', (pointer) => {
        pointer.event.stopPropagation(); // 阻止事件穿透
        this.upgradeTower(tower, upgradeCost);
      });
    } else {
      // 達到上限時點擊顯示提示
      this.upgradePanel.upgradeButton.on('pointerdown', (pointer) => {
        pointer.event.stopPropagation(); // 阻止事件穿透
        this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升級！`, 0xFFA500);
      });
    }

    // 關閉按鈕 - 最高深度層級確保不被遮擋
    const closeY = panelY + 55; // 調整位置以適應更高的面板
    this.upgradePanel.closeButton = this.add.rectangle(panelX, closeY, 60, 25, 0xE74C3C)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true });
    this.upgradePanel.closeButton.setDepth(BASE_DEPTH + 4); // 最高深度確保在最上層

    this.upgradePanel.closeText = this.add.text(panelX, closeY, '❌ 關閉', {
      fontSize: '11px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.upgradePanel.closeText.setDepth(BASE_DEPTH + 5); // 最高深度確保在最上層
    this.upgradePanel.closeText.setInteractive({ useHandCursor: true }); // 文字也設為可互動

    // 關閉按鈕懸停效果
    this.upgradePanel.closeButton.on('pointerover', () => {
      if (this.upgradePanel && this.upgradePanel.closeButton) {
        this.upgradePanel.closeButton.setFillStyle(0xC0392B);
      }
    });
    this.upgradePanel.closeButton.on('pointerout', () => {
      if (this.upgradePanel && this.upgradePanel.closeButton) {
        this.upgradePanel.closeButton.setFillStyle(0xE74C3C);
      }
    });

    // 關閉按鈕點擊事件
    this.upgradePanel.closeButton.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation(); // 阻止事件穿透
      const selectedTower = this.selectedTowerObject;
      this.hideUpgradePanel();
      if (selectedTower) {
        if (selectedTower.sprite && selectedTower.sprite.active) {
          selectedTower.hideRange();
        }
        this.selectedTowerObject = null;
      }
    });

    // 關閉按鈕文字也綁定點擊事件（雙重保險）
    this.upgradePanel.closeText.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation(); // 阻止事件穿透
      const selectedTower = this.selectedTowerObject;
      this.hideUpgradePanel();
      if (selectedTower) {
        if (selectedTower.sprite && selectedTower.sprite.active) {
          selectedTower.hideRange();
        }
        this.selectedTowerObject = null;
      }
    });
  }

  hideUpgradePanel() {
    if (this.upgradePanel) {
      // 移除所有事件監聽器並銷毀對象
      Object.values(this.upgradePanel).forEach(obj => {
        if (obj && obj.destroy) {
          // 如果是可交互對象，先移除所有監聽器
          if (obj.removeAllListeners) {
            obj.removeAllListeners();
          }
          obj.destroy();
        }
      });
      this.upgradePanel = null;
    }
  }

  upgradeTower(tower, cost) {
    // 計算當前允許的最大等級（每5波開放1級）
    const maxAllowedLevel = Math.floor(this.wave / 5);

    // 檢查是否達到等級上限
    if (tower.level >= maxAllowedLevel) {
      const nextUnlockWave = (tower.level + 1) * 5;
      this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升到${tower.level + 1}級！`, 0xFFA500);
      return;
    }

    // 檢查金幣
    if (this.gold < cost) {
      this.showMessage('💸 金幣不足，無法升級！', 0xFF0000);
      return;
    }

    // 扣除金幣
    this.gold -= cost;
    this.updateUI();

    // 升級塔
    tower.upgrade();

    // 顯示升級成功訊息
    this.showMessage(`✨ ${tower.config.emoji} 升級成功！`, 0xFFD700);

    // 更新升級面板
    this.hideUpgradePanel();
    this.showUpgradePanel(tower);

    // 升級特效
    this.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);
  }

  createUpgradeEffect(x, y, color) {
    // 星星爆炸效果
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 80, max: 150 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xFFD700, 0xFFFFFF],
      lifespan: 600,
      quantity: 20,
      blendMode: 'ADD'
    });

    this.time.delayedCall(600, () => particles.destroy());

    // 光環效果
    const ring = this.add.circle(x, y, 10, color, 0.6);
    ring.setDepth(100);

    this.tweens.add({
      targets: ring,
      radius: 60,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });
  }

  startWave() {
    this.wave++;
    this.updateUI();

    // 檢查是否為BOSS波（每10波）
    const isBossWave = (this.wave % 10 === 0);

    if (isBossWave) {
      // BOSS波：只生成一個大BOSS
      this.showMessage(`👑 第 ${this.wave} 波 - BOSS來襲！！！`, 0xFF0000);

      // 重置下一輪的額外怪物數量（在打敗BOSS後會設置）
      this.bonusEnemiesPerWave = 0;

      // 延遲2秒後生成BOSS，增加緊張感
      this.time.delayedCall(2000, () => {
        const boss = new Enemy(this, this.path, this.wave, true);
        this.enemies.push(boss);
      });

      // BOSS波後延遲30秒才開始下一波（給足夠時間擊敗Boss）
      this.time.delayedCall(32000, () => {
        if (this.lives > 0) {
          this.startWave();
        }
      });
    } else {
      // 普通波
      let enemyCount = 10 + this.wave * 4; // 怪物數量改為兩倍

      // 如果打敗過王，添加額外怪物
      if (this.bossDefeated) {
        enemyCount += this.bonusEnemiesPerWave;
        this.showMessage(`🌊 第 ${this.wave} 波來襲！(+${this.bonusEnemiesPerWave} 額外怪物)`, 0xFF6B6B);
      } else {
        this.showMessage(`🌊 第 ${this.wave} 波來襲！`, 0x4ECDC4);
      }

      for (let i = 0; i < enemyCount; i++) {
        this.time.delayedCall(i * 1000, () => {
          const enemy = new Enemy(this, this.path, this.wave, false);
          this.enemies.push(enemy);
        });
      }

      // 下一波
      this.time.delayedCall((enemyCount + 10) * 1000, () => {
        if (this.lives > 0) {
          this.startWave();
        }
      });
    }
  }

  // 計算所有光環塔的總效果
  getAuraBonus() {
    let attackSpeedBonus = 0;
    let damageBonus = 0;
    let enemySlowBonus = 0;

    for (const tower of this.towers) {
      if (tower.config.isAura) {
        attackSpeedBonus += tower.config.auraAttackSpeedBonus * tower.level;
        damageBonus += tower.config.auraDamageBonus * tower.level;
        enemySlowBonus += tower.config.auraEnemySlowBonus * tower.level;
      }
    }

    return {
      attackSpeedBonus,
      damageBonus,
      enemySlowBonus
    };
  }

  update(time, delta) {
    if (this.isGameOver) return;

    // 計算光環效果
    const auraBonus = this.getAuraBonus();

    // 更新塔
    this.towers.forEach(tower => {
      tower.update(time, this.enemies, auraBonus);
    });

    // 更新敵人
    this.enemies = this.enemies.filter(enemy => {
      if (enemy.active) {
        enemy.update(delta, auraBonus);
        return true;
      }
      return false;
    });

    // 更新子彈
    this.updateProjectiles(delta);
  }

  updateProjectiles(delta) {
    this.projectiles = this.projectiles.filter(projectile => {
      if (!projectile.target.active) {
        projectile.graphic.destroy();
        if (projectile.glow) projectile.glow.destroy();
        return false;
      }

      // 移動子彈
      const angle = Math.atan2(
        projectile.target.y - projectile.y,
        projectile.target.x - projectile.x
      );

      const moveDistance = projectile.speed * (delta / 1000);
      projectile.x += Math.cos(angle) * moveDistance;
      projectile.y += Math.sin(angle) * moveDistance;

      projectile.graphic.setPosition(projectile.x, projectile.y);
      if (projectile.glow) {
        projectile.glow.setPosition(projectile.x, projectile.y);
      }

      // 檢查碰撞
      const distance = Phaser.Math.Distance.Between(
        projectile.x, projectile.y,
        projectile.target.x, projectile.target.y
      );

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

    // 基礎傷害
    target.takeDamage(projectile.damage);

    // 特殊效果
    if (config.dotDamage) {
      target.applyBurn(config.dotDamage, config.dotDuration);
    }

    if (config.poisonDamage) {
      target.applyPoison(config.poisonDamage, config.poisonDuration);
    }

    if (config.slow) {
      target.applySlow(config.slow, config.slowDuration);
    }

    if (config.freeze) {
      target.applyFreeze(config.freezeDuration);
    }

    // 範圍傷害
    if (config.splashRadius) {
      this.applySplashDamage(projectile.x, projectile.y, config);
    }

    // 閃電鏈
    if (config.chainCount) {
      this.applyLightningChain(target, config);
    }

    // 命中特效
    this.createHitEffect(projectile.x, projectile.y, config.effectColor);

    // 清理子彈
    projectile.graphic.destroy();
    if (projectile.glow) projectile.glow.destroy();
  }

  applySplashDamage(x, y, config) {
    this.enemies.forEach(enemy => {
      if (!enemy.active) return;

      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= config.splashRadius) {
        enemy.takeDamage(config.damage * 0.5);

        if (config.poisonDamage) {
          enemy.applyPoison(config.poisonDamage, config.poisonDuration);
        }
      }
    });

    // 爆炸範圍圓圈效果
    const explosionRing = this.add.circle(x, y, 10, config.effectColor, 0.4);
    explosionRing.setDepth(55);
    this.tweens.add({
      targets: explosionRing,
      radius: config.splashRadius,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => explosionRing.destroy()
    });

    // 爆炸粒子
    const explosionParticles = this.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [config.effectColor, 0xFF6347, 0xFFFF00],
      lifespan: 400,
      quantity: 20,
      blendMode: 'ADD'
    });
    explosionParticles.setDepth(55);
    this.time.delayedCall(400, () => explosionParticles.destroy());
  }

  applyLightningChain(startTarget, config) {
    let currentTarget = startTarget;
    const hitTargets = [startTarget];

    for (let i = 1; i < config.chainCount; i++) {
      let nextTarget = null;
      let closestDistance = config.chainRange;

      this.enemies.forEach(enemy => {
        if (!enemy.active || hitTargets.includes(enemy)) return;

        const distance = Phaser.Math.Distance.Between(
          currentTarget.x, currentTarget.y,
          enemy.x, enemy.y
        );

        if (distance < closestDistance) {
          nextTarget = enemy;
          closestDistance = distance;
        }
      });

      if (nextTarget) {
        // 繪製閃電鏈
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
    const graphics = this.add.graphics();
    graphics.setDepth(55); // 在敵人之上
    graphics.lineStyle(3, 0xFFFF00, 1);
    graphics.lineBetween(x1, y1, x2, y2);
    graphics.lineStyle(1, 0xFFFFFF, 1);
    graphics.lineBetween(x1, y1, x2, y2);

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 200,
      onComplete: () => graphics.destroy()
    });
  }

  createHitEffect(x, y, color) {
    // 命中粒子效果
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: color,
      lifespan: 300,
      quantity: 10,
      blendMode: 'ADD'
    });
    particles.setDepth(55); // 在敵人之上

    this.time.delayedCall(300, () => particles.destroy());

    // 命中閃光圓圈
    const flash = this.add.circle(x, y, 15, color, 0.8);
    flash.setDepth(55);
    this.tweens.add({
      targets: flash,
      scale: 1.5,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });
  }

  createBuildEffect(x, y, color) {
    const circle = this.add.circle(x, y, 5, color);

    this.tweens.add({
      targets: circle,
      radius: 50,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => circle.destroy()
    });
  }

  createCraftEffect(x, y, color) {
    // 爆炸光環
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(x, y, 10, color, 0.5);

      this.tweens.add({
        targets: ring,
        radius: 80 + i * 20,
        alpha: 0,
        duration: 800,
        delay: i * 100,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 粒子爆炸
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xFFD700, 0xFFFFFF],
      lifespan: 800,
      quantity: 30,
      blendMode: 'ADD'
    });

    this.time.delayedCall(800, () => particles.destroy());
  }

  showMessage(text, color = 0xFFFFFF) {
    const message = this.add.text(600, 300, text, {
      fontSize: '32px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: message,
      y: 250,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => message.destroy()
    });
  }

  addGold(amount) {
    this.gold += amount;
    this.score += amount;
    this.updateUI();
  }

  loseLife(amount) {
    this.lives -= amount;
    this.updateUI();

    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.cameras.main.shake(200, 0.01);
    }
  }

  onBossDefeated() {
    this.bossDefeated = true;

    // 隨機下一輪額外怪物數量 (3-7隻)
    this.bonusEnemiesPerWave = Math.floor(Math.random() * 5) + 3;

    // 隨機選擇一個塔升級
    if (this.towers.length > 0) {
      const randomTower = this.towers[Math.floor(Math.random() * this.towers.length)];
      randomTower.upgrade();

      this.showMessage(`🎁 Boss獎勵！\n${randomTower.config.emoji} 升至Lv.${randomTower.level}\n下一輪+${this.bonusEnemiesPerWave}怪`, 0xFFD700);
    } else {
      this.showMessage(`⚠️ 無塔可升級\n下一輪+${this.bonusEnemiesPerWave}怪`, 0xFFA500);
    }
  }

  updateUI() {
    this.goldText.setText(`💰 金幣: ${this.gold}`);
    this.livesText.setText(`❤️ 生命: ${this.lives}`);
    this.waveText.setText(`🌊 波數: ${this.wave}`);
    this.scoreText.setText(`⭐ 分數: ${this.score}`);
  }

  gameOver() {
    this.isGameOver = true;

    // 1. 創建一個覆蓋整個畫布的半透明黑色遮罩
    const overlay = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
    overlay.setDepth(300); // 確保在最上層

    // 2. 顯示失敗訊息
    this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 100, '你已經失敗！', {
      fontSize: '48px',
      color: '#FF4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(301);

    // 顯示最終分數 (增加垂直 padding)
    this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, `最終分數: ${this.score}`, {
      fontSize: '24px',
      color: '#FFD700',
      padding: { y: 10 } // 增加垂直內邊距防止文字被裁切
    }).setOrigin(0.5).setDepth(301);

    // 3. 創建重新開始按鈕
    const buttonX = this.cameras.main.width / 2;
    const buttonY = this.cameras.main.height / 2 + 100;

    const restartButton = this.add.rectangle(buttonX, buttonY, 200, 60, 0x4CAF50)
      .setStrokeStyle(3, 0xFFFFFF)
      .setInteractive({ useHandCursor: true });
    restartButton.setDepth(301);

    const buttonText = this.add.text(buttonX, buttonY, '重新開始', {
      fontSize: '28px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 } // 增加 padding 防止文字被裁切
    }).setOrigin(0.5).setDepth(302);

    // 4. 按鈕互動效果
    restartButton.on('pointerover', () => {
      restartButton.setFillStyle(0x5CD660);
      this.tweens.add({ targets: restartButton, scale: 1.05, duration: 200 });
    });

    restartButton.on('pointerout', () => {
      restartButton.setFillStyle(0x4CAF50);
      this.tweens.add({ targets: restartButton, scale: 1, duration: 200 });
    });

    // 5. 按鈕點擊事件 -> 重新啟動場景
    restartButton.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
