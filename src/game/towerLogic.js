import { MAX_LEVEL, MAX_STAR, POWER_TILE_BONUS, RECIPE_MIN_STAR, SELL_RATIO } from '../config/constants.js';
import { RECIPES, STAR, TOWER_TYPES, UPGRADE } from '../config/towers.js';

export function getTowerStats(type, level = 1, star = 1, onPower = false) {
  const def = TOWER_TYPES[type];
  const lv = level - 1;
  const st = star - 1;
  const damageMult = (1 + UPGRADE.damagePerLevel * lv) * STAR.damage ** st * (onPower ? 1 + POWER_TILE_BONUS : 1);
  return {
    damageType: def.damageType,
    projectile: def.projectile,
    projectileSpeed: def.projectileSpeed ?? 0,
    targetsAir: def.targetsAir,
    damage: def.damage * damageMult,
    range: def.range + UPGRADE.rangePerLevel * lv + STAR.range * st,
    rate: def.rate * (1 + UPGRADE.ratePerLevel * lv) * (1 + STAR.rate * st),
    splash: def.splash ? def.splash + STAR.splash * st : 0,
    slow: def.slow ? Math.min(0.75, def.slow + STAR.slow * st + 0.02 * lv) : 0,
    slowDuration: def.slowDuration ?? 0,
    poisonDps: def.poisonDps ? def.poisonDps * damageMult : 0,
    poisonDuration: def.poisonDuration ?? 0,
    chain: def.chain ? def.chain + st : 0,
    chainFalloff: def.chainFalloff ?? 1,
    chainRange: def.chainRange ?? 0,
    armorPierce: def.armorPierce ?? 0,
    critChance: def.critChance ?? 0,
    critMult: def.critMult ?? 1,
    pulse: Boolean(def.pulse)
  };
}

export function dps(stats) {
  let base = stats.damage * stats.rate * (1 + stats.critChance * (stats.critMult - 1));
  if (stats.chain) {
    let hit = stats.damage;
    for (let i = 1; i < stats.chain; i++) {
      hit *= stats.chainFalloff;
      base += hit * stats.rate;
    }
  }
  return base + stats.poisonDps;
}

export function upgradeCost(tower) {
  if (tower.level >= MAX_LEVEL) return null;
  const def = TOWER_TYPES[tower.type];
  return Math.round(def.cost * UPGRADE.costFactor * tower.level * (1 + STAR.costFactor * (tower.star - 1)));
}

export function sellValue(tower) {
  return Math.floor(tower.invested * SELL_RATIO);
}

export function findRecipe(typeA, typeB) {
  return RECIPES.find((r) => (r.a === typeA && r.b === typeB) || (r.a === typeB && r.b === typeA)) ?? null;
}

// 判斷兩座塔能否合成；回傳合成結果或 null
export function mergeResult(a, b) {
  if (!a || !b || a === b) return null;
  const level = Math.max(a.level, b.level);
  const invested = a.invested + b.invested;
  if (a.type === b.type) {
    if (a.star !== b.star || a.star >= MAX_STAR) return null;
    return { kind: 'star', type: a.type, star: a.star + 1, level, invested };
  }
  const recipe = findRecipe(a.type, b.type);
  if (!recipe || a.star < RECIPE_MIN_STAR || b.star < RECIPE_MIN_STAR) return null;
  return { kind: 'recipe', type: recipe.result, star: 1, level, invested };
}
