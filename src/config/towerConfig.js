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

  // 終極塔
  ULTIMATE_CANNON: 'ultimateCannon',
  FROST_FORTRESS: 'frostFortress',
  CHAOS_ARRAY: 'chaosArray',

  // 超終極塔
  AURA_TOWER: 'auraTower'
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
    recipe: [TowerTypes.MAGIC, TowerTypes.ARROW]
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
  }
};

// 獲取塔的合成配方
export function getTowerRecipe(towerType) {
  return TowerConfig[towerType]?.recipe || null;
}

// 檢查是否可以合成
export function canCraftTower(tower1Type, tower2Type) {
  for (const [towerType, config] of Object.entries(TowerConfig)) {
    if (config.recipe) {
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
