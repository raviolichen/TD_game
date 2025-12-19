import Tower from '../entities/Tower.js';
import { TowerConfig } from '../config/towerConfig.js';
import { canCraftTower, canCraftThreeTowers } from '../config/towerConfig.js';
import SocketService from '../services/SocketService.js';

/**
 * TowerManager - 管理遊戲中的塔系統
 * 包括塔的建造、升級、合成、選擇、預覽、UI面板
 */
export default class TowerManager {
  constructor(scene) {
    this.scene = scene;

    // 塔的選擇狀態
    this.selectedTower = null; // 當前選中要建造的塔類型
    this.selectedTowerObject = null; // 當前選中的塔對象（用於升級面板）

    // 合成模式
    this.craftMode = false;
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;

    // UI元素
    this.previewTower = null; // 塔的預覽
    this.upgradePanel = null; // 升級面板
    this.tooltip = null; // 工具提示

    // 網絡ID生成
    this.nextTowerNetworkId = 1;

    // 格線對齊設定
    this.GRID_SIZE = 50; // 格線大小（像素）
    this.gridOverlay = null; // 格線視覺元素
  }

  /**
   * 將座標吸附到最近的格線點
   */
  snapToGrid(x, y) {
    const snappedX = Math.round(x / this.GRID_SIZE) * this.GRID_SIZE;
    const snappedY = Math.round(y / this.GRID_SIZE) * this.GRID_SIZE;
    return { x: snappedX, y: snappedY };
  }

