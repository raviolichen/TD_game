// 塔的平衡數據：range / splash / chainRange 單位為格，rate 為每秒攻擊次數
export const TOWER_TYPES = {
  arrow: {
    name: '箭塔', color: '#d8b06a', accent: '#7a5530', hotkey: '1',
    cost: 50, damage: 12, range: 3, rate: 1.6,
    damageType: 'physical', projectile: 'arrow', projectileSpeed: 10, targetsAir: true,
    desc: '便宜、攻速快，可打空中單位。'
  },
  cannon: {
    name: '砲塔', color: '#8d8d99', accent: '#3b3b46', hotkey: '2',
    cost: 80, damage: 30, range: 2.6, rate: 0.6, splash: 0.9,
    damageType: 'physical', projectile: 'shell', projectileSpeed: 6, targetsAir: false,
    desc: '範圍爆炸傷害，無法攻擊空中單位。'
  },
  frost: {
    name: '冰霜塔', color: '#8fd6f2', accent: '#2f7fa6', hotkey: '3',
    cost: 70, damage: 6, range: 2.6, rate: 1, splash: 0.6, slow: 0.35, slowDuration: 1.6,
    damageType: 'magic', projectile: 'orb', projectileSpeed: 8, targetsAir: true,
    desc: '小範圍緩速敵人。'
  },
  lightning: {
    name: '雷電塔', color: '#f4e35a', accent: '#9a7d12', hotkey: '4',
    cost: 110, damage: 24, range: 2.8, rate: 0.85, chain: 3, chainFalloff: 0.75, chainRange: 1.7,
    damageType: 'magic', projectile: 'bolt', targetsAir: true,
    desc: '閃電連鎖彈跳多個目標，無視護甲。'
  },
  poison: {
    name: '毒霧塔', color: '#9ad35a', accent: '#4c7a1e', hotkey: '5',
    cost: 90, damage: 4, range: 2.5, rate: 1, splash: 0.7, poisonDps: 10, poisonDuration: 3,
    damageType: 'magic', projectile: 'glob', projectileSpeed: 7, targetsAir: false,
    desc: '持續毒傷，對高血量敵人有效。'
  },
  sniper: {
    name: '狙擊塔', color: '#c97a7a', accent: '#6e2a2a', hotkey: '6',
    cost: 140, damage: 95, range: 5.5, rate: 0.35, armorPierce: 0.5,
    damageType: 'physical', projectile: 'shot', targetsAir: true, defaultTarget: 'strong',
    desc: '超遠射程與高單發傷害，穿透一半護甲。'
  },

  // ---- 合成塔（只能由配方合成取得） ----
  storm: {
    name: '風暴塔', color: '#9fb6ff', accent: '#3a4fb0', hybrid: true,
    cost: 260, damage: 55, range: 3.2, rate: 0.9, chain: 5, chainFalloff: 0.85, chainRange: 2,
    slow: 0.3, slowDuration: 1.2,
    damageType: 'magic', projectile: 'bolt', targetsAir: true,
    desc: '連鎖閃電並緩速所有被擊中的敵人。'
  },
  plague: {
    name: '瘟疫砲', color: '#7fae4a', accent: '#3e5a1f', hybrid: true,
    cost: 260, damage: 45, range: 2.9, rate: 0.6, splash: 1.3, poisonDps: 32, poisonDuration: 4,
    damageType: 'physical', projectile: 'shell', projectileSpeed: 6, targetsAir: false,
    desc: '大範圍爆炸並留下劇毒。'
  },
  hawk: {
    name: '鷹眼塔', color: '#e0a35c', accent: '#7c4a14', hybrid: true,
    cost: 300, damage: 120, range: 6.5, rate: 0.8, armorPierce: 0.6, critChance: 0.25, critMult: 2.5,
    damageType: 'physical', projectile: 'shot', targetsAir: true, defaultTarget: 'strong',
    desc: '超遠射程、快速狙擊，25% 機率暴擊 2.5 倍。'
  },
  plasma: {
    name: '電漿砲', color: '#d68cff', accent: '#6d2d99', hybrid: true,
    cost: 300, damage: 110, range: 3, rate: 0.55, splash: 1.3,
    damageType: 'magic', projectile: 'shell', projectileSpeed: 7, targetsAir: true,
    desc: '魔法範圍爆炸，可攻擊空中單位。'
  },
  blight: {
    name: '寒毒塔', color: '#6fd6b8', accent: '#1f6b57', hybrid: true,
    cost: 260, damage: 14, range: 2.4, rate: 1, pulse: true, slow: 0.4, slowDuration: 1.2,
    poisonDps: 22, poisonDuration: 3,
    damageType: 'magic', projectile: 'pulse', targetsAir: true,
    desc: '向四周釋放寒毒脈衝，命中範圍內所有敵人。'
  },
  gatling: {
    name: '機槍塔', color: '#b0b8c4', accent: '#46505e', hybrid: true,
    cost: 260, damage: 15, range: 3.2, rate: 6, armorPierce: 0.25,
    damageType: 'physical', projectile: 'arrow', projectileSpeed: 14, targetsAir: true,
    desc: '極高射速的連射機槍。'
  }
};

export const BASIC_TOWERS = Object.keys(TOWER_TYPES).filter((key) => !TOWER_TYPES[key].hybrid);

// 不同種類的兩座塔合成配方（兩座都必須 ≥ RECIPE_MIN_STAR 星）
export const RECIPES = [
  { a: 'frost', b: 'lightning', result: 'storm' },
  { a: 'cannon', b: 'poison', result: 'plague' },
  { a: 'arrow', b: 'sniper', result: 'hawk' },
  { a: 'cannon', b: 'lightning', result: 'plasma' },
  { a: 'frost', b: 'poison', result: 'blight' },
  { a: 'arrow', b: 'cannon', result: 'gatling' }
];

export const TARGET_MODES = {
  first: '最前',
  last: '最後',
  strong: '最強',
  close: '最近'
};

export const UPGRADE = {
  damagePerLevel: 0.35,
  rangePerLevel: 0.12,
  ratePerLevel: 0.08,
  costFactor: 0.7
};

export const STAR = {
  damage: 1.8,
  range: 0.25,
  rate: 0.1,
  splash: 0.1,
  slow: 0.05,
  costFactor: 0.5
};
