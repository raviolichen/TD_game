import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_LEVEL, MAX_STAR } from '../src/config/constants.js';
import { getTowerStats, mergeResult, sellValue, upgradeCost } from '../src/game/towerLogic.js';

const t = (type, star = 1, level = 1, invested = 100) => ({ type, star, level, invested });

test('同種同星合成升一星，等級取高者、投資相加', () => {
  const r = mergeResult(t('arrow', 1, 3, 150), t('arrow', 1, 1, 50));
  assert.deepEqual(r, { kind: 'star', type: 'arrow', star: 2, level: 3, invested: 200 });
});

test('不同星或已滿星無法合成', () => {
  assert.equal(mergeResult(t('arrow', 1), t('arrow', 2)), null);
  assert.equal(mergeResult(t('arrow', MAX_STAR), t('arrow', MAX_STAR)), null);
});

test('配方合成需要雙方 ≥ 2 星', () => {
  assert.equal(mergeResult(t('frost', 1), t('lightning', 2)), null);
  assert.equal(mergeResult(t('frost', 2), t('lightning', 2)).type, 'storm');
  assert.equal(mergeResult(t('lightning', 3), t('frost', 2)).type, 'storm');
  assert.equal(mergeResult(t('frost', 2), t('sniper', 2)), null);
});

test('等級與星等提升數值，能量格加成傷害', () => {
  const base = getTowerStats('cannon', 1, 1);
  assert.ok(getTowerStats('cannon', 2, 1).damage > base.damage);
  assert.ok(getTowerStats('cannon', 1, 2).damage > base.damage * 1.7);
  assert.ok(getTowerStats('cannon', 1, 1, true).damage > base.damage);
});

test('升級費用遞增、滿級回傳 null；賣出退 70%', () => {
  assert.ok(upgradeCost(t('arrow', 1, 2)) > upgradeCost(t('arrow', 1, 1)));
  assert.equal(upgradeCost(t('arrow', 1, MAX_LEVEL)), null);
  assert.equal(sellValue({ invested: 100 }), 70);
});
