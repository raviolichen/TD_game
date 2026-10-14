import { ENEMY_TYPES, WAVE } from '../config/enemies.js';
import { createRng, hashSeed } from './rng.js';

export function hpMultiplier(wave) {
  const n = wave - 1;
  return (1 + WAVE.hpLinear * n) * WAVE.hpGrowth ** n;
}

export function bountyMultiplier(wave) {
  return 1 + WAVE.bountyPerWave * (wave - 1);
}

export function isBossWave(wave) {
  return wave % WAVE.bossEvery === 0;
}

export function clearBonus(wave) {
  return WAVE.clearBonusBase + WAVE.clearBonusPerWave * wave;
}

// 產生一波的出怪表：[{ type, time }]，時間單位為秒
export function generateWave(wave, seed) {
  const rng = createRng(hashSeed(seed, 'wave', wave));
  const pool = Object.entries(ENEMY_TYPES).filter(([, def]) => def.weight > 0 && def.unlock <= wave);
  const totalWeight = pool.reduce((sum, [, def]) => sum + def.weight, 0);
  const pickType = () => {
    let roll = rng.next() * totalWeight;
    for (const [key, def] of pool) {
      roll -= def.weight;
      if (roll <= 0) return key;
    }
    return pool[pool.length - 1][0];
  };

  const groupCount = wave <= 2 ? 1 : Math.min(1 + Math.floor(wave / 7), 4);
  const base = WAVE.baseCount + WAVE.countPerWave * wave;
  const groups = [];
  for (let i = 0; i < groupCount; i++) {
    const type = i === 0 && wave <= 2 ? 'grunt' : pickType();
    const def = ENEMY_TYPES[type];
    const count = Math.max(1, Math.round((base / Math.sqrt(groupCount)) * def.countFactor));
    groups.push({ type, count, interval: def.interval });
  }
  if (isBossWave(wave)) {
    groups.push({ type: 'boss', count: 1 + Math.floor(wave / 30), interval: ENEMY_TYPES.boss.interval });
  }

  const spawns = [];
  let time = 0;
  for (const group of groups) {
    for (let i = 0; i < group.count; i++) {
      spawns.push({ type: group.type, time });
      time += group.interval;
    }
    time += 1.5;
  }
  return { wave, groups, spawns, boss: isBossWave(wave) };
}
