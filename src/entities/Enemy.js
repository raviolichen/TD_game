// 怪物配置參數
const MINION_ABILITY_START_WAVE = 11; // 從第幾波開始小怪獲得技能
const HEALTH_BONUS_WAVE_INTERVAL = 10; // 每幾波額外增加血量

// 每波專屬怪物圖案系統（1-100波）
function getWaveMonsterEmoji(waveNumber) {
  // 101波之後使用固定圖案
  if (waveNumber > 100) {
    return '🤡'; // 固定圖案，後續會有雙倍體型
  }
  
  const monstersByWave = [
    // 第1-10波：昆蟲軍團
    '🐛', '🐝', '🐜', '🪲', '🦗', '🐞', '🕷️', '🦂', '🪰', '🦟',
    // 第11-20波：海洋怪物
    '🐙', '🦑', '🦀', '🦞', '🐟', '🦈', '🐠', '🐡', '🦭', '🐳',
    // 第21-30波：飛行生物
    '🦅', '🦆', '🦉', '🦇', '🐦', '🕊️', '🦜', '🦢', '🪶', '🐔',
    // 第31-40波：哺乳動物
    '🐺', '🦊', '🐻', '🐼', '🦘', '🐨', '🦒', '🦏', '🐘', '🦛',
    // 第41-50波：爬蟲類
    '🐍', '🦎', '🐊', '🐢', '🦖', '🦕', '🐲', '🐉', '🦴', '🗿',
    // 第51-60波：神話生物
    '👹', '👺', '👿', '💀', '☠️', '👻', '🎃', '🧟', '🧛', '🧌',
    // 第61-70波：機械軍團
    '🤖', '⚙️', '🔧', '⚡', '💻', '📡', '🛸', '🚀', '⭐', '💫',
    // 第71-80波：元素精靈
    '🔥', '💧', '🌪️', '❄️', '⚡', '☀️', '🌙', '✨', '💎', '🌟',
    // 第81-90波：植物怪物
    '🌵', '🌲', '🌳', '🍄', '🌿', '🌱', '🌾', '🌻', '🌹', '🌺',
    // 第91-100波：超自然存在
    '👽', '🛸', '🌌', '🔮', '🎭', '🗯️', '💭', '🌀', '♠️', '🃏'
  ];
  
  return monstersByWave[waveNumber - 1] || '👾';
}

function getWaveBossEmoji(waveNumber) {
  // 101波之後使用固定BOSS圖案
  if (waveNumber > 100) {
    return '🤡'; // 固定BOSS圖案，後續會有雙倍體型
  }
  
  // 每10波一個BOSS，共10種BOSS
  const bossEmojis = [
    '🕷️', // 第10波：蟲王
    '🦈', // 第20波：海王
    '🦅', // 第30波：天空領主
    '🐻', // 第40波：獸王
    '🐲', // 第50波：龍王
    '👹', // 第60波：惡魔王
    '🤖', // 第70波：機械王
    '🔥', // 第80波：元素王
    '🌳', // 第90波：森林王
    '👽'  // 第100波：外星霸主
  ];
  
  const bossIndex = Math.floor(waveNumber / 10) - 1;
  return bossEmojis[bossIndex] || '🐲';
}

