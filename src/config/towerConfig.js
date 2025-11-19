// 塔的配置數據
export const TowerTypes = {
  // 基礎塔
  ARROW: 'arrow',
  FIRE: 'fire',
  ICE: 'ice',
  MAGIC: 'magic',

  // 中階塔
  MACHINE_GUN: 'machineGun',
  ROCKET: 'rocket',
  FREEZE_CANNON: 'freezeCannon',
  LIGHTNING: 'lightning',
  POISON: 'poison',
  SNIPER: 'sniper',
  TRAP: 'trap',
  STEAM: 'steam',

  // 終極塔
  ULTIMATE_CANNON: 'ultimateCannon',
  FROST_FORTRESS: 'frostFortress',
  CHAOS_ARRAY: 'chaosArray',
  SOLAR_FLARE: 'solarFlare',
  ARMOR_BREAKER: 'armorBreaker',
  MONEY: 'money',
  STEAM_CANNON: 'steamCannon',

  // 超終極塔
  AURA_TOWER: 'auraTower',
  STEAM_FACTORY: 'steamFactory',
  METEOR_TOWER: 'meteorTower'
};

export const TowerConfig = {
  // 基礎塔配置
  [TowerTypes.ARROW]: {
    name: '箭塔',
    emoji: '🏹',
    tier: 1,
    cost: 100,
    damage: 20,
    range: 150,
    fireRate: 1000, // 毫秒
    projectileSpeed: 300,
    description: '基礎單體攻擊塔',
    color: 0x8B4513,
    effectColor: 0xFFFF00,
    recipe: null
  },

  [TowerTypes.FIRE]: {
    name: '火焰塔',
    emoji: '🔥',
    tier: 1,
    cost: 120,
    damage: 15,
    dotDamage: 5, // 每秒DOT傷害
    dotDuration: 3000,
    range: 120,
    fireRate: 1500,
    projectileSpeed: 250,
    description: '造成灼燒持續傷害',
    color: 0xFF4500,
    effectColor: 0xFF6347,
    recipe: null
  },

  [TowerTypes.ICE]: {
    name: '冰霜塔',
    emoji: '❄️',
    tier: 1,
    cost: 110,
    damage: 10,
    slow: 0.5, // 減速50%
    slowDuration: 2000,
    range: 140,
    fireRate: 1200,
    projectileSpeed: 280,
    description: '減速敵人移動',
    color: 0x87CEEB,
    effectColor: 0x00FFFF,
    recipe: null
  },

  [TowerTypes.MAGIC]: {
    name: '魔法塔',
    emoji: '✨',
    tier: 1,
    cost: 130,
    damage: 25,
    range: 160,
    fireRate: 1400,
    projectileSpeed: 320,
    description: '魔法傷害無視護甲',
    color: 0x9370DB,
    effectColor: 0xFF00FF,
    recipe: null
  },

  // 中階塔配置
  [TowerTypes.MACHINE_GUN]: {
    name: '機槍塔',
    emoji: '🔫',
    tier: 2,
    cost: 250,
    damage: 15,
    range: 160,
    fireRate: 300, // 超快射速
    projectileSpeed: 400,
    description: '超高射速掃射',
    color: 0x696969,
    effectColor: 0xFFD700,
    recipe: [TowerTypes.ARROW, TowerTypes.ARROW]
  },

  [TowerTypes.ROCKET]: {
    name: '火箭塔',
    emoji: '🚀',
    tier: 2,
    cost: 280,
    damage: 40,
    splashRadius: 80,
    range: 180,
    fireRate: 1800,
    projectileSpeed: 350,
    description: '爆炸範圍攻擊',
    color: 0xFF6347,
    effectColor: 0xFFA500,
    recipe: [TowerTypes.ARROW, TowerTypes.FIRE]
  },

  [TowerTypes.FREEZE_CANNON]: {
    name: '冰凍炮',
    emoji: '🧊',
    tier: 2,
    cost: 270,
    damage: 20,
    freeze: true,
    freezeDuration: 2000,
    range: 150,
    fireRate: 2500,
    projectileSpeed: 300,
    description: '完全冰凍敵人',
    color: 0x4169E1,
    effectColor: 0xADD8E6,
    recipe: [TowerTypes.ICE, TowerTypes.ICE]
  },

  [TowerTypes.LIGHTNING]: {
    name: '雷電塔',
    emoji: '⚡',
    tier: 2,
    cost: 300,
    damage: 35,
    chainCount: 3,
    chainRange: 100,
    range: 170,
    fireRate: 1600,
    projectileSpeed: 500,
    description: '閃電鏈擊3個目標',
    color: 0xFFFF00,
    effectColor: 0xFFFFFF,
    recipe: [TowerTypes.MAGIC, TowerTypes.MAGIC]
  },

  [TowerTypes.POISON]: {
    name: '毒素塔',
    emoji: '☠️',
    tier: 2,
    cost: 290,
    damage: 10,
    poisonDamage: 8,
    poisonDuration: 5000,
    splashRadius: 70,
    range: 130,
    fireRate: 2000,
    projectileSpeed: 200,
    description: '毒霧範圍持續傷害',
    color: 0x32CD32,
    effectColor: 0x00FF00,
    recipe: [TowerTypes.FIRE, TowerTypes.MAGIC]
  },

  [TowerTypes.SNIPER]: {
    name: '狙擊塔',
    emoji: '🎯',
    tier: 2,
    cost: 280,
    damage: 70,
    range: 220,
    fireRate: 2500,
    projectileSpeed: 600,
    description: '超遠射程精準狙擊',
    color: 0x2F4F4F,
    effectColor: 0xFF0000,
    recipe: [TowerTypes.MAGIC, TowerTypes.ARROW]
  },

  [TowerTypes.TRAP]: {
    name: '陷阱塔',
    emoji: '💣',
    tier: 2,
    cost: 260,
    damage: 25,
    range: 180,
    fireRate: 3000,
    projectileSpeed: 250,
    trapDuration: 20000,
    maxTraps: 4,
    description: '隨機投放各種效果陷阱',
    color: 0x8B4513,
    effectColor: 0xFFFF00,
    recipe: [TowerTypes.MAGIC, TowerTypes.ICE]
  },

  [TowerTypes.STEAM]: {
    name: '蒸氣塔',
    emoji: '🌊',
    tier: 2,
    cost: 270,
    damage: 30,
    knockback: 40,
    splashRadius: 70,
    range: 140,
    fireRate: 1400,
    projectileSpeed: 300,
    description: '蒸汽爆炸範圍擊退',
    color: 0xB0E0E6,
    effectColor: 0xF0F8FF,
    recipe: [TowerTypes.ICE, TowerTypes.FIRE]
  },

  // 終極塔配置
  [TowerTypes.ULTIMATE_CANNON]: {
    name: '終極炮塔',
    emoji: '💥',
    tier: 3,
    cost: 600,
    damage: 100,
    splashRadius: 120,
    range: 200,
    fireRate: 800,
    projectileSpeed: 450,
    description: '毀滅性的範圍傷害',
    color: 0xFF0000,
    effectColor: 0xFFD700,
    recipe: [TowerTypes.ROCKET, TowerTypes.MACHINE_GUN]
  },

  [TowerTypes.FROST_FORTRESS]: {
    name: '極寒要塞',
    emoji: '🌨️',
    tier: 3,
    cost: 650,
    damage: 60,
    freeze: true,
    freezeDuration: 3000,
    chainCount: 5,
    chainRange: 120,
    range: 190,
    fireRate: 1200,
    projectileSpeed: 400,
    description: '冰凍+閃電連鎖',
    color: 0x00CED1,
    effectColor: 0xE0FFFF,
    recipe: [TowerTypes.FREEZE_CANNON, TowerTypes.LIGHTNING]
  },

  [TowerTypes.CHAOS_ARRAY]: {
    name: '混沌法陣',
    emoji: '🌪️',
    tier: 3,
    cost: 700,
    damage: 50,
    dotDamage: 15,
    dotDuration: 4000,
    poisonDamage: 12,
    poisonDuration: 6000,
    slow: 0.7,
    slowDuration: 3000,
    splashRadius: 100,
    chainCount: 4,
    chainRange: 90,
    range: 180,
    fireRate: 1500,
    projectileSpeed: 380,
    description: '所有元素傷害+Debuff',
    color: 0x8B008B,
    effectColor: 0xFF1493,
    recipe: [TowerTypes.POISON, TowerTypes.LIGHTNING]
  },

  [TowerTypes.SOLAR_FLARE]: {
    name: '太陽炎塔',
    emoji: '☀️',
    tier: 3,
    cost: 620,
    damage: 45,
    groundFireDamage: 30,
    groundFireDuration: 4000,
    groundFireRadius: 80,
    groundFireChance: 0.3, // 30%機率留下火焰區域
    maxGroundFires: 3,
    range: 180,
    fireRate: 2000,
    projectileSpeed: 350,
    description: '30%機率留下地面火焰區域',
    color: 0xFF4500,
    effectColor: 0xFFD700,
    recipe: [TowerTypes.ROCKET, TowerTypes.POISON]
  },

  [TowerTypes.ARMOR_BREAKER]: {
    name: '破甲塔',
    emoji: '🗡️',
    tier: 3,
    cost: 650,
    damage: 40,
    percentDamage: 0.06,
    chainCount: 3,
    chainRange: 100,
    chainPercentDecay: 0.5,
    range: 190,
    fireRate: 1500,
    projectileSpeed: 500,
    description: '最大血量6%真傷 連鎖遞減',
    color: 0x8B0000,
    effectColor: 0xFF0000,
    recipe: [TowerTypes.SNIPER, TowerTypes.LIGHTNING]
  },

  [TowerTypes.MONEY]: {
    name: '金錢塔',
    emoji: '💰',
    tier: 3,
    cost: 550,
    damage: 50,
    goldMultiplier: 1.5,
    goldAuraRange: 150,
    goldAuraBonus: 0.25,
    range: 210,
    fireRate: 1400,
    projectileSpeed: 450,
    description: '超遠射程 擊殺金幣x1.5 範圍增益',
    color: 0xFFD700,
    effectColor: 0xFFA500,
    recipe: [TowerTypes.SNIPER, TowerTypes.TRAP]
  },

  [TowerTypes.STEAM_CANNON]: {
    name: '蒸汽炮塔',
    emoji: '💨',
    tier: 3,
    cost: 600,
    damage: 60,
    knockback: 70,
    splashRadius: 100,
    knockbackSplash: true,
    range: 220,
    fireRate: 1600,
    projectileSpeed: 500,
    description: '超遠距離範圍蒸汽擊退',
    color: 0x87CEEB,
    effectColor: 0xF0F8FF,
    recipe: [TowerTypes.STEAM, TowerTypes.SNIPER]
  },

  // 超終極塔配置
  [TowerTypes.AURA_TOWER]: {
    name: '光環塔',
    emoji: '🔆',
    tier: 4,
    cost: 2000,
    damage: 0,
    range: 0,
    fireRate: 0,
    projectileSpeed: 0,
    isAura: true, // 標記為光環塔
    auraAttackSpeedBonus: 0.10, // 每等級提升10%攻速
    auraDamageBonus: 0.10, // 每等級提升10%傷害
    auraEnemySlowBonus: 0.03, // 每等級減慢怪物3%速度
    description: '全地圖增幅：塔攻速+10%/等 傷害+10%/等 怪速-3%/等',
    color: 0xFFD700,
    effectColor: 0xFFFFFF,
    recipe: [TowerTypes.ULTIMATE_CANNON, TowerTypes.FROST_FORTRESS, TowerTypes.CHAOS_ARRAY] // 三塔合成
  },

  [TowerTypes.STEAM_FACTORY]: {
    name: '蒸汽工廠',
    emoji: '🏭',
    tier: 4,
    cost: 2500,
    damage: 50,
    range: 230,
    fireRate: 1200,
    projectileSpeed: 550,
    knockback: 80,
    splashRadius: 110,
    knockbackSplash: true, // 範圍蒸汽擊退
    isAura: true,
    goldBonus: 0.10, // 每等級+10%金幣
    truePercentDamage: 0.005, // 每等級+0.5%最大血量真傷 (從3%改為0.5%)
    description: '全地圖：金幣+10%/等 真傷+0.5%/等 蒸汽擊退',
    color: 0xCD7F32,
    effectColor: 0xC0C0C0,
    recipe: [TowerTypes.MONEY, TowerTypes.STEAM_CANNON, TowerTypes.ARMOR_BREAKER]
  },

  [TowerTypes.METEOR_TOWER]: {
    name: '隕石塔',
    emoji: '☄️',
    tier: 4,
    cost: 2800,
    damage: 240, // 提升到3倍 (80 * 3)
    range: 0, // 全地圖攻擊
    fireRate: 3000,
    projectileSpeed: 800,
    meteorCountMin: 3,
    meteorCountMax: 5,
    meteorSplashRadius: 80,
    groundFireDamage: 45, // 同樣提升到3倍 (15 * 3)
    groundFireDuration: 7000,
    groundFireRadius: 90,
    maxGroundFires: 10,
    description: '全地圖隨機隕石轟炸 留下持續火焰',
    color: 0xFF4500,
    effectColor: 0xFF8C00,
    recipe: [TowerTypes.SOLAR_FLARE, TowerTypes.ULTIMATE_CANNON, TowerTypes.CHAOS_ARRAY]
  }
};

