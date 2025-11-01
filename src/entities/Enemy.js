export default class Enemy {
  constructor(scene, path, waveNumber = 1, isBoss = false) {
    this.scene = scene;
    this.path = path;
    this.pathIndex = 0;
    this.isBoss = isBoss;

    // 根據波數調整屬性
    let baseHealth = 100 + (waveNumber * 25); // 血量成長速度提升25%

    // 每10波額外增加30-50%血量
    const tenWaveMultiplier = Math.floor(waveNumber / 10);
    if (tenWaveMultiplier > 0) {
      const bonusPercent = 0.3 + (Math.random() * 0.2); // 30%-50%
      baseHealth *= (1 + (bonusPercent * tenWaveMultiplier));
    }

    this.maxHealth = isBoss ? baseHealth * 20 : baseHealth;
    this.health = this.maxHealth;
    this.speed = 50 + (waveNumber * 2);
    this.reward = Math.round(isBoss ? (10 + (waveNumber * 2)) * 10 / 3 : (10 + (waveNumber * 2)) / 3); // 金錢獎勵改為1/3
    this.damage = isBoss ? 5 : 1;

    this.active = true;
    this.x = path[0].x;
    this.y = path[0].y;

    // Boss技能系統
    this.bossAbilities = [];
    this.abilityTimers = {};
    if (isBoss) {
      this.initializeBossAbilities();
    }

    // 狀態效果
    this.effects = {
      burning: { active: false, damage: 0, duration: 0, timer: 0 },
      poisoned: { active: false, damage: 0, duration: 0, timer: 0 },
      slowed: { active: false, amount: 0, duration: 0, timer: 0 },
      frozen: { active: false, duration: 0, timer: 0 }
    };

    this.createVisuals();
  }

  createVisuals() {
    // 敵人圖示
    let emoji, fontSize, healthBarY, healthBarWidth;

    if (this.isBoss) {
      // BOSS使用特殊emoji和4倍體型
      const bossEmojis = ['🐲', '👑', '💀', '🦖', '👿'];
      emoji = Phaser.Math.RND.pick(bossEmojis);
      fontSize = '112px'; // 28px * 4
      healthBarY = this.y - 70; // 調整血條位置
      healthBarWidth = 160; // 血條也要加大 (40 * 4)
    } else {
      // 普通怪物
      const monsterEmojis = ['👾', '👹', '👺', '🤖', '👻', '💀'];
      emoji = Phaser.Math.RND.pick(monsterEmojis);
      fontSize = '28px';
      healthBarY = this.y - 20;
      healthBarWidth = 40;
    }
    this.visualEmoji = emoji;

    this.sprite = this.scene.add.text(this.x, this.y, emoji, {
      fontSize: fontSize
    }).setOrigin(0.5);
    this.sprite.setDepth(50); // 確保在路徑上方

    // 血條背景
    this.healthBarBg = this.scene.add.rectangle(
      this.x, healthBarY, healthBarWidth, 6, 0x000000
    );
    this.healthBarBg.setDepth(50);

    // 血條
    this.healthBar = this.scene.add.rectangle(
      this.x, healthBarY, healthBarWidth, 6, 0x00FF00
    );
    this.healthBar.setDepth(51); // 血條在最上層

    // 保存血條參數供後續更新使用
    this.healthBarY = healthBarY;
    this.healthBarWidth = healthBarWidth;

    // 效果指示器容器
    this.effectIndicators = [];
  }

  update(delta, auraBonus = null) {
    if (!this.active) return;

    // 更新Boss技能
    if (this.isBoss) {
      this.updateBossAbilities(delta);
    }

    // 更新狀態效果
    this.updateEffects(delta);

    // 移動邏輯
    this.move(delta, auraBonus);

    // 更新視覺
    this.updateVisuals();
  }

  move(delta, auraBonus = null) {
    if (this.pathIndex >= this.path.length) {
      this.reachEnd();
      return;
    }

    const target = this.path[this.pathIndex];
    const angle = Math.atan2(target.y - this.y, target.x - this.x);

    // 計算當前速度 (考慮減速效果和光環效果)
    let currentSpeed = this.speed;

    // 應用光環減速
    if (auraBonus && auraBonus.enemySlowBonus > 0) {
      currentSpeed *= (1 - auraBonus.enemySlowBonus);
    }

    if (this.effects.frozen.active) {
      currentSpeed = 0;
    } else if (this.effects.slowed.active) {
      currentSpeed *= (1 - this.effects.slowed.amount);
    }

    const moveDistance = currentSpeed * (delta / 1000);
    this.x += Math.cos(angle) * moveDistance;
    this.y += Math.sin(angle) * moveDistance;

    // 檢查是否到達路徑點
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance < 5) {
      this.pathIndex++;
    }
  }

  updateEffects(delta) {
    const deltaSeconds = delta / 1000;

    // 燃燒效果
    if (this.effects.burning.active) {
      this.effects.burning.timer += delta;
      if (this.effects.burning.timer >= 1000) {
        this.takeDamage(this.effects.burning.damage);
        this.effects.burning.timer = 0;
        this.createBurnParticles();
      }
      this.effects.burning.duration -= delta;
      if (this.effects.burning.duration <= 0) {
        this.effects.burning.active = false;
      }
    }

    // 中毒效果
    if (this.effects.poisoned.active) {
      this.effects.poisoned.timer += delta;
      if (this.effects.poisoned.timer >= 1000) {
        this.takeDamage(this.effects.poisoned.damage);
        this.effects.poisoned.timer = 0;
        this.createPoisonParticles();
      }
      this.effects.poisoned.duration -= delta;
      if (this.effects.poisoned.duration <= 0) {
        this.effects.poisoned.active = false;
      }
    }

    // 減速效果
    if (this.effects.slowed.active) {
      this.effects.slowed.duration -= delta;
      if (this.effects.slowed.duration <= 0) {
        this.effects.slowed.active = false;
      }
    }

    // 冰凍效果
    if (this.effects.frozen.active) {
      this.effects.frozen.duration -= delta;
      if (this.effects.frozen.duration <= 0) {
        this.effects.frozen.active = false;
      }
    }
  }

  takeDamage(amount) {
    // 應用防禦技能減傷
    let finalDamage = amount;
    if (this.damageReduction) {
      finalDamage = amount * (1 - this.damageReduction);
    }

    this.health -= finalDamage;

    // 傷害數字特效
    this.showDamageText(finalDamage);

    if (this.health <= 0) {
      this.die();
    } else {
      // 受擊閃爍
      this.sprite.setTint(0xFF0000);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite) this.sprite.clearTint();
      });
    }
  }

  showDamageText(amount) {
    const damageText = this.scene.add.text(this.x, this.y - 30, `-${Math.floor(amount)}`, {
      fontSize: '16px',
      color: '#FF0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    damageText.setDepth(60); // 傷害數字在最上層

    this.scene.tweens.add({
      targets: damageText,
      y: damageText.y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => damageText.destroy()
    });
  }

  applyBurn(damage, duration) {
    this.effects.burning = {
      active: true,
      damage: damage,
      duration: duration,
      timer: 0
    };
    this.updateEffectIndicators();
  }

  applyPoison(damage, duration) {
    this.effects.poisoned = {
      active: true,
      damage: damage,
      duration: duration,
      timer: 0
    };
    this.updateEffectIndicators();
  }

  applySlow(amount, duration) {
    this.effects.slowed = {
      active: true,
      amount: amount,
      duration: duration,
      timer: 0
    };
    this.updateEffectIndicators();
  }

  applyFreeze(duration) {
    this.effects.frozen = {
      active: true,
      duration: duration,
      timer: 0
    };
    this.sprite.setTint(0x87CEEB);
    this.updateEffectIndicators();
  }

  updateEffectIndicators() {
    // 清除舊的指示器
    this.effectIndicators.forEach(indicator => indicator.destroy());
    this.effectIndicators = [];

    let offsetX = -15;

    if (this.effects.burning.active) {
      const icon = this.scene.add.text(this.x + offsetX, this.y - 35, '🔥', {
        fontSize: '12px'
      });
      icon.setDepth(52);
      this.effectIndicators.push(icon);
      offsetX += 10;
    }

    if (this.effects.poisoned.active) {
      const icon = this.scene.add.text(this.x + offsetX, this.y - 35, '☠️', {
        fontSize: '12px'
      });
      icon.setDepth(52);
      this.effectIndicators.push(icon);
      offsetX += 10;
    }

    if (this.effects.frozen.active) {
      const icon = this.scene.add.text(this.x + offsetX, this.y - 35, '❄️', {
        fontSize: '12px'
      });
      icon.setDepth(52);
      this.effectIndicators.push(icon);
      offsetX += 10;
    }

    if (this.effects.slowed.active) {
      const icon = this.scene.add.text(this.x + offsetX, this.y - 35, '🐌', {
        fontSize: '12px'
      });
      icon.setDepth(52);
      this.effectIndicators.push(icon);
    }
  }

  createBurnParticles() {
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.3, end: 0 },
      tint: 0xFF4500,
      lifespan: 200,
      quantity: 3
    });
    this.scene.time.delayedCall(200, () => particles.destroy());
  }

  createPoisonParticles() {
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.4, end: 0 },
      tint: 0x00FF00,
      lifespan: 250,
      quantity: 2
    });
    this.scene.time.delayedCall(250, () => particles.destroy());
  }

  updateVisuals() {
    if (!this.sprite) return;

    // 計算血條相對位置（隨怪物y軸移動）
    const healthBarYOffset = this.isBoss ? -70 : -20;
    const currentHealthBarY = this.y + healthBarYOffset;

    // 更新位置
    this.sprite.setPosition(this.x, this.y);
    this.healthBarBg.setPosition(this.x, currentHealthBarY);
    this.healthBar.setPosition(this.x, currentHealthBarY);

    // 更新血條
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.width = this.healthBarWidth * healthPercent;

    // 血量顏色
    if (healthPercent > 0.6) {
      this.healthBar.setFillStyle(0x00FF00);
    } else if (healthPercent > 0.3) {
      this.healthBar.setFillStyle(0xFFFF00);
    } else {
      this.healthBar.setFillStyle(0xFF0000);
    }

    // 更新效果圖標位置
    const effectIconY = this.isBoss ? this.y - 85 : this.y - 35;
    this.effectIndicators.forEach((indicator, index) => {
      indicator.setPosition(this.x - 15 + (index * 10), effectIconY);
    });

    // 冰凍效果視覺
    if (!this.effects.frozen.active && this.sprite.tintTopLeft === 0x87CEEB) {
      this.sprite.clearTint();
    }
  }

  die() {
    this.active = false;
    if (this.scene && this.scene.onEnemyDied) {
      this.scene.onEnemyDied(this);
    }

    // 死亡特效
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 0,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.destroy();
      }
    });

    // 爆炸粒子
    const particles = this.scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xFF0000, 0xFFFF00, 0xFF6347],
      lifespan: 500,
      quantity: 20,
      blendMode: 'ADD'
    });

    this.scene.time.delayedCall(500, () => particles.destroy());

    // 給予玩家金錢
    if (this.scene.addGold) {
      this.scene.addGold(this.reward);
    }

    // 如果是Boss，觸發Boss擊敗獎勵
    if (this.isBoss && this.scene.onBossDefeated) {
      this.scene.onBossDefeated();
    }
  }

  reachEnd() {
    this.active = false;

    // 扣除生命
    if (this.scene.loseLife) {
      this.scene.loseLife(this.damage);
    }
    if (this.scene && this.scene.onEnemyEscaped) {
      this.scene.onEnemyEscaped(this);
    }

    this.destroy();
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.healthBar) this.healthBar.destroy();
    if (this.healthBarBg) this.healthBarBg.destroy();
    this.effectIndicators.forEach(indicator => indicator.destroy());
  }

  // Boss技能系統
  initializeBossAbilities() {
    const availableAbilities = [
      { name: 'speed', icon: '⚡', desc: '加速' },
      { name: 'summon', icon: '👾', desc: '召喚小怪' },
      { name: 'leap', icon: '🦘', desc: '跳躍' },
      { name: 'defense', icon: '🛡️', desc: '防禦' },
      { name: 'freeze', icon: '❄️', desc: '凍結塔' }
    ];

    // 隨機選擇1-2種技能
    const abilityCount = Math.random() < 0.5 ? 1 : 2;
    const shuffled = [...availableAbilities].sort(() => Math.random() - 0.5);
    this.bossAbilities = shuffled.slice(0, abilityCount);

    // 初始化技能計時器
    this.bossAbilities.forEach(ability => {
      this.abilityTimers[ability.name] = 0;
    });

    // 顯示Boss技能
    const abilityText = this.bossAbilities.map(a => `${a.icon}${a.desc}`).join(' ');
    if (this.scene.showMessage) {
      this.scene.showMessage(`Boss技能: ${abilityText}`, 0xFF00FF);
    }

    // 初始化防禦技能的傷害減免（如果有）
    if (this.bossAbilities.find(a => a.name === 'defense')) {
      this.damageReduction = 0.1 + Math.random() * 0.15; // 10%-25%
    }
  }

  updateBossAbilities(delta) {
    if (!this.isBoss || !this.active) return;

    this.bossAbilities.forEach(ability => {
      this.abilityTimers[ability.name] += delta;

      switch(ability.name) {
        case 'speed':
          this.updateSpeedAbility();
          break;
        case 'summon':
          this.updateSummonAbility();
          break;
        case 'leap':
          this.updateLeapAbility(delta);
          break;
        case 'freeze':
          this.updateFreezeAbility();
          break;
      }
    });
  }

  updateSpeedAbility() {
    // 加速技能：每5秒觸發一次，持續2秒
    if (this.abilityTimers.speed >= 5000) {
      if (!this.speedBoostActive) {
        this.speedBoostActive = true;
        this.speedBoostDuration = 2000;
        this.originalSpeed = this.speed;
        this.speed *= 1.5; // 提速50%
      }
    }

    if (this.speedBoostActive) {
      this.speedBoostDuration -= 16; // 假設60fps
      if (this.speedBoostDuration <= 0) {
        this.speedBoostActive = false;
        this.speed = this.originalSpeed;
        this.abilityTimers.speed = 0;
      }
    }
  }

  updateSummonAbility() {
    // 召喚小怪：每10秒召喚一次
    if (this.abilityTimers.summon >= 10000) {
      this.summonMinion();
      this.abilityTimers.summon = 0;
    }
  }

  summonMinion() {
    // 在Boss當前位置召喚小怪
    if (this.scene && this.scene.enemies) {
      const minion = new Enemy(this.scene, this.path, 1, false);
      minion.pathIndex = this.pathIndex;
      minion.x = this.x + (Math.random() - 0.5) * 50;
      minion.y = this.y + (Math.random() - 0.5) * 50;
      this.scene.enemies.push(minion);
    }
  }

  updateLeapAbility(delta) {
    // 跳躍技能：每8秒跳躍一次
    if (this.abilityTimers.leap >= 8000) {
      this.performLeap();
      this.abilityTimers.leap = 0;
    }
  }

  performLeap() {
    // 向前跳3-5個路徑點
    const leapDistance = Math.floor(Math.random() * 3) + 3;
    this.pathIndex = Math.min(this.pathIndex + leapDistance, this.path.length - 1);

    if (this.pathIndex < this.path.length) {
      const targetPoint = this.path[this.pathIndex];

      // 跳躍動畫
      this.scene.tweens.add({
        targets: this,
        x: targetPoint.x,
        y: targetPoint.y,
        duration: 300,
        ease: 'Power2'
      });
    }
  }

  updateFreezeAbility() {
    // 凍結塔技能：每12秒凍結一個隨機塔2秒
    if (this.abilityTimers.freeze >= 12000) {
      this.freezeRandomTower();
      this.abilityTimers.freeze = 0;
    }
  }

  freezeRandomTower() {
    if (this.scene && this.scene.towers && this.scene.towers.length > 0) {
      const randomTower = this.scene.towers[Math.floor(Math.random() * this.scene.towers.length)];
      randomTower.freezeDuration = 2000; // 凍結2秒

      // 視覺效果
      if (randomTower.sprite) {
        randomTower.sprite.setTint(0x87CEEB);
        this.scene.time.delayedCall(2000, () => {
          if (randomTower.sprite) randomTower.sprite.clearTint();
        });
      }
    }
  }
}
