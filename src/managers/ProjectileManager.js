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
      projectile.graphic.setPosition(projectile.x, projectile.y);
      if (projectile.glow) projectile.glow.setPosition(projectile.x, projectile.y);
      const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, projectile.target.x, projectile.target.y);
      if (distance < 10) {
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

    // 地面火焰區域
    if (config.groundFireDamage && config.groundFireDuration) {
      this.effectManager.createGroundFire(projectile.x, projectile.y, config, projectile.sourceTower);
    }

    this.effectManager.createHitEffect(projectile.x, projectile.y, config.effectColor);
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
      duration: 1000,
      ease: 'Power2',
      onComplete: () => damageText.destroy()
    });
  }

  /**
   * 添加投射物到管理器
   */
  addProjectile(projectile) {
    this.projectiles.push(projectile);
  }

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
}