// 獲取塔的合成配方
export function getTowerRecipe(towerType) {
  return TowerConfig[towerType]?.recipe || null;
}

// 檢查是否可以合成（只匹配兩塔配方）
export function canCraftTower(tower1Type, tower2Type) {
  for (const [towerType, config] of Object.entries(TowerConfig)) {
    if (config.recipe && config.recipe.length === 2) {
      const [req1, req2] = config.recipe;
      if ((tower1Type === req1 && tower2Type === req2) ||
          (tower1Type === req2 && tower2Type === req1)) {
        return towerType;
      }
    }
  }
  return null;
}

// 檢查是否可以合成三塔（用於光環塔）
export function canCraftThreeTowers(tower1Type, tower2Type, tower3Type) {
  for (const [towerType, config] of Object.entries(TowerConfig)) {
    if (config.recipe && config.recipe.length === 3) {
      const [req1, req2, req3] = config.recipe;
      const types = [tower1Type, tower2Type, tower3Type].sort();
      const reqs = [req1, req2, req3].sort();
      if (types[0] === reqs[0] && types[1] === reqs[1] && types[2] === reqs[2]) {
        return towerType;
      }
    }
  }
  return null;
}

// 獲取塔的等級顏色
export function getTierColor(tier) {
  switch(tier) {
    case 1: return '#808080'; // 灰色 - 基礎
    case 2: return '#4169E1'; // 藍色 - 中階
    case 3: return '#FFD700'; // 金色 - 終極
    case 4: return '#FF1493'; // 粉紅色 - 超終極
    default: return '#FFFFFF';
  }
}