  /**
   * 安全地透過 UI 管理器顯示訊息
   */
  showMessage(text, color) {
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.showMessage) {
      uiManager.showMessage(text, color);
    }
  }

  /**
   * 安全地更新提示文字
   */
  setHintText(content) {
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.hintText) {
      uiManager.hintText.setText(content);
    }
  }

  /**
   * 安全地更新 UI 顯示
   */
  updateUI() {
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.updateUI) {
      uiManager.updateUI();
    }
  }

  // #region 塔建造

  /**
   * 建造新塔
   */
  buildTower(x, y, towerType) {
    // 多人模式檢查
    if (this.scene.gameMode === 'multiplayer') {
      if (this.scene.matchEnded) {
        this.showMessage('⚔️ 對戰已結束，無法建造。', 0xFFA500);
        return;
      }
      if (!this.scene.matchStarted) {
        this.showMessage('⌛ 正在等待對手加入，稍後再試！', 0xFFA500);
        return;
      }
    }

    // 檢查金幣
    const config = TowerConfig[towerType];
    if (this.scene.gold < config.cost) {
      this.showMessage('💸 金幣不足！', 0xFF0000);
      return;
    }

    // 🎯 格線吸附：將建造座標對齊到格線
    const snapped = this.snapToGrid(x, y);
    const buildX = snapped.x;
    const buildY = snapped.y;

    // 檢查位置是否合法（使用吸附後的座標）
    const placement = this.getPlacementStatus(buildX, buildY);
    if (!placement.valid) {
      this.showMessage(placement.reason, 0xFF0000);
      return;
    }

    // 創建塔（使用吸附後的座標）
    const tower = new Tower(this.scene, buildX, buildY, towerType);
    this.scene.playerTowers.push(tower);
    this.scene.towers.push(tower);

    // 多人模式：分配網絡ID
    let towerId = null;
    if (this.scene.gameMode === 'multiplayer') {
      towerId = this.createTowerNetworkId();
      tower.networkId = towerId;
      this.scene.towerById.set(towerId, tower);
    }

    // 扣除金幣
    this.scene.gold -= config.cost;
    this.updateUI();

    // 清除選擇狀態
    this.selectedTower = null;
    this.setHintText(`✅ 建造成功\n${config.emoji}\n${config.name}`);

    // 清除預覽
    if (this.previewTower) {
      Object.values(this.previewTower).forEach(p => p.destroy());
      this.previewTower = null;
    }

    // 創建建造特效（使用吸附後的座標）
    this.scene.effectManager.createBuildEffect(buildX, buildY, config.color);

    // 播放建造音效
    if (this.scene.audioManager) {
      this.scene.audioManager.playBuildSound();
    }

    // 多人模式：廣播建造事件
    if (this.scene.gameMode === 'multiplayer') {
      const localX = buildX - this.scene.playerMapBounds.x;
      const ownerId = this.scene.localPlayerId || (SocketService.socket ? SocketService.socket.id : null);
      if (!this.scene.localPlayerId && ownerId) this.scene.localPlayerId = ownerId;

      if (SocketService.socket && this.scene.roomId && towerId) {
        SocketService.emit('build-tower', {
          roomId: this.scene.roomId,
          towerId,
          towerType,
          x: localX,
          y: buildY,
          ownerId
        });
      }
    }
  }

  /**
   * 檢查位置是否可以建造
   */
  getPlacementStatus(x, y) {
    const isSinglePlayer = this.scene.gameMode === 'singlePlayer';
    const bounds = isSinglePlayer ? this.scene.mapBounds : this.scene.playerBuildBounds;
    const pathPoints = isSinglePlayer ? this.scene.path : this.scene.playerPath;
    const towers = isSinglePlayer ? this.scene.towers : this.scene.playerTowers;

    if (!bounds) {
      return { valid: true };
    }

    // 檢查邊界
    const margin = 12;
    if (x < bounds.left + margin || x > bounds.right - margin ||
      y < bounds.top + margin || y > bounds.bottom - margin) {
      return { valid: false, reason: '🚧 超出可建造範圍！' };
    }

    // 單人模式：使用瓦片地圖檢查可建造區域
    if (isSinglePlayer && this.scene.mapManager) {
      if (!this.scene.mapManager.isBuildable(x, y)) {
        return { valid: false, reason: '🚫 不能在路徑上建造！' };
      }
    } else {
      // 多人模式：使用舊的路徑碰撞檢測
      if (pathPoints && this.isPointOnPath(x, y, pathPoints)) {
        return { valid: false, reason: '🚫 不能在路徑上建造！' };
      }
    }

    // 檢查與其他塔的距離
    const minDistance = 55;
    if (towers && towers.some(tower =>
      Phaser.Math.Distance.Between(x, y, tower.x, tower.y) < minDistance
    )) {
      return { valid: false, reason: '⚠️ 塔太靠近了！' };
    }

    return { valid: true };
  }

  /**
   * 檢查點是否在路徑上
   */
  isPointOnPath(x, y, pathPoints, collisionRadius = null) {
    if (!pathPoints || pathPoints.length < 2) return false;
    const threshold = Math.max(30, (collisionRadius ?? this.scene.pathCollisionRadius ?? 45) - 5);

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

  /**
   * 計算點到線段的距離
   */
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

    let xx, yy;
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

  // #endregion

  // #region 塔預覽

  /**
   * 處理鼠標移動（塔預覽）
   */
  handleMouseMove(pointer) {
    // 單人模式：如果鼠標在左側UI區域，隱藏預覽
    if (this.scene.gameMode === 'singlePlayer' && pointer.x < 220) {
      if (this.previewTower) {
        Object.values(this.previewTower).forEach(p => p.setVisible(false));
      }
      return;
    }

    // 如果沒有選擇塔或處於合成模式，移除預覽
    if (!this.selectedTower || this.craftMode) {
      if (this.previewTower) {
        Object.values(this.previewTower).forEach(p => p.destroy());
        this.previewTower = null;
      }
      return;
    }

    // 多人模式：檢查鼠標是否在可建造區域內
    let targetBounds = this.scene.playerMapBounds;
    if (this.scene.gameMode === 'multiplayer') {
      if (!targetBounds || !Phaser.Geom.Rectangle.Contains(targetBounds, pointer.x, pointer.y)) {
        if (this.previewTower) {
          Object.values(this.previewTower).forEach(p => p.setVisible(false));
        }
        return;
      }
    }

    // 如果預覽被隱藏，顯示它
    if (this.previewTower && this.previewTower.circle && !this.previewTower.circle.visible) {
      Object.values(this.previewTower).forEach(p => p.setVisible(true));
    }

    // 🎯 格線吸附：將座標對齊到格線
    const snapped = this.snapToGrid(pointer.x, pointer.y);
    const previewX = snapped.x;
    const previewY = snapped.y;

    const config = TowerConfig[this.selectedTower];
    const status = this.getPlacementStatus(previewX, previewY);
    const valid = status.valid;

    // 創建或更新預覽（使用吸附後的座標）
    if (!this.previewTower) {
      this.previewTower = {
        circle: this.scene.add.circle(previewX, previewY, 20, config.color, 0.5),
        range: this.scene.add.circle(previewX, previewY, config.range, config.effectColor, 0.1)
          .setStrokeStyle(2, config.effectColor, 0.3),
        dot: this.scene.add.circle(previewX, previewY, 6, 0xFFFFFF, 1),
        // 格線吸附視覺指示器（顯示吸附格子）
        gridHighlight: this.scene.add.rectangle(previewX, previewY, this.GRID_SIZE - 4, this.GRID_SIZE - 4)
          .setStrokeStyle(2, 0xFFFFFF, 0.4)
          .setFillStyle(0xFFFFFF, 0.05)
      };
      this.previewTower.range.setDepth(98);
      this.previewTower.circle.setDepth(99);
      this.previewTower.dot.setDepth(100);
      this.previewTower.gridHighlight.setDepth(97);
      this.previewTower.dot.setStrokeStyle(2, 0x2ECC71, 0.6);
    } else {
      this.previewTower.circle.setPosition(previewX, previewY);
      this.previewTower.range.setPosition(previewX, previewY);
      this.previewTower.dot.setPosition(previewX, previewY);
      this.previewTower.gridHighlight.setPosition(previewX, previewY);
    }

    // 根據合法性改變顏色
    this.previewTower.circle.setFillStyle(valid ? config.color : 0xE74C3C, valid ? 0.35 : 0.4);
    this.previewTower.range.setStrokeStyle(2, valid ? config.effectColor : 0xE74C3C, valid ? 0.35 : 0.7);
    this.previewTower.dot.setFillStyle(valid ? 0xFFFFFF : 0xFFCDD2, 1);
    this.previewTower.dot.setStrokeStyle(2, valid ? 0x2ECC71 : 0xC0392B, valid ? 0.7 : 0.9);
    this.previewTower.gridHighlight.setStrokeStyle(2, valid ? 0x2ECC71 : 0xE74C3C, 0.6);
    this.previewTower.gridHighlight.setFillStyle(valid ? 0x2ECC71 : 0xE74C3C, valid ? 0.1 : 0.15);
  }

  // #endregion

  // #region 塔升級

  /**
   * 升級塔
   */
  upgradeTower(tower, cost) {
    const maxAllowedLevel = Math.floor(this.scene.waveManager.getCurrentWave() / 5);
    if (tower.level >= maxAllowedLevel) {
      const nextUnlockWave = (tower.level + 1) * 5;
      this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升到${tower.level + 1}級！`, 0xFFA500);
      return;
    }

    if (this.scene.gold < cost) {
      this.showMessage('💸 金幣不足，無法升級！', 0xFF0000);
      return;
    }

    this.scene.gold -= cost;
    this.updateUI();
    tower.upgrade();

    // 多人模式：廣播升級事件
    if (this.scene.gameMode === 'multiplayer' && tower.networkId && SocketService.socket && this.scene.roomId) {
      SocketService.emit('upgrade-tower', {
        roomId: this.scene.roomId,
        towerId: tower.networkId
      });
    }

    this.showMessage(`✨ ${tower.config.emoji} 升級成功！`, 0xFFD700);
    this.hideUpgradePanel();
    this.showUpgradePanel(tower);
    this.scene.effectManager.createUpgradeEffect(tower.x, tower.y, tower.config.effectColor);

    // 播放升級音效
    if (this.scene.audioManager) {
      this.scene.audioManager.playUpgradeSound();
    }
  }

  /**
   * 顯示販售確認對話框
   */
  showSellConfirmDialog(tower) {
    if (!tower || !tower.sprite || !tower.sprite.active) return;

    const sellPrice = Math.floor(tower.totalInvestment * 0.7);

    // 先隱藏升級面板
    this.hideUpgradePanel();

    // 創建確認對話框
    const dialogX = tower.x;
    const dialogY = tower.y;
    const dialogWidth = 200;
    const dialogHeight = 120;
    const BASE_DEPTH = 300;

    this.sellConfirmDialog = {};

    // 背景
    this.sellConfirmDialog.bg = this.scene.add.rectangle(dialogX, dialogY, dialogWidth, dialogHeight, 0x2C3E50, 0.95)
      .setStrokeStyle(3, 0xFF6347)
      .setDepth(BASE_DEPTH)
      .setInteractive();
    this.sellConfirmDialog.bg.on('pointerdown', (p) => p.event.stopPropagation());

    // 標題
    this.sellConfirmDialog.title = this.scene.add.text(dialogX, dialogY - 35, '確認販售？', {
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 塔信息
    this.sellConfirmDialog.info = this.scene.add.text(dialogX, dialogY - 10, `${tower.config.emoji} ${tower.config.name} Lv.${tower.level}`, {
      fontSize: '14px',
      color: '#FFD700',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 價格信息
    this.sellConfirmDialog.price = this.scene.add.text(dialogX, dialogY + 10, `獲得金幣: $${sellPrice}`, {
      fontSize: '12px',
      color: '#32CD32',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 確認按鈕
    const confirmY = dialogY + 35;
    this.sellConfirmDialog.confirmButton = this.scene.add.rectangle(dialogX - 50, confirmY, 80, 25, 0x32CD32)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true })
      .setDepth(BASE_DEPTH + 2);
    this.sellConfirmDialog.confirmText = this.scene.add.text(dialogX - 50, confirmY, '✅ 確認', {
      fontSize: '12px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 3);

    // 取消按鈕
    this.sellConfirmDialog.cancelButton = this.scene.add.rectangle(dialogX + 50, confirmY, 80, 25, 0xE74C3C)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true })
      .setDepth(BASE_DEPTH + 2);
    this.sellConfirmDialog.cancelText = this.scene.add.text(dialogX + 50, confirmY, '❌ 取消', {
      fontSize: '12px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 3);

    // 按鈕事件
    this.sellConfirmDialog.confirmButton.on('pointerdown', (p) => {
      p.event.stopPropagation();
      this.hideSellConfirmDialog();
      this.sellTower(tower);
    });
    this.sellConfirmDialog.confirmButton.on('pointerover', () => {
      if (this.sellConfirmDialog) {
        this.sellConfirmDialog.confirmButton.setFillStyle(0x228B22);
      }
    });
    this.sellConfirmDialog.confirmButton.on('pointerout', () => {
      if (this.sellConfirmDialog) {
        this.sellConfirmDialog.confirmButton.setFillStyle(0x32CD32);
      }
    });

    this.sellConfirmDialog.cancelButton.on('pointerdown', (p) => {
      p.event.stopPropagation();
      this.hideSellConfirmDialog();
      this.showUpgradePanel(tower); // 重新顯示升級面板
    });
    this.sellConfirmDialog.cancelButton.on('pointerover', () => {
      if (this.sellConfirmDialog) {
        this.sellConfirmDialog.cancelButton.setFillStyle(0xC0392B);
      }
    });
    this.sellConfirmDialog.cancelButton.on('pointerout', () => {
      if (this.sellConfirmDialog) {
        this.sellConfirmDialog.cancelButton.setFillStyle(0xE74C3C);
      }
    });
  }

  /**
   * 隱藏販售確認對話框
   */
  hideSellConfirmDialog() {
    if (this.sellConfirmDialog) {
      Object.values(this.sellConfirmDialog).forEach(obj => {
        if (obj && obj.destroy) {
          if (obj.removeAllListeners) obj.removeAllListeners();
          obj.destroy();
        }
      });
      this.sellConfirmDialog = null;
    }
  }

  /**
   * 販售塔
   */
  sellTower(tower) {
    if (!tower || !tower.sprite || !tower.sprite.active) return;

    // 計算販售價格（總投資的70%）
    const sellPrice = Math.floor(tower.totalInvestment * 0.7);

    // 從塔列表中移除
    this.scene.playerTowers = this.scene.playerTowers.filter(t => t !== tower);
    this.scene.towers = this.scene.towers.filter(t => t !== tower);

    // 多人模式：廣播移除事件
    if (this.scene.gameMode === 'multiplayer' && tower.networkId && SocketService.socket && this.scene.roomId) {
      SocketService.emit('remove-tower', {
        roomId: this.scene.roomId,
        towerId: tower.networkId
      });

      // 從網絡ID映射中移除
      this.scene.towerById.delete(tower.networkId);
    }

    // 給予金幣
    this.scene.economyManager.addGold(sellPrice);

    // 顯示販售訊息
    this.showMessage(`💰 販售 ${tower.config.emoji} 獲得 $${sellPrice}`, 0x32CD32);

    // 創建販售特效
    this.scene.effectManager.createBuildEffect(tower.x, tower.y, 0x32CD32);

    // 隱藏升級面板
    this.hideUpgradePanel();
    this.selectedTowerObject = null;

    // 銷毀塔
    tower.destroy();
  }

  /**
   * 顯示塔信息
   */
  showTowerInfo(tower) {
    if (!tower || !tower.sprite || !tower.sprite.active) return;

    this.hideUpgradePanel();

    // 隱藏之前選中的塔的範圍指示器
    if (this.selectedTowerObject && this.selectedTowerObject !== tower) {
      if (this.selectedTowerObject.sprite && this.selectedTowerObject.sprite.active) {
        this.selectedTowerObject.hideRange();
      }
    }

    this.selectedTowerObject = tower;
    tower.showRange();

    const info = tower.getInfo();
    this.setHintText(`📊 ${tower.config.emoji}\n${info.name}\n💥${info.damage} 📏${info.range}`);
    this.showUpgradePanel(tower);
  }

  /**
   * 顯示升級面板
   */
  showUpgradePanel(tower) {
    if (this.upgradePanel) this.hideUpgradePanel();

    const info = tower.getInfo();
    const upgradeCost = Math.floor(tower.config.cost * 0.6);
    const maxAllowedLevel = Math.floor(this.scene.waveManager.getCurrentWave() / 5);
    const isLevelCapped = tower.level >= maxAllowedLevel;
    const nextUnlockWave = (tower.level + 1) * 5;

    const panelX = tower.x;
    const panelY = tower.y - 80;
    const panelWidth = 160;
    const panelHeight = 200;
    const BASE_DEPTH = 200;

    this.upgradePanel = {};

    // 背景
    this.upgradePanel.bg = this.scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x2C3E50, 0.95)
      .setStrokeStyle(3, 0xFFD700)
      .setDepth(BASE_DEPTH)
      .setInteractive();
    this.upgradePanel.bg.on('pointerdown', (p) => p.event.stopPropagation());

    // 標題
    this.upgradePanel.title = this.scene.add.text(panelX, panelY - 50, `${info.name}`, {
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 等級文字
    const levelText = isLevelCapped ? `等級: ${info.level} (上限)` : `等級: ${info.level}/${maxAllowedLevel}`;
    this.upgradePanel.level = this.scene.add.text(panelX, panelY - 33, levelText, {
      fontSize: '12px',
      color: isLevelCapped ? '#FF6B6B' : '#FFD700'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 等級提示
    if (isLevelCapped) {
      this.upgradePanel.levelHint = this.scene.add.text(panelX, panelY - 18, `⏳ 第${nextUnlockWave}波解鎖`, {
        fontSize: '10px',
        color: '#FFA500'
      }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);
    }

    // 屬性文字
    const statsText = `💥 ${Math.floor(info.damage)} | 📏 ${Math.floor(info.range)}`;
    this.upgradePanel.stats = this.scene.add.text(panelX, panelY - 3, statsText, {
      fontSize: '11px',
      color: '#FFFFFF'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 1);

    // 升級按鈕
    const buttonY = panelY + 25;
    const buttonColor = isLevelCapped ? 0x7F8C8D : 0x27AE60;
    this.upgradePanel.upgradeButton = this.scene.add.rectangle(panelX, buttonY, 130, 35, buttonColor)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true })
      .setDepth(BASE_DEPTH + 2);

    const buttonText = isLevelCapped ? `🔒 已達上限` : `⬆️ 升級 ($${upgradeCost})`;
    this.upgradePanel.upgradeText = this.scene.add.text(panelX, buttonY, buttonText, {
      fontSize: '13px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 3);

    if (!isLevelCapped) {
      this.upgradePanel.upgradeButton.on('pointerdown', (p) => {
        p.event.stopPropagation();
        this.upgradeTower(tower, upgradeCost);
      });
      this.upgradePanel.upgradeButton.on('pointerover', () => {
        if (this.upgradePanel) {
          this.upgradePanel.upgradeButton.setFillStyle(0x2ECC71).setScale(1.05);
        }
      });
      this.upgradePanel.upgradeButton.on('pointerout', () => {
        if (this.upgradePanel) {
          this.upgradePanel.upgradeButton.setFillStyle(0x27AE60).setScale(1);
        }
      });
    } else {
      this.upgradePanel.upgradeButton.on('pointerdown', (p) => {
        p.event.stopPropagation();
        this.showMessage(`⏳ 需要第${nextUnlockWave}波才能升級！`, 0xFFA500);
      });
    }

    // 販售按鈕
    const sellPrice = Math.floor(tower.totalInvestment * 0.7);
    const sellY = panelY + 65;
    this.upgradePanel.sellButton = this.scene.add.rectangle(panelX - 35, sellY, 60, 25, 0xFF6347)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true })
      .setDepth(BASE_DEPTH + 4);
    this.upgradePanel.sellText = this.scene.add.text(panelX - 35, sellY, `💰 $${sellPrice}`, {
      fontSize: '10px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 5);

    this.upgradePanel.sellButton.on('pointerdown', (p) => {
      p.event.stopPropagation();
      this.showSellConfirmDialog(tower);
    });
    this.upgradePanel.sellButton.on('pointerover', () => {
      if (this.upgradePanel) {
        this.upgradePanel.sellButton.setFillStyle(0xFF4500);
      }
    });
    this.upgradePanel.sellButton.on('pointerout', () => {
      if (this.upgradePanel) {
        this.upgradePanel.sellButton.setFillStyle(0xFF6347);
      }
    });

    // 關閉按鈕
    const closeY = panelY + 65;
    this.upgradePanel.closeButton = this.scene.add.rectangle(panelX + 35, closeY, 60, 25, 0xE74C3C)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true })
      .setDepth(BASE_DEPTH + 4);
    this.upgradePanel.closeText = this.scene.add.text(panelX + 35, closeY, '❌ 關閉', {
      fontSize: '11px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(BASE_DEPTH + 5).setInteractive({ useHandCursor: true });

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
    this.upgradePanel.closeButton.on('pointerover', () => {
      if (this.upgradePanel) this.upgradePanel.closeButton.setFillStyle(0xC0392B);
    });
    this.upgradePanel.closeButton.on('pointerout', () => {
      if (this.upgradePanel) this.upgradePanel.closeButton.setFillStyle(0xE74C3C);
    });
  }

  /**
   * 隱藏升級面板
   */
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

  // #endregion

  // #region 塔合成

  /**
   * 選擇塔進行合成
   */
  selectTowerForCraft(tower) {
    if (!this.craftTower1) {
      this.craftTower1 = tower;
      tower.showRange();
      this.setHintText(`🔨 已選第一座\n${tower.config.emoji}\n選第二座`);
    } else if (!this.craftTower2) {
      if (tower === this.craftTower1) {
        this.showMessage('❌ 不能選擇同一座塔！', 0xFF0000);
        this.setHintText(`⚠️ 請選擇\n不同的塔\n進行合成`);
        return;
      }
      this.craftTower2 = tower;
      tower.showRange();

      // 檢查兩座塔是否可以合成
      const twoTowerResult = canCraftTower(this.craftTower1.type, this.craftTower2.type);
      if (twoTowerResult) {
        this.attemptCraft();
      } else {
        this.setHintText(
          `🔨 已選兩座\n${this.craftTower1.config.emoji}${this.craftTower2.config.emoji}\n選第三座或重選`
        );
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
      // 如果已經選了3座，重新開始選擇
      this.clearCraftSelection();
      this.craftTower1 = tower;
      tower.showRange();
      this.setHintText(`🔨 已選第一座\n${tower.config.emoji}\n選第二座`);
    }
  }

  /**
   * 嘗試合成塔
   */
  attemptCraft() {
    let newTowerType = null;
    let towersToRemove = [];
    let newX, newY;

    if (this.craftTower3) {
      // 三塔合成
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
      // 兩塔合成
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

    // 計算繼承等級（取最低等級）
    towersToRemove.forEach(t => {
      if (t.sprite && t.sprite.active) t.hideRange();
      inheritLevel = Math.min(inheritLevel, t.level);
      if (t.networkId) {
        towerIdsToRemove.push(t.networkId);
      }
    });

    // 多人模式：通知對手移除舊塔
    if (this.scene.gameMode === 'multiplayer' && SocketService.socket && this.scene.roomId) {
      towerIdsToRemove.forEach(towerId => {
        SocketService.emit('remove-tower', {
          roomId: this.scene.roomId,
          towerId
        });
      });
    }

    // 移除舊塔
    this.scene.playerTowers = this.scene.playerTowers.filter(t => !towersToRemove.includes(t));
    this.scene.towers = this.scene.towers.filter(t => !towersToRemove.includes(t));
    towersToRemove.forEach(t => {
      if (t.networkId) this.scene.towerById.delete(t.networkId);
      t.destroy();
    });

    // 創建新塔
    const newTower = new Tower(this.scene, newX, newY, newTowerType);
    this.scene.playerTowers.push(newTower);
    this.scene.towers.push(newTower);

    // 繼承等級
    if (inheritLevel > 1) {
      for (let i = 1; i < inheritLevel; i++) {
        newTower.upgrade();
      }
    }

    // 多人模式：分配ID並廣播
    if (this.scene.gameMode === 'multiplayer' && SocketService.socket && this.scene.roomId) {
      const towerId = this.createTowerNetworkId();
      newTower.networkId = towerId;
      this.scene.towerById.set(towerId, newTower);

      const relativeX = newX - (this.scene.playerAreaRect ? this.scene.playerAreaRect.x : 0);
      SocketService.emit('build-tower', {
        roomId: this.scene.roomId,
        x: relativeX,
        y: newY,
        towerType: newTowerType,
        towerId: towerId,
        level: inheritLevel
      });
    }

    // 創建合成特效
    this.scene.effectManager.createCraftEffect(newX, newY, newConfig.color);
    this.showMessage(`🎉 成功合成 ${newConfig.emoji} ${newConfig.name}！Lv.${inheritLevel}`, 0xFFD700);

    // 播放合成音效
    if (this.scene.audioManager) {
      this.scene.audioManager.playCraftSound();
    }

    // 清理合成狀態
    this.clearCraftSelection();
    this.craftMode = false;
    const hintTextContent = this.scene.gameMode === 'multiplayer'
      ? '💡 選擇基礎塔建造\n或點擊🔨進入合成模式'
      : `🎉 合成成功\n${newConfig.emoji}\n${newConfig.name}`;
    this.setHintText(hintTextContent);
  }

  /**
   * 清除合成選擇
   */
  clearCraftSelection() {
    if (this.craftTower1 && this.craftTower1.sprite && this.craftTower1.sprite.active) {
      this.craftTower1.hideRange();
    }
    if (this.craftTower2 && this.craftTower2.sprite && this.craftTower2.sprite.active) {
      this.craftTower2.hideRange();
    }
    if (this.craftTower3 && this.craftTower3.sprite && this.craftTower3.sprite.active) {
      this.craftTower3.hideRange();
    }
    this.craftTower1 = null;
    this.craftTower2 = null;
    this.craftTower3 = null;
  }

  /**
   * 切換合成模式
   */
  toggleCraftMode() {
    this.craftMode = !this.craftMode;
    if (this.craftMode) {
      this.clearCraftSelection();
      const hintTextContent = this.scene.gameMode === 'multiplayer'
        ? '🔨 合成模式\n選擇2-3座塔合成'
        : `🔨 合成模式
選擇塔進行合成`;
      this.setHintText(hintTextContent);
      this.showMessage('進入合成模式', 0x4ECDC4);
    } else {
      const hintTextContent = this.scene.gameMode === 'multiplayer'
        ? '💡 選擇基礎塔建造\n或點擊🔨進入合成模式'
        : `💡 退出\n合成模式`;
      this.setHintText(hintTextContent);
      this.showMessage('退出合成模式', 0x888888);
    }
  }

  // #endregion

  // #region 塔選擇和UI

  /**
   * 選擇要建造的塔類型
   */
  selectTower(towerType) {
    this.selectedTower = towerType;
    const config = TowerConfig[towerType];

    if (this.scene.gold < config.cost) {
      this.showMessage('💸 金幣不足！', 0xFF0000);
      return;
    }

    if (this.scene.gameMode === 'singlePlayer') {
      this.setHintText(`✅ 已選擇\n${config.emoji} ${config.name}\n點擊地圖建造`);
    } else {
      this.setHintText(`✅ 已選擇: ${config.emoji}`);
    }
  }

  /**
   * 取消塔選擇
   */
  cancelTowerSelection() {
    this.selectedTower = null;
    this.setHintText('💡 選擇塔建造');
    if (this.previewTower) {
      Object.values(this.previewTower).forEach(p => p.destroy());
      this.previewTower = null;
    }
  }

  /**
   * 創建塔按鈕
   */
  createTowerButton(x, y, towerType, size = 70) {
    const config = TowerConfig[towerType];
    const button = this.scene.add.rectangle(x, y, size, size, config.color)
      .setStrokeStyle(3, 0x000000)
      .setInteractive();
    button.setDepth(101);

    const emojiSize = this.scene.gameMode === 'singlePlayer' ? '26px' : `${size / 2.5}px`;
    const emojiY = this.scene.gameMode === 'singlePlayer' ? y - 10 : y - (size / 6);
    const emoji = this.scene.add.text(x, emojiY, config.emoji, { fontSize: emojiSize }).setOrigin(0.5);
    emoji.setDepth(102);

    const costY = this.scene.gameMode === 'singlePlayer' ? y + 20 : y + (size / 3.5);
    const costSize = this.scene.gameMode === 'singlePlayer' ? '13px' : `${size / 5}px`;
    const costText = this.scene.add.text(x, costY, `$${config.cost}`, {
      fontSize: costSize,
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
      if (this.scene.gameMode === 'singlePlayer') {
        this.showTowerTooltip(config, x + 80, y);
      }
    });
    button.on('pointerout', () => {
      button.setStrokeStyle(3, 0x000000);
      button.setScale(1);
      if (this.scene.gameMode === 'singlePlayer') {
        this.hideTooltip();
      }
    });
  }

  /**
   * 顯示塔工具提示
   */
  showTowerTooltip(config, x, y) {
    if (this.tooltip) this.tooltip.destroy();
    const text = `${config.name}\n💰${config.cost} 💥${config.damage}\n📏${config.range}\n${config.description}`;
    this.tooltip = this.scene.add.text(x, y, text, {
      fontSize: '12px',
      color: '#FFFFFF',
      backgroundColor: '#1a1a1a',
      padding: { x: 8, y: 6 },
      fontStyle: 'bold',
      align: 'left'
    }).setOrigin(0, 0.5).setDepth(300);
  }

  /**
   * 隱藏工具提示
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  // #endregion

  // #region 工具方法

  /**
   * 創建塔網絡ID
   */
  createTowerNetworkId() {
    const timestamp = Date.now();
    const playerId = this.scene.localPlayerId || SocketService.socket?.id || 'local';
    return `${playerId}_tower_${timestamp}_${this.nextTowerNetworkId++}`;
  }

  /**
   * 創建格線覆蓋層（視覺化對齊輔助）
   */
  createGridOverlay(bounds) {
    if (this.gridOverlay) {
      this.gridOverlay.destroy();
    }

    const graphics = this.scene.add.graphics();
    graphics.setDepth(5); // 在草地上方，但在路徑和塔下方

    // 繪製淺色格線
    graphics.lineStyle(1, 0x000000, 0.08);

    const left = bounds.left || bounds.x;
    const top = bounds.top || bounds.y;
    const right = bounds.right || (bounds.x + bounds.width);
    const bottom = bounds.bottom || (bounds.y + bounds.height);

    // 對齊到格線起點
    const startX = Math.ceil(left / this.GRID_SIZE) * this.GRID_SIZE;
    const startY = Math.ceil(top / this.GRID_SIZE) * this.GRID_SIZE;

    // 繪製垂直線
    for (let x = startX; x <= right; x += this.GRID_SIZE) {
      graphics.moveTo(x, top);
      graphics.lineTo(x, bottom);
    }

    // 繪製水平線
    for (let y = startY; y <= bottom; y += this.GRID_SIZE) {
      graphics.moveTo(left, y);
      graphics.lineTo(right, y);
    }

    graphics.strokePath();

    // 在每個格線交叉點添加小點（可選，增加視覺輔助）
    graphics.fillStyle(0x000000, 0.1);
    for (let x = startX; x <= right; x += this.GRID_SIZE) {
      for (let y = startY; y <= bottom; y += this.GRID_SIZE) {
        graphics.fillCircle(x, y, 2);
      }
    }

    this.gridOverlay = graphics;
    return graphics;
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.hideUpgradePanel();
    this.hideSellConfirmDialog();
    this.hideTooltip();
    this.clearCraftSelection();

    if (this.previewTower) {
      Object.values(this.previewTower).forEach(p => p.destroy());
      this.previewTower = null;
    }

    this.selectedTower = null;
    this.selectedTowerObject = null;
    this.craftMode = false;
  }

  // #endregion
}
