// speed 單位：格/秒；armor 減少物理傷害、mr 減少魔法傷害
export const ENEMY_TYPES = {
  grunt: { name: '小兵', hp: 40, speed: 1, bounty: 4, size: 0.28, color: '#e46b5a', unlock: 1, weight: 4, countFactor: 1, interval: 0.8 },
  runner: { name: '疾行者', hp: 24, speed: 1.9, bounty: 4, size: 0.24, color: '#f2c14e', unlock: 3, weight: 3, countFactor: 1.1, interval: 0.55 },
  tank: { name: '鐵甲兵', hp: 130, speed: 0.65, bounty: 9, size: 0.36, color: '#7d8597', armor: 0.45, lives: 2, unlock: 5, weight: 2, countFactor: 0.45, interval: 1.4 },
  swarm: { name: '蟲群', hp: 14, speed: 1.35, bounty: 2, size: 0.18, color: '#b56ad8', unlock: 6, weight: 2, countFactor: 2.2, interval: 0.3 },
  flyer: { name: '飛行獸', hp: 36, speed: 1.25, bounty: 6, size: 0.26, color: '#5ac8e4', flying: true, unlock: 8, weight: 2, countFactor: 0.8, interval: 0.9 },
  splitter: { name: '分裂體', hp: 75, speed: 0.85, bounty: 6, size: 0.32, color: '#e48ac4', splitInto: 'swarm', splitCount: 3, unlock: 11, weight: 2, countFactor: 0.5, interval: 1.2 },
  mage: { name: '魔盾兵', hp: 85, speed: 0.9, bounty: 8, size: 0.3, color: '#6f7cf2', mr: 0.55, unlock: 13, weight: 2, countFactor: 0.6, interval: 1 },
  healer: { name: '治療師', hp: 60, speed: 0.9, bounty: 9, size: 0.28, color: '#7fe07a', heal: 0.05, healRange: 1.6, unlock: 15, weight: 1, countFactor: 0.3, interval: 1.5 },
  boss: { name: '魔王', hp: 800, speed: 0.45, bounty: 120, size: 0.5, color: '#9b1d2a', armor: 0.3, mr: 0.3, lives: 10, slowResist: 0.5, boss: true, unlock: 10, weight: 0, countFactor: 0, interval: 4 }
};

export const WAVE = {
  baseCount: 6,
  countPerWave: 0.5,
  hpLinear: 0.1,
  hpGrowth: 1.045,
  bountyPerWave: 0.03,
  clearBonusBase: 15,
  clearBonusPerWave: 2,
  bossEvery: 10
};
