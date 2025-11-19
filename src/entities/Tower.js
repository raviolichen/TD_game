import { TowerConfig } from '../config/towerConfig.js';

export default class Tower {
  constructor(scene, x, y, type) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    // 深拷貝設定避免個別塔升級時修改到全域平衡數值
    this.config = JSON.parse(JSON.stringify(TowerConfig[type]));

    this.lastFired = 0;
    this.target = null;
    this.level = 1;
    this.networkId = null;
    this.owner = 'self';
    this.isRemote = false;
    
    // 追蹤總投資成本（建造+升級）
    this.totalInvestment = this.config.cost;
    
    // 陷阱塔專用屬性
    if (this.config.maxTraps) {
      this.activeTrapCount = 0;
    }

    this.createVisuals();
    this.createRangeIndicator();
  }

  createVisuals() {
    // 塔的底座
    this.base = this.scene.add.circle(this.x, this.y, 20, this.config.color);
    this.base.setStrokeStyle(3, 0x000000);
    this.base.setDepth(20); // 塔在路徑上方

    // Emoji圖示
    this.sprite = this.scene.add.text(this.x, this.y, this.config.emoji, {
      fontSize: '32px'
    }).setOrigin(0.5);
    this.sprite.setDepth(21);

    // 等級指示器（徽章背景）
    this.tierBadge = this.scene.add.circle(this.x + 15, this.y - 15, 10,
      this.config.tier === 1 ? 0x808080 :
      this.config.tier === 2 ? 0x4169E1 : 0xFFD700
    );
    this.tierBadge.setStrokeStyle(2, 0x000000);
    this.tierBadge.setDepth(21);

    // 等級數字
    this.levelText = this.scene.add.text(this.x + 15, this.y - 15, `${this.level}`, {
      fontSize: '12px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.levelText.setDepth(22);

    // 設置互動
    this.base.setInteractive();
    this.sprite.setInteractive();

    // 保存所有視覺元素的引用
    this.visualElements = [this.base, this.sprite, this.tierBadge, this.levelText];
  }

  markAsOpponent() {
    this.owner = 'opponent';
    this.isRemote = true;
    const DIM_ALPHA = 0.65;
    if (this.base) {
      this.base.setAlpha(DIM_ALPHA);
      if (this.base.disableInteractive) this.base.disableInteractive();
    }
    if (this.sprite) {
      this.sprite.setAlpha(DIM_ALPHA);
      if (this.sprite.disableInteractive) this.sprite.disableInteractive();
    }
    if (this.tierBadge) this.tierBadge.setAlpha(DIM_ALPHA);
    if (this.levelText) this.levelText.setAlpha(DIM_ALPHA);
    if (this.rangeCircle) this.rangeCircle.setVisible(false);
  }

  createRangeIndicator() {
    this.rangeCircle = this.scene.add.circle(this.x, this.y, this.config.range);
    this.rangeCircle.setStrokeStyle(2, this.config.effectColor, 0.3);
    this.rangeCircle.setFillStyle(this.config.effectColor, 0.1);
    this.rangeCircle.setVisible(false);
    this.rangeCircle.setDepth(15); // 範圍圈在塔下方
  }

  showRange() {
    if (this.rangeCircle && this.rangeCircle.active) {
      this.rangeCircle.setVisible(true);
    }
  }

  hideRange() {
    if (this.rangeCircle && this.rangeCircle.active) {
      this.rangeCircle.setVisible(false);
    }
  }

  update(time, enemies, auraBonus = null, delta = 16) {
    // 純光環塔不攻擊（光環塔不攻擊，但蒸汽工廠例外）
    if (this.config.isAura && this.type !== 'steamFactory') {
      return;
    }

    // 檢查是否被Boss凍結
    if (this.freezeDuration && this.freezeDuration > 0) {
      this.freezeDuration = Math.max(0, this.freezeDuration - delta);
      return; // 被凍結時不攻擊
    }

    // 陷阱塔特殊處理（放置陷阱而非普攻）
    if (this.config.maxTraps && this.config.trapDuration) {
      // 計算實際放置速度
      let actualFireRate = this.config.fireRate;
      if (auraBonus && auraBonus.attackSpeedBonus > 0) {
        actualFireRate = this.config.fireRate / (1 + auraBonus.attackSpeedBonus);
      }

      if (time > this.lastFired + actualFireRate) {
        this.placeTrap();
        this.lastFired = time;
      }
      return;
    }

    // 隕石塔特殊處理（全地圖攻擊，不需要目標）
    if (this.config.meteorCountMin && this.config.meteorCountMax) {
      // 計算實際攻速
      let actualFireRate = this.config.fireRate;
      if (auraBonus && auraBonus.attackSpeedBonus > 0) {
        actualFireRate = this.config.fireRate / (1 + auraBonus.attackSpeedBonus);
      }

      if (time > this.lastFired + actualFireRate) {
        this.fireMeteors(auraBonus);
        this.lastFired = time;
      }
      return;
    }

    // 尋找目標
    if (!this.target || !this.target.active || !this.isInRange(this.target)) {
      this.target = this.findTarget(enemies);
    }

    // 計算實際攻速（應用光環加成）
    // GameScene 會傳入已套用加速倍率的時間，所以不用另外處理 timeScale
    let actualFireRate = this.config.fireRate;
    if (auraBonus && auraBonus.attackSpeedBonus > 0) {
      // 攻速提升 = 減少攻擊間隔
      actualFireRate = this.config.fireRate / (1 + auraBonus.attackSpeedBonus);
    }

    // 攻擊目標
    if (this.target && time > this.lastFired + actualFireRate) {
      this.fire(auraBonus);
      this.lastFired = time;
    }
  }

  fireMeteors(auraBonus = null) {
    // 計算隕石數量
    const count = Phaser.Math.Between(
      this.config.meteorCountMin,
      this.config.meteorCountMax
    );

    // 通知場景創建隕石（使用 effectManager）
    if (this.scene.effectManager) {
      this.scene.effectManager.createMeteorStrike(
        count,
        this.config,
        this,
        auraBonus,
        this.scene.enemies
      );
    }

    // 播放發射動畫
    this.playFireAnimation();
  }

  findTarget(enemies) {
    let closestEnemy = null;
    let closestDistance = this.config.range;

    for (const enemy of enemies) {
      if (!enemy.active) continue;

      const distance = Phaser.Math.Distance.Between(
        this.x, this.y, enemy.x, enemy.y
      );

      if (distance <= this.config.range && distance < closestDistance) {
        closestEnemy = enemy;
        closestDistance = distance;
      }
    }

    return closestEnemy;
  }

  isInRange(enemy) {
    const distance = Phaser.Math.Distance.Between(
      this.x, this.y, enemy.x, enemy.y
    );
    return distance <= this.config.range;
  }

  fire(auraBonus = null) {
    if (!this.target) return;

    // 創建子彈特效
    this.createProjectile(this.target, auraBonus);

    // 播放射擊動畫
    this.playFireAnimation();
  }

  createProjectile(target, auraBonus = null) {
    // 計算實際傷害（應用光環加成）
    let actualDamage = this.config.damage;
    if (auraBonus && auraBonus.damageBonus > 0) {
      actualDamage = this.config.damage * (1 + auraBonus.damageBonus);
    }

    const projectile = {
      x: this.x,
      y: this.y,
      target: target,
      speed: this.config.projectileSpeed,
      damage: actualDamage,
      towerType: this.type,
      config: this.config,
      sourceTower: this, // 添加來源塔引用
      graphic: null
    };

    // 創建子彈視覺效果
    projectile.graphic = this.scene.add.circle(this.x, this.y, 7, this.config.effectColor);
    projectile.graphic.setStrokeStyle(2, 0xFFFFFF);
    projectile.graphic.setDepth(30); // 子彈在塔之上，敵人之下

    // 添加發光效果
    projectile.glow = this.scene.add.circle(this.x, this.y, 12, this.config.effectColor, 0.4);
    projectile.glow.setDepth(29); // 發光在子彈下方

    // 添加到投射物管理器
    if (this.scene.projectileManager) {
      this.scene.projectileManager.addProjectile(projectile);
    }

    // 創建粒子特效
    this.createFireParticles();
  }

  createFireParticles() {
    // 發射粒子特效
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: this.config.effectColor,
      lifespan: 300,
      quantity: 5,
      blendMode: 'ADD'
    });
    particles.setDepth(30);

    this.scene.time.delayedCall(300, () => {
      particles.destroy();
    });
  }

  playFireAnimation() {
    // 射擊時的彈跳動畫
    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1, to: 1.2 },
      duration: 100,
      yoyo: true,
      ease: 'Power2'
    });
  }

  upgrade() {
    // 計算升級成本並添加到總投資
    const upgradeCost = Math.floor(this.config.cost * 0.6);
    this.totalInvestment += upgradeCost;
    
    this.level++;
    this.config.damage *= 1.2;
    this.config.range *= 1.05; // 降低範圍增長率從1.1到1.05，避免後期過於強大
    
    // 地面火焰傷害也隨升級提升
    if (this.config.groundFireDamage) {
      this.config.groundFireDamage *= 1.2;
    }

    // 更新範圍圈
    this.rangeCircle.setRadius(this.config.range);

    // 更新等級文字
    if (this.levelText) {
      this.levelText.setText(`${this.level}`);
    }

    // 根據等級改變徽章顏色
    if (this.tierBadge) {
      let badgeColor;
      if (this.level >= 10) {
        badgeColor = 0xFF1493; // 深粉紅 (10級以上)
      } else if (this.level >= 7) {
        badgeColor = 0xFF4500; // 橙紅 (7-9級)
      } else if (this.level >= 5) {
        badgeColor = 0xFFD700; // 金色 (5-6級)
      } else if (this.level >= 3) {
        badgeColor = 0x4169E1; // 藍色 (3-4級)
      } else {
        badgeColor = 0x808080; // 灰色 (1-2級)
      }
      this.tierBadge.setFillStyle(badgeColor);
    }

    // 升級視覺效果
    this.scene.tweens.add({
      targets: [this.base, this.sprite, this.tierBadge, this.levelText],
      scale: { from: 1, to: 1.3 },
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut'
    });
  }

  destroy() {
    // 銷毀所有視覺元素
    if (this.base && this.base.active) this.base.destroy();
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    if (this.tierBadge && this.tierBadge.active) this.tierBadge.destroy();
    if (this.levelText && this.levelText.active) this.levelText.destroy();
    if (this.rangeCircle && this.rangeCircle.active) this.rangeCircle.destroy();

    // 清空引用
    this.base = null;
    this.sprite = null;
    this.tierBadge = null;
    this.levelText = null;
    this.rangeCircle = null;
    this.visualElements = null;
  }

  placeTrap() {
    // 檢查是否已達到最大陷阱數量
    if (this.activeTrapCount >= this.config.maxTraps) {
      return;
    }

    // 獲取路徑點
    const path = this.scene.gameMode === 'multiplayer' ? this.scene.playerPath : this.scene.path;
    if (!path || path.length === 0) return;

    // 在塔的範圍內選擇路徑正中間的位置放置陷阱
    const validPositions = [];
    path.forEach(point => {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, point.x, point.y);
      if (distance <= this.config.range) {
        // 直接放在路徑點上，不偏移
        validPositions.push({
          x: point.x,
          y: point.y
        });
      }
    });

    if (validPositions.length === 0) return;

    // 隨機選擇一個位置
    const trapPosition = Phaser.Math.RND.pick(validPositions);
    
    // 創建陷阱
    this.createTrap(trapPosition.x, trapPosition.y);
    
    // 播放放置動畫
    this.playFireAnimation();
  }

  createTrap(x, y) {
    // 隨機選擇陷阱類型
    const trapTypes = [
      { emoji: '💥', effect: 'damage', color: 0xFF4500 },      // 爆炸陷阱
      { emoji: '❄️', effect: 'freeze', color: 0x87CEEB },      // 冰凍陷阱
      { emoji: '☠️', effect: 'poison', color: 0x32CD32 },      // 毒性陷阱
      { emoji: '⚡', effect: 'stun', color: 0xFFFF00 }         // 電擊陷阱
    ];
    
    const trapType = Phaser.Math.RND.pick(trapTypes);
    
    // 創建陷阱視覺
    const trapCircle = this.scene.add.circle(x, y, 15, trapType.color, 0.3);
    trapCircle.setStrokeStyle(2, trapType.color, 0.8);
    trapCircle.setDepth(10);
    
    const trapEmoji = this.scene.add.text(x, y, trapType.emoji, {
      fontSize: '20px'
    }).setOrigin(0.5);
    trapEmoji.setDepth(11);
    
    // 脈動動畫
    this.scene.tweens.add({
      targets: [trapCircle, trapEmoji],
      scale: { from: 1, to: 1.2 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const trap = {
      x,
      y,
      type: trapType.effect,
      circle: trapCircle,
      emoji: trapEmoji,
      triggered: false,
      elapsed: 0,
      duration: this.config.trapDuration,
      sourceTower: this
    };

    this.activeTrapCount++;

    // 通知場景管理器追蹤陷阱
    if (this.scene.effectManager && this.scene.effectManager.addTrap) {
      this.scene.effectManager.addTrap(trap);
    } else {
      // 如果沒有專門的陷阱管理器，使用簡單的定時器
      this.scene.time.delayedCall(this.config.trapDuration, () => {
        this.removeTrap(trap);
      });
    }
  }

  removeTrap(trap) {
    if (trap.circle) trap.circle.destroy();
    if (trap.emoji) trap.emoji.destroy();
    this.activeTrapCount = Math.max(0, this.activeTrapCount - 1);
  }

  getInfo() {
    return {
      name: this.config.name,
      type: this.type,
      tier: this.config.tier,
      damage: Math.floor(this.config.damage),
      range: Math.floor(this.config.range),
      fireRate: this.config.fireRate,
      level: this.level,
      description: this.config.description
    };
  }
}
