/**
 * ProjectileManager - 管理遊戲中的所有投射物
 * 包括投射物更新、碰撞檢測、傷害計算
 */
export default class ProjectileManager {
  constructor(scene, effectManager) {
    this.scene = scene;
    this.effectManager = effectManager;
    this.projectiles = [];
  }

  /**
   * 更新所有投射物
   */
  update(delta, enemies) {
    this.projectiles = this.projectiles.filter(projectile => {
      if (!projectile.target.active) {
        projectile.graphic.destroy();
        if (projectile.glow) projectile.glow.destroy();
        return false;
      }

      const angle = Math.atan2(projectile.target.y - projectile.y, projectile.target.x - projectile.x);
      const moveDistance = projectile.speed * (delta / 1000);
      projectile.x += Math.cos(angle) * moveDistance;
      projectile.y += Math.sin(angle) * moveDistance;

      // 更新圖形位置
      projectile.graphic.setPosition(projectile.x, projectile.y);
      if (projectile.glow) projectile.glow.setPosition(projectile.x, projectile.y);

      // 處理旋轉效果
      const container = projectile.graphic;
      // 箭矢、火箭需要指向目標
      if (['arrow', 'rocket', 'sniper', 'machineGun', 'armorBreaker'].includes(projectile.type)) {
        container.setRotation(angle);
      }
      // 其他投射物自轉效果
      else if (projectile.type === 'ice' || projectile.type === 'freezeCannon' || projectile.type === 'frostFortress') {
        if (container.crystal) container.crystal.rotation += 0.05;
      }
      else if (projectile.type === 'solarFlare' && container.rays) {
        container.rays.rotation += 0.05;
      }
      else if (projectile.type === 'lightning' && container.spark) {
        container.spark.rotation += 0.2;
      }

      // 添加軌跡特效 (限制頻率，每 150ms 一次，避免效能爆炸)
      if (this.effectManager) {
        const now = this.scene.time.now;
        if (!projectile.lastTrailTime || now - projectile.lastTrailTime > 150) {
          this.effectManager.createProjectileTrail(projectile.x, projectile.y, projectile.type, projectile.config.color);
          projectile.lastTrailTime = now;
        }
      }

      const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, projectile.target.x, projectile.target.y);
      if (distance < 15) { //稍微增加判定範圍以適應較大的圖形
        this.handleProjectileHit(projectile, enemies);
        return false;
      }
      return true;
    });
  }

  /**
   * 處理投射物擊中目標
   */
  handleProjectileHit(projectile, enemies) {
    const target = projectile.target;
    const config = projectile.config;

    // 記錄最後擊中此怪物的塔（用於金幣加成計算）
    if (projectile.sourceTower) {
      target.lastHitByTower = projectile.sourceTower;
    }

    // 基礎傷害
    target.takeDamage(projectile.damage);

    // 百分比真實傷害
    if (config.percentDamage) {
      const percentDmg = target.maxHealth * config.percentDamage;
      target.takeDamage(percentDmg);
      // 顯示特殊傷害數字
      this.showPercentDamageText(target.x, target.y, percentDmg);
    }

    // 蒸汽工廠全地圖真傷加成
    const globalTrueDamage = this.calculateGlobalTrueDamage(target);
    if (globalTrueDamage > 0) {
      target.takeDamage(globalTrueDamage);
      this.showPercentDamageText(target.x, target.y - 15, globalTrueDamage);
    }

    if (config.dotDamage) target.applyBurn(config.dotDamage, config.dotDuration);
    if (config.poisonDamage) target.applyPoison(config.poisonDamage, config.poisonDuration);
    if (config.slow) target.applySlow(config.slow, config.slowDuration);
    if (config.freeze) target.applyFreeze(config.freezeDuration);

    // 擊退效果
    if (config.knockback) {
      if (config.knockbackSplash && config.splashRadius) {
        // 範圍擊退
        this.effectManager.applyKnockbackSplash(projectile.x, projectile.y, config, enemies);
      } else {
        // 單體擊退
        this.effectManager.applyKnockback(target, projectile.x, projectile.y, config.knockback);
      }
    }

    if (config.splashRadius) {
      this.effectManager.applySplashDamage(projectile.x, projectile.y, config, enemies);
    }

    if (config.chainCount) {
      this.effectManager.applyLightningChain(
        target,
        config,
        enemies,
        (x, y, amount) => this.showPercentDamageText(x, y, amount)
      );
    }

    // 地面火焰區域（機率觸發）
    if (config.groundFireDamage && config.groundFireDuration) {
      const chance = config.groundFireChance || 1.0; // 預設100%，如果沒設定機率
      if (Math.random() < chance) {
        this.effectManager.createGroundFire(projectile.x, projectile.y, config, projectile.sourceTower);
      }
    }

    // 效能優化：限制命中特效顯示頻率
    // 高射速塔 (MachineGun, Laser) 降低特效頻率到 10%，避免大量重疊導致掉幀
    // 其他塔則保持較高的特效顯示率 (80%)
    const isRapidFire = ['machineGun', 'laser', 'lightning', 'poison'].includes(projectile.type);
    const hitEffectChance = isRapidFire ? 0.1 : 0.8;

    if (Math.random() < hitEffectChance) {
      this.effectManager.createHitEffect(projectile.x, projectile.y, config.effectColor);
    }
    projectile.graphic.destroy();
    if (projectile.glow) projectile.glow.destroy();
  }

  /**
   * 顯示百分比傷害文字
   */
  showPercentDamageText(x, y, amount) {
    const damageText = this.scene.add.text(x + 20, y - 30, `-${Math.floor(amount)}%`, {
      fontSize: '14px',
      color: '#FF4500',
      fontStyle: 'bold',
      stroke: '#8B0000',
      strokeThickness: 3
    }).setOrigin(0.5);
    damageText.setDepth(60);

    this.scene.tweens.add({
      targets: damageText,
      y: y - 60,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => damageText.destroy()
    });
  }

  /**
   * 添加投射物到管理器
   */
  addProjectile(projectile) {
    // 根據塔的類型創建不同的視覺效果
    this.createProjectileVisual(projectile);
    this.projectiles.push(projectile);
  }

  /**
   * 根據塔類型創建投射物視覺效果
   */
  createProjectileVisual(projectile) {
    const config = projectile.config;
    const type = projectile.sourceTower ? projectile.sourceTower.type : 'arrow';

    // 如果已經有圖形則銷毀（防呆）
    if (projectile.graphic) projectile.graphic.destroy();

    // 創建容器或圖形
    const container = this.scene.add.container(projectile.x, projectile.y);
    projectile.graphic = container;

    const color = config.color || 0xFFFFFF;
    const effectColor = config.effectColor || 0xFFFF00;

    // 根據不同塔類型繪製不同形狀
    switch (type) {
      case 'arrow': // 箭塔
      case 'sniper': // 狙擊塔
      case 'machineGun': // 機槍塔
      case 'armorBreaker': // 破甲塔
        this.drawArrowProjectile(container, color, type);
        break;

      case 'rocket': // 火箭塔
      case 'steam': // 蒸氣塔
      case 'steamCannon': // 蒸汽炮
      case 'steamFactory': // 蒸汽工廠
        this.drawRocketProjectile(container, color, type);
        break;

      case 'fire': // 火焰塔
      case 'meteorTower': // 隕石塔
      case 'solarFlare': // 太陽炎塔
        this.drawFireProjectile(container, color, type);
        break;

      case 'ice': // 冰霜塔
      case 'freezeCannon': // 冰凍炮
      case 'frostFortress': // 極寒要塞
        this.drawIceProjectile(container, color, type);
        break;

      case 'poison': // 毒素塔
        this.drawPoisonProjectile(container, color);
        break;

      case 'magic': // 魔法塔
      case 'chaosArray': // 混沌法陣
        this.drawMagicProjectile(container, color, effectColor);
        break;

      case 'lightning': // 雷電塔
        this.drawLightningProjectile(container, color);
        break;

      case 'money': // 金錢塔
        this.drawMoneyProjectile(container);
        break;

      case 'ultimateCannon': // 終極炮塔
        this.drawEnergyBallProjectile(container, color, effectColor);
        break;

      default:
        // 默認圓形
        const circle = this.scene.add.circle(0, 0, 5, color);
        container.add(circle);
        break;
    }

    // 將投射物設置到場景最上層
    container.setDepth(60);

    // 保存類型供後續更新旋轉使用
    projectile.type = type;
  }

  // #region 各種投射物繪製方法

  drawArrowProjectile(container, color, type) {
    const isSniper = type === 'sniper';
    const isMachineGun = type === 'machineGun';

    // 箭桿
    const length = isSniper ? 20 : (isMachineGun ? 8 : 12);
    const width = isSniper ? 2 : (isMachineGun ? 2 : 3);
    const shaft = this.scene.add.rectangle(0, 0, length, width, color);

    // 箭頭
    const headSize = isSniper ? 6 : (isMachineGun ? 4 : 6);
    const head = this.scene.add.triangle(length / 2 + 2, 0, 0, -headSize, headSize, 0, 0, headSize, color);

    container.add([shaft, head]);

    // 初始旋轉會在 update 中處理
  }

  drawRocketProjectile(container, color, type) {
    // 彈體
    const body = this.scene.add.rectangle(0, 0, 14, 6, 0xDDDDDD);
    // 彈頭
    const head = this.scene.add.triangle(9, 0, 0, -4, 5, 0, 0, 4, 0xFF0000);
    // 尾翼
    const fin1 = this.scene.add.triangle(-6, -4, 0, 0, 4, 0, 0, 4, color);
    const fin2 = this.scene.add.triangle(-6, 4, 0, 0, 4, 0, 0, 4, color);

    container.add([fin1, fin2, body, head]);
  }

  drawFireProjectile(container, color, type) {
    const isSolar = type === 'solarFlare';
    const isMeteor = type === 'meteorTower';

    // 火球核心
    const core = this.scene.add.circle(0, 0, isSolar || isMeteor ? 8 : 5, 0xFFFF00);
    // 外層火焰
    const outer = this.scene.add.circle(0, 0, isSolar || isMeteor ? 12 : 8, color, 0.7);

    container.add([outer, core]);

    // 太陽塔旋轉效果在update處理
    if (isSolar) {
      const rays = this.scene.add.star(0, 0, 8, 4, 14, 0xFFFF00);
      container.add(rays);
      container.rays = rays; // 保存引用以供旋轉
    }
  }

  drawIceProjectile(container, color, type) {
    // 冰晶形狀 (六角星)
    const crystal = this.scene.add.star(0, 0, 6, 3, 7, color);
    const core = this.scene.add.circle(0, 0, 3, 0xFFFFFF);

    container.add([crystal, core]);
    container.crystal = crystal; // 保存引用以供旋轉
  }

  drawPoisonProjectile(container, color) {
    // 毒液泡泡
    const blob1 = this.scene.add.circle(0, 0, 5, color);
    const blob2 = this.scene.add.circle(-3, -2, 3, 0x00FF00);
    const blob3 = this.scene.add.circle(3, 2, 2, 0xADFF2F);

    container.add([blob1, blob2, blob3]);

    // 毒液蠕動效果 tween
    this.scene.tweens.add({
      targets: [blob2, blob3],
      x: '+=2',
      y: '+=2',
      yoyo: true,
      repeat: -1,
      duration: 300
    });
  }

  drawMagicProjectile(container, color, effectColor) {
    // 魔法光球
    const core = this.scene.add.circle(0, 0, 4, 0xFFFFFF);
    const glow = this.scene.add.circle(0, 0, 7, color, 0.6);
    const ring = this.scene.add.circle(0, 0, 9, effectColor, 0.3);

    container.add([ring, glow, core]);

    // 脈衝效果
    this.scene.tweens.add({
      targets: ring,
      scale: 1.2,
      alpha: 0,
      duration: 500,
      repeat: -1
    });
  }

  drawLightningProjectile(container, color) {
    // 閃電球
    const core = this.scene.add.circle(0, 0, 4, 0xFFFFFF);
    const spark = this.scene.add.star(0, 0, 4, 2, 8, color);

    container.add([spark, core]);
    container.spark = spark; // 供旋轉
  }

  drawMoneyProjectile(container) {
    // 金幣
    const coin = this.scene.add.circle(0, 0, 6, 0xFFD700);
    const inner = this.scene.add.text(0, 0, '$', {
      fontSize: '10px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([coin, inner]);
    container.coin = coin; // 供翻轉效果

    // 翻轉效果
    this.scene.tweens.add({
      targets: container,
      scaleX: 0.1,
      yoyo: true,
      repeat: -1,
      duration: 300
    });
  }

  drawEnergyBallProjectile(container, color, effectColor) {
    // 能量球
    const core = this.scene.add.circle(0, 0, 8, 0xFFFFFF);
    const energy = this.scene.add.circle(0, 0, 12, color, 0.8);
    const aura = this.scene.add.circle(0, 0, 16, effectColor, 0.4);

    container.add([aura, energy, core]);
  }

  // #endregion

  /**
   * 獲取當前投射物數量
   */
  getProjectileCount() {
    return this.projectiles.length;
  }

  /**
   * 清空所有投射物
   */
  clear() {
    this.projectiles.forEach(projectile => {
      if (projectile.graphic) projectile.graphic.destroy();
      if (projectile.glow) projectile.glow.destroy();
    });
    this.projectiles = [];
  }

  /**
   * 計算蒸汽工廠的全地圖真傷加成
   */
  calculateGlobalTrueDamage(target) {
    let totalTrueDamage = 0;

    // 檢查所有玩家塔，找出蒸汽工廠
    if (this.scene.playerTowers) {
      this.scene.playerTowers.forEach(tower => {
        if (tower.config.truePercentDamage) {
          // 每等級增加3%最大血量真傷
          const trueDamagePercent = tower.config.truePercentDamage * tower.level;
          totalTrueDamage += target.maxHealth * trueDamagePercent;
        }
      });
    }

    return totalTrueDamage;
  }
}