export default class Enemy {
  constructor(scene, path, waveNumber = 1, isBoss = false) {
    this.scene = scene;
    this.path = path;
    this.pathIndex = 0;
    this.isBoss = isBoss;
    this.waveNumber = waveNumber;

    // 根據波數調整屬性
    let baseHealth = 100 + (waveNumber * 25); // 血量成長速度提升25%

    // 100波之前：每N波額外增加30-50%血量
    if (waveNumber <= 100) {
      const tenWaveMultiplier = Math.floor(waveNumber / HEALTH_BONUS_WAVE_INTERVAL);
      if (tenWaveMultiplier > 0) {
        const bonusPercent = 0.3 + (Math.random() * 0.2); // 30%-50%
        baseHealth *= (1 + (bonusPercent * tenWaveMultiplier));
      }
    } else {
      // 100波之後：每波血量翻倍
      const wavesAfter100 = waveNumber - 100;
      // 先計算100波時的血量
      const wave100Health = 100 + (100 * 25);
      const tenWaveMultiplier = Math.floor(100 / HEALTH_BONUS_WAVE_INTERVAL);
      const bonusPercent = 0.4; // 使用平均值40%
      const wave100Base = wave100Health * (1 + (bonusPercent * tenWaveMultiplier));
      // 每超過100波一波，血量翻倍
      baseHealth = wave100Base * Math.pow(2, wavesAfter100);
    }

    // 前5波血量調整：第1波-50%, 第2波-40%, 第3波-30%, 第4波-20%, 第5波-10%
    if (waveNumber <= 5) {
      const reduction = (6 - waveNumber) * 0.1; // 0.5, 0.4, 0.3, 0.2, 0.1
      baseHealth *= (1 - reduction);
    }

    this.maxHealth = isBoss ? baseHealth * 20 : baseHealth;
    this.health = this.maxHealth;
    this.speed = 50 + (waveNumber * 2);
    this.reward = Math.round(isBoss ? (10 + (waveNumber * 2)) * 10 / 3 : (10 + (waveNumber * 2)) / 3); // 金錢獎勵改為1/3
    this.damage = isBoss ? 5 : 1;

    this.active = true;
    this.x = path[0].x;
    this.y = path[0].y;
    this.lastHitByTower = null; // 追蹤最後擊中此怪物的塔

    // Boss技能系統
    this.bossAbilities = [];
    this.abilityTimers = {};
    if (isBoss) {
      this.initializeBossAbilities();
    } else if (waveNumber >= MINION_ABILITY_START_WAVE) {
      // 從指定波數開始，小怪隨機獲得一種Boss技能
      this.initializeMinionAbility();
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
      // BOSS使用波數專屬圖案
      emoji = getWaveBossEmoji(this.waveNumber);
      
      // 101波之後BOSS雙倍體型
      if (this.waveNumber > 100) {
        fontSize = '224px'; // 28px * 8 (雙倍於原本的4倍)
        healthBarY = this.y - 140; // 調整血條位置
        healthBarWidth = 320; // 血條也要加大
      } else {
        fontSize = '112px'; // 28px * 4
        healthBarY = this.y - 70; // 調整血條位置
        healthBarWidth = 160; // 血條也要加大 (40 * 4)
      }
    } else {
      // 普通怪物使用波數專屬圖案
      emoji = getWaveMonsterEmoji(this.waveNumber);
      
      // 101波之後普通怪物雙倍體型
      if (this.waveNumber > 100) {
        fontSize = '56px'; // 28px * 2 (雙倍體型)
        healthBarY = this.y - 40; // 調整血條位置
        healthBarWidth = 80; // 血條也要加大
      } else {
        fontSize = '28px';
        healthBarY = this.y - 20;
        healthBarWidth = 40;
      }
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

    // 如果有技能，顯示技能圖標
    if (this.bossAbilities.length > 0) {
      let iconOffsetX, iconOffsetY, iconFontSize;
      
      if (this.isBoss) {
        if (this.waveNumber > 100) {
          iconOffsetX = 120; // 雙倍距離
          iconOffsetY = -120; // 雙倍距離
          iconFontSize = '48px'; // 雙倍字體
        } else {
          iconOffsetX = 60;
          iconOffsetY = -60;
          iconFontSize = '24px';
        }
      } else {
        if (this.waveNumber > 100) {
          iconOffsetX = 30; // 雙倍距離
          iconOffsetY = -30; // 雙倍距離
          iconFontSize = '32px'; // 雙倍字體
        } else {
          iconOffsetX = 15;
          iconOffsetY = -15;
          iconFontSize = '16px';
        }
      }

      // 顯示所有技能圖標
      this.abilityIndicators = [];
      this.bossAbilities.forEach((ability, index) => {
        const indicator = this.scene.add.text(
          this.x + iconOffsetX + (index * 25),
          this.y + iconOffsetY,
          ability.icon,
          { fontSize: iconFontSize }
        );
        indicator.setDepth(52);
        this.abilityIndicators.push(indicator);
      });
    }
  }

  update(delta, auraBonus = null) {
    if (!this.active) return;

    // 更新Boss技能或小怪技能
    if (this.isBoss) {
      this.updateBossAbilities(delta);
    } else if (this.bossAbilities.length > 0) {
      this.updateMinionAbility(delta);
    }

    // 更新狀態效果
    this.updateEffects(delta);

    // 移動邏輯
    this.move(delta, auraBonus);

    // 更新視覺
    this.updateVisuals();
  }

  move(delta, auraBonus = null) {
    if (!this.path || this.path.length === 0) return;

    if (this.pathIndex >= this.path.length) {
      this.reachEnd();
      return;
    }

    const target = this.path[this.pathIndex];
    if (!target) return;

    const angle = Math.atan2(target.y - this.y, target.x - this.x);

    // 計算當前速度 (考慮減速效果和光環效果)
    let currentSpeed = this.speed;

    // 應用光環減速（最多減速至1%速度）
    if (auraBonus && auraBonus.enemySlowBonus > 0) {
      const slowAmount = Math.min(auraBonus.enemySlowBonus, 0.99); // 最多減速99%
      currentSpeed *= (1 - slowAmount);
    }

    if (this.effects.frozen.active) {
      currentSpeed = 0;
    } else if (this.effects.slowed.active) {
      currentSpeed *= (1 - this.effects.slowed.amount);
    }

    // delta 已經受到 time.timeScale 影響，所以移動速度會自動加速
    const moveDistance = currentSpeed * (delta / 1000);
    
    // 計算到目標點的距離
    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    
    // 如果移動距離大於到目標的距離，直接移動到目標點
    if (moveDistance >= distanceToTarget) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
    } else {
      // 正常移動
      this.x += Math.cos(angle) * moveDistance;
      this.y += Math.sin(angle) * moveDistance;
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
    let healthBarYOffset;
    if (this.isBoss) {
      healthBarYOffset = this.waveNumber > 100 ? -140 : -70;
    } else {
      healthBarYOffset = this.waveNumber > 100 ? -40 : -20;
    }
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
    let effectIconY;
    if (this.isBoss) {
      effectIconY = this.waveNumber > 100 ? this.y - 170 : this.y - 85;
    } else {
      effectIconY = this.waveNumber > 100 ? this.y - 70 : this.y - 35;
    }
    this.effectIndicators.forEach((indicator, index) => {
      indicator.setPosition(this.x - 15 + (index * 10), effectIconY);
    });

    // 更新技能圖標位置
    if (this.abilityIndicators && this.abilityIndicators.length > 0) {
      let iconOffsetX, iconOffsetY;
      if (this.isBoss) {
        if (this.waveNumber > 100) {
          iconOffsetX = 120; // 雙倍距離
          iconOffsetY = -120; // 雙倍距離
        } else {
          iconOffsetX = 60;
          iconOffsetY = -60;
        }
      } else {
        if (this.waveNumber > 100) {
          iconOffsetX = 30; // 雙倍距離
          iconOffsetY = -30; // 雙倍距離
        } else {
          iconOffsetX = 15;
          iconOffsetY = -15;
        }
      }
      this.abilityIndicators.forEach((indicator, index) => {
        indicator.setPosition(this.x + iconOffsetX + (index * 25), this.y + iconOffsetY);
      });
    }

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

    // 金幣獎勵已經在 onEnemyDied 中處理（包含加成計算）

    // 如果是Boss，觸發Boss擊敗獎勵
    if (this.isBoss && this.scene.waveManager && this.scene.waveManager.onBossDefeated) {
      this.scene.waveManager.onBossDefeated();
    }
  }

  reachEnd() {
    this.active = false;

    // 扣除生命
    if (this.scene.economyManager && this.scene.economyManager.loseLife) {
      this.scene.economyManager.loseLife(this.damage);
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
    if (this.abilityIndicators) {
      this.abilityIndicators.forEach(indicator => indicator.destroy());
    }
    this.effectIndicators.forEach(indicator => indicator.destroy());
  }

  // Boss技能系統
  initializeBossAbilities() {
    const availableAbilities = [
      { name: 'speed', icon: '⚡', desc: '加速', cooldown: 5000 },
      { name: 'summon', icon: '👾', desc: '召喚小怪', cooldown: 10000 },
      { name: 'leap', icon: '🦘', desc: '跳躍', cooldown: 8000 },
      { name: 'defense', icon: '🛡️', desc: '防禦', cooldown: 0 },
      { name: 'freeze', icon: '❄️', desc: '凍結塔', cooldown: 12000 }
    ];

    // 根據波數決定Boss技能數量
    const waveNum = this.scene ? this.scene.wave : 1;
    let abilityCount;

    if (waveNum >= 61) {
      // 61波以後：全部5種技能
      abilityCount = 5;
    } else if (waveNum >= 41) {
      // 41-60波：3種技能
      abilityCount = 3;
    } else {
      // 40波以前：1-2種技能
      abilityCount = Math.random() < 0.5 ? 1 : 2;
    }

    const shuffled = [...availableAbilities].sort(() => Math.random() - 0.5);
    this.bossAbilities = shuffled.slice(0, abilityCount);

    // 初始化技能計時器為冷卻時間，讓Boss一出場就能立即施放技能
    this.bossAbilities.forEach(ability => {
      this.abilityTimers[ability.name] = ability.cooldown;
    });

    // 顯示Boss技能
    const abilityText = this.bossAbilities.map(a => `${a.icon}${a.desc}`).join(' ');
    const uiManager = this.scene.uiManager;
    if (uiManager && uiManager.showMessage) {
      uiManager.showMessage(`Boss技能: ${abilityText}`, 0xFF00FF);
    }

    // 初始化防禦技能的傷害減免（如果有）
    if (this.bossAbilities.find(a => a.name === 'defense')) {
      this.damageReduction = 0.1 + Math.random() * 0.15; // 10%-25%
    }
  }

  // 小怪技能系統（從第11波開始）
  initializeMinionAbility() {
    const allAbilities = [
      { name: 'speed', icon: '⚡', desc: '加速', cooldown: 5000 },
      { name: 'leap', icon: '🦘', desc: '跳躍', cooldown: 8000 },
      { name: 'defense', icon: '🛡️', desc: '防禦', cooldown: 0 },
      { name: 'freeze', icon: '❄️', desc: '凍結塔', cooldown: 12000 }
    ];

    let availableAbilities = [];
    let abilityCount = 1;

    // 根據波數決定可用技能和數量
    const waveNum = this.scene ? this.scene.wave : 1;

    if (waveNum >= 51) {
      // 51波以後：全部4種技能
      availableAbilities = [...allAbilities];
      abilityCount = 4;
    } else if (waveNum >= 41) {
      // 41-50波：4種技能選2種
      availableAbilities = [...allAbilities];
      abilityCount = 2;
    } else if (waveNum >= 31) {
      // 31-40波：3種技能可選，選1種
      availableAbilities = [allAbilities[0], allAbilities[2], allAbilities[3]]; // 加速、防禦、凍結
      abilityCount = 1;
    } else if (waveNum >= 21) {
      // 21-30波：2種技能可選，選1種
      availableAbilities = [allAbilities[0], allAbilities[1]]; // 加速、跳躍
      abilityCount = 1;
    } else {
      // 11-20波：只有加速
      availableAbilities = [allAbilities[0]]; // 加速
      abilityCount = 1;
    }

    // 隨機選擇技能
    const shuffled = [...availableAbilities].sort(() => Math.random() - 0.5);
    this.bossAbilities = shuffled.slice(0, abilityCount);

    // 初始化技能計時器為冷卻時間，讓小怪一出場就能立即施放技能
    this.bossAbilities.forEach(ability => {
      this.abilityTimers[ability.name] = ability.cooldown;

      // 初始化防禦技能的傷害減免（如果有）
      if (ability.name === 'defense') {
        this.damageReduction = 0.05 + Math.random() * 0.1; // 5%-15% (比Boss弱)
      }
    });

    // 在小怪身上顯示技能圖標
    this.hasSpecialAbility = true;
  }

  updateBossAbilities(delta) {
    if (!this.isBoss || !this.active) return;

    // Boss技能無視冰凍狀態，即使被冰凍也能施放技能
    this.bossAbilities.forEach(ability => {
      this.abilityTimers[ability.name] += delta;

      switch(ability.name) {
        case 'speed':
          this.updateSpeedAbility(delta);
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

  updateMinionAbility(delta) {
    if (!this.active || this.bossAbilities.length === 0) return;

    const ability = this.bossAbilities[0];
    this.abilityTimers[ability.name] += delta;

    switch(ability.name) {
      case 'speed':
        this.updateSpeedAbility(delta);
        break;
      case 'leap':
        this.updateLeapAbility(delta);
        break;
      case 'freeze':
        this.updateFreezeAbility();
        break;
      // 小怪不會有召喚技能
    }
  }

  updateSpeedAbility(delta) {
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
      this.speedBoostDuration -= delta;
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
    // 在Boss當前位置召喚3-7隻小怪
    if (!this.scene || !this.scene.spawnLocalEnemy) return;
    if (this.pathIndex >= this.path.length) return;

    const minionCount = Math.floor(Math.random() * 5) + 3; // 3-7隻

    for (let i = 0; i < minionCount; i++) {
      const minion = this.scene.spawnLocalEnemy({ isBoss: false });
      if (!minion) continue;

      // 設置小怪從Boss當前位置開始
      minion.pathIndex = Math.min(this.pathIndex, minion.path.length - 1);

      // 計算小怪在Boss附近的隨機位置
      const offsetX = (Math.random() - 0.5) * 80;
      const offsetY = (Math.random() - 0.5) * 80;

      if (minion.pathIndex < minion.path.length) {
        const currentPathPoint = minion.path[minion.pathIndex];
        minion.x = currentPathPoint.x + offsetX;
        minion.y = currentPathPoint.y + offsetY;

        // 更新召喚小怪的視覺位置
        if (minion.sprite) {
          minion.sprite.setPosition(minion.x, minion.y);
        }
        if (minion.healthBar) {
          minion.healthBar.setPosition(minion.x, minion.y - 20);
        }
        if (minion.healthBarBg) {
          minion.healthBarBg.setPosition(minion.x, minion.y - 20);
        }
        if (minion.abilityIndicators) {
          minion.abilityIndicators.forEach((indicator, index) => {
            indicator.setPosition(minion.x + 15 + (index * 25), minion.y - 15);
          });
        }
      }
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
    // 向前跳25-50個路徑點（5倍距離）
    const leapDistance = Math.floor(Math.random() * 26) + 25; // 25-50
    const newPathIndex = Math.min(this.pathIndex + leapDistance, this.path.length - 1);

    if (newPathIndex > this.pathIndex && newPathIndex < this.path.length) {
      const targetPoint = this.path[newPathIndex];
      const oldX = this.x;
      const oldY = this.y;

      // 立即更新pathIndex
      this.pathIndex = newPathIndex;

      // 跳躍動畫：快速移動到目標點
      this.scene.tweens.add({
        targets: this,
        x: targetPoint.x,
        y: targetPoint.y,
        duration: 200, // 縮短動畫時間讓跳躍更明顯
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          // 動畫過程中更新視覺位置
          this.updateVisuals();
        }
      });

      // 跳躍特效：在起點產生粒子
      if (this.scene.add && this.scene.add.particles) {
        const particles = this.scene.add.particles(oldX, oldY, 'particle', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.5, end: 0 },
          tint: 0xFFFF00,
          lifespan: 300,
          quantity: 10
        });
        this.scene.time.delayedCall(300, () => particles.destroy());
      }
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
