/**
 * EffectManager - 管理遊戲中的所有特效系統
 * 包括地面火焰、隕石、擊退、範圍傷害、閃電鏈等
 */
export default class EffectManager {
  constructor(scene) {
    this.scene = scene;
    this.groundFires = [];
  }

  // #region 地面火焰系統

  createGroundFire(x, y, config, sourceTower) {
    // 檢查是否超過最大火焰區域數量
    if (sourceTower && config.maxGroundFires) {
      const towerFires = this.groundFires.filter(f => f.sourceTower === sourceTower);
      if (towerFires.length >= config.maxGroundFires) {
        // 移除最舊的火焰
        const oldestFire = towerFires[0];
        this.removeGroundFire(oldestFire);
      }
    }

    const radius = config.groundFireRadius || 100;
    const duration = config.groundFireDuration || 5000;
    const damage = config.groundFireDamage || 10;

    // 創建火焰視覺效果
    const fireCircle = this.scene.add.circle(x, y, radius, 0xFF4500, 0.3);
    fireCircle.setStrokeStyle(3, 0xFF0000, 0.8);
    fireCircle.setDepth(15);

    // 火焰emoji裝飾
    const fireEmoji = this.scene.add.text(x, y, '🔥', {
      fontSize: '32px'
    }).setOrigin(0.5);
    fireEmoji.setDepth(16);

    // 創建持續的火焰粒子
    const fireParticles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 20, max: 40 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xFF4500, 0xFF6347, 0xFFD700],
      lifespan: 600,
      frequency: 100,
      blendMode: 'ADD'
    });
    fireParticles.setDepth(16);

    const groundFire = {
      x,
      y,
      radius,
      damage,
      damageInterval: 500, // 每0.5秒造成一次傷害
      lastDamageTime: Date.now(),
      duration,
      createdAt: Date.now(),
      circle: fireCircle,
      emoji: fireEmoji,
      particles: fireParticles,
      sourceTower
    };

    this.groundFires.push(groundFire);
  }

  updateGroundFires(delta, enemies) {
    const currentTime = Date.now();

    this.groundFires = this.groundFires.filter(fire => {
      const elapsed = currentTime - fire.createdAt;

      // 檢查是否過期
      if (elapsed >= fire.duration) {
        this.removeGroundFire(fire);
        return false;
      }

      // 對範圍內的敵人造成傷害
      if (currentTime - fire.lastDamageTime >= fire.damageInterval) {
        enemies.forEach(enemy => {
          if (!enemy.active) return;
          const distance = Phaser.Math.Distance.Between(fire.x, fire.y, enemy.x, enemy.y);
          if (distance <= fire.radius) {
            enemy.takeDamage(fire.damage);
            enemy.createBurnParticles(); // 顯示燃燒特效
          }
        });
        fire.lastDamageTime = currentTime;
      }

      // 更新視覺效果（脈動動畫）
      const progress = elapsed / fire.duration;
      fire.circle.setAlpha(0.3 * (1 - progress * 0.5));

      return true;
    });
  }

  removeGroundFire(fire) {
    if (fire.circle) fire.circle.destroy();
    if (fire.emoji) fire.emoji.destroy();
    if (fire.particles) fire.particles.destroy();
  }

  // #endregion

  // #region 隕石系統

  createMeteorStrike(count, config, sourceTower, auraBonus, enemies) {
    // 獲取路徑點
    const path = this.scene.gameMode === 'multiplayer' ? this.scene.playerPath : this.scene.path;
    if (!path || path.length === 0) return;

    for (let i = 0; i < count; i++) {
      // 在路徑上隨機選擇一個位置
      const randomIndex = Phaser.Math.Between(0, path.length - 1);
      const targetPoint = path[randomIndex];

      // 添加一些隨機偏移
      const offsetX = Phaser.Math.Between(-50, 50);
      const offsetY = Phaser.Math.Between(-50, 50);
      const x = targetPoint.x + offsetX;
      const y = targetPoint.y + offsetY;

      // 延遲召喚隕石（讓它們不要同時落下）
      this.scene.time.delayedCall(i * 150, () => {
        this.spawnMeteor(x, y, config, sourceTower, auraBonus, enemies);
      });
    }
  }

  spawnMeteor(x, y, config, sourceTower, auraBonus, enemies) {
    // 創建隕石視覺效果（從上方快速墜落）
    const startY = -100;
    const meteorEmoji = this.scene.add.text(x, startY, '☄️', {
      fontSize: '48px'
    }).setOrigin(0.5);
    meteorEmoji.setDepth(100);

    // 創建尾焰粒子
    const trailParticles = this.scene.add.particles(x, startY, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xFF4500, 0xFF6347, 0xFFD700],
      lifespan: 300,
      frequency: 50,
      blendMode: 'ADD'
    });
    trailParticles.setDepth(99);

    // 隕石墜落動畫
    this.scene.tweens.add({
      targets: [meteorEmoji],
      y: y,
      duration: 800,
      ease: 'Power3',
      onUpdate: (tween) => {
        // 粒子跟隨隕石
        trailParticles.setPosition(meteorEmoji.x, meteorEmoji.y);
      },
      onComplete: () => {
        // 隕石撞擊
        trailParticles.destroy();
        meteorEmoji.destroy();

        // 計算實際傷害（應用光環加成）
        let actualDamage = config.damage;
        if (auraBonus && auraBonus.damageBonus > 0) {
          actualDamage = config.damage * (1 + auraBonus.damageBonus);
        }

        // 撞擊傷害
        enemies.forEach(enemy => {
          if (!enemy.active) return;
          const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
          if (distance <= config.meteorSplashRadius) {
            enemy.takeDamage(actualDamage);
            if (sourceTower) {
              enemy.lastHitByTower = sourceTower;
            }
          }
        });

        // 創建爆炸特效
        this.createMeteorExplosion(x, y, config);

        // 留下地面火焰
        if (config.groundFireDamage) {
          this.createGroundFire(x, y, config, sourceTower);
        }
      }
    });
  }

  createMeteorExplosion(x, y, config) {
    // 爆炸圈
    const explosionRing = this.scene.add.circle(x, y, 20, 0xFF4500, 0.8);
    explosionRing.setDepth(55);

    this.scene.tweens.add({
      targets: explosionRing,
      radius: config.meteorSplashRadius,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => explosionRing.destroy()
    });

    // 爆炸粒子
    const explosionParticles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 },
      scale: { start: 2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xFF4500, 0xFF6347, 0xFFD700, 0xFF8C00],
      lifespan: 800,
      quantity: 30,
      blendMode: 'ADD'
    });
    explosionParticles.setDepth(60);

    this.scene.time.delayedCall(800, () => explosionParticles.destroy());

    // 震動效果
    this.scene.cameras.main.shake(100, 0.003);
  }

  // #endregion

  // #region 擊退效果

  applyKnockback(enemy, fromX, fromY, knockbackDistance) {
    if (!enemy.active) return;

    // 計算擊退方向（從攻擊點指向敵人）
    const angle = Math.atan2(enemy.y - fromY, enemy.x - fromX);
    const knockbackX = Math.cos(angle) * knockbackDistance;
    const knockbackY = Math.sin(angle) * knockbackDistance;

    // 應用擊退，並確保不會推出地圖邊界
    const newX = Math.max(0, Math.min(this.scene.cameras.main.width, enemy.x + knockbackX));
    const newY = Math.max(0, Math.min(this.scene.cameras.main.height, enemy.y + knockbackY));

    // 使用tween實現平滑的擊退動畫
    this.scene.tweens.add({
      targets: enemy,
      x: newX,
      y: newY,
      duration: 200,
      ease: 'Power2'
    });

    // 創建蒸汽特效
    this.createSteamEffect(enemy.x, enemy.y);
  }

  applyKnockbackSplash(x, y, config, enemies) {
    enemies.forEach(enemy => {
      if (!enemy.active) return;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= config.splashRadius) {
        this.applyKnockback(enemy, x, y, config.knockback);
      }
    });
  }

  createSteamEffect(x, y) {
    // 蒸汽粒子效果
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 60 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: [0xF0F8FF, 0xE0FFFF, 0x87CEEB],
      lifespan: 400,
      quantity: 8,
      blendMode: 'NORMAL'
    });
    particles.setDepth(55);

    this.scene.time.delayedCall(400, () => particles.destroy());
  }

  // #endregion

  // #region 範圍傷害和連鎖效果

  applySplashDamage(x, y, config, enemies) {
    enemies.forEach(enemy => {
      if (!enemy.active) return;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= config.splashRadius) {
        enemy.takeDamage(config.damage * 0.5);
        if (config.poisonDamage) enemy.applyPoison(config.poisonDamage, config.poisonDuration);
      }
    });
    const explosionRing = this.scene.add.circle(x, y, 10, config.effectColor, 0.4).setDepth(55);
    this.scene.tweens.add({
      targets: explosionRing,
      radius: config.splashRadius,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => explosionRing.destroy()
    });
  }

  applyLightningChain(startTarget, config, enemies, showPercentDamageCallback) {
    let currentTarget = startTarget;
    const hitTargets = [startTarget];
    let chainDecay = config.chainPercentDecay || 0.7; // 預設70%，或使用配置的遞減率

    for (let i = 1; i < config.chainCount; i++) {
      let nextTarget = null;
      let closestDistance = config.chainRange;
      enemies.forEach(enemy => {
        if (!enemy.active || hitTargets.includes(enemy)) return;
        const distance = Phaser.Math.Distance.Between(currentTarget.x, currentTarget.y, enemy.x, enemy.y);
        if (distance < closestDistance) {
          nextTarget = enemy;
          closestDistance = distance;
        }
      });
      if (nextTarget) {
        this.drawLightning(currentTarget.x, currentTarget.y, nextTarget.x, nextTarget.y);

        // 基礎傷害（連鎖遞減）
        const chainDamage = config.damage * Math.pow(chainDecay, i);
        nextTarget.takeDamage(chainDamage);

        // 百分比真傷（連鎖遞減）
        if (config.percentDamage && showPercentDamageCallback) {
          const percentDmg = nextTarget.maxHealth * config.percentDamage * Math.pow(chainDecay, i);
          nextTarget.takeDamage(percentDmg);
          showPercentDamageCallback(nextTarget.x, nextTarget.y, percentDmg);
        }

        hitTargets.push(nextTarget);
        currentTarget = nextTarget;
      } else {
        break;
      }
    }
  }

  drawLightning(x1, y1, x2, y2) {
    const graphics = this.scene.add.graphics().setDepth(55);
    graphics.lineStyle(3, 0xFFFFFF, 1);
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.strokePath();
    this.scene.time.delayedCall(100, () => graphics.destroy());
  }

  // #endregion

  // #region 視覺特效

  createHitEffect(x, y, color) {
    const circle = this.scene.add.circle(x, y, 10, color, 0.8).setDepth(55);
    this.scene.tweens.add({ targets: circle, radius: 30, alpha: 0, duration: 300, onComplete: () => circle.destroy() });
  }

  createBuildEffect(x, y, color) {
    const circle = this.scene.add.circle(x, y, 10, color, 0.5).setDepth(55);
    this.scene.tweens.add({ targets: circle, radius: 50, alpha: 0, duration: 500, onComplete: () => circle.destroy() });
  }

  createUpgradeEffect(x, y, color) {
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 100 },
      scale: { start: 1, end: 0 },
      tint: color,
      lifespan: 500,
      quantity: 15,
      blendMode: 'ADD'
    }).setDepth(55);
    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  createCraftEffect(x, y, color) {
    const ring1 = this.scene.add.circle(x, y, 20, color, 0.6).setDepth(55);
    const ring2 = this.scene.add.circle(x, y, 30, color, 0.4).setDepth(54);
    this.scene.tweens.add({
      targets: [ring1, ring2],
      radius: { from: [20, 30], to: [60, 80] },
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        ring1.destroy();
        ring2.destroy();
      }
    });
  }

  // #endregion
}
