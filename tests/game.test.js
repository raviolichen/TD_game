import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEP, WAVES_PER_MAP } from '../src/config/constants.js';
import { Game } from '../src/game/Game.js';
import { isBuildable } from '../src/game/maps.js';
import { generateWave, isBossWave } from '../src/game/waves.js';

function firstSpot(game, skip = 0) {
  for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) if (game.canPlace(x, y) && skip-- <= 0) return { x, y };
  return null;
}

test('魔王每 10 波出現', () => {
  assert.ok(isBossWave(10) && !isBossWave(9));
  assert.ok(generateWave(10, 1).spawns.some((s) => s.type === 'boss'));
  assert.ok(!generateWave(9, 1).spawns.some((s) => s.type === 'boss'));
});

test('建塔扣錢、不能蓋在路上或重疊', () => {
  const game = new Game({ seed: 3 });
  const gold = game.gold;
  const spot = firstSpot(game);
  assert.ok(game.buildTower('arrow', spot.x, spot.y).tower);
  assert.equal(game.gold, gold - 50);
  assert.ok(game.buildTower('arrow', spot.x, spot.y).error);
  const p = game.map.path[3];
  assert.ok(game.buildTower('arrow', p.x, p.y).error);
});

test('合成後新塔留在目標位置', () => {
  const game = new Game({ seed: 3 });
  const a = firstSpot(game);
  const t1 = game.buildTower('arrow', a.x, a.y).tower;
  const b = firstSpot(game);
  const t2 = game.buildTower('arrow', b.x, b.y).tower;
  const { tower } = game.mergeTowers(t1.id, t2.id);
  assert.equal(tower.star, 2);
  assert.deepEqual([tower.x, tower.y], [b.x, b.y]);
  assert.equal(game.towers.length, 1);
});

test('每 20 波地圖變遷，塔收進倉庫並可免費重新部署', () => {
  const game = new Game({ seed: 11 });
  const spot = firstSpot(game);
  game.buildTower('sniper', spot.x, spot.y);
  game.wave = WAVES_PER_MAP - 1;
  game.lives = 9999;
  const oldMap = game.map;
  game.startWave();
  for (let i = 0; i < 60 * 600 && game.state === 'wave'; i++) game.update(STEP);
  assert.equal(game.state, 'relocate');
  assert.notEqual(game.map, oldMap);
  assert.equal(game.towers.length, 0);
  assert.equal(game.bench.length, 1);
  const gold = game.gold;
  const dest = firstSpot(game);
  assert.ok(isBuildable(game.map, dest.x, dest.y));
  assert.ok(game.placeFromBench(game.bench[0].id, dest.x, dest.y).tower);
  assert.equal(game.gold, gold);
  assert.equal(game.bench.length, 0);
});

test('存檔可還原', () => {
  const game = new Game({ seed: 21, difficulty: 'hard' });
  const spot = firstSpot(game);
  const t = game.buildTower('frost', spot.x, spot.y).tower;
  game.upgradeTower(t.id);
  const loaded = Game.fromSave(JSON.parse(JSON.stringify(game.serialize())));
  assert.equal(loaded.gold, game.gold);
  assert.equal(loaded.towers[0].level, 2);
  assert.deepEqual(loaded.map.path, game.map.path);
});
