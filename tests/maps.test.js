import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLS, HEIGHT, ROWS, WIDTH } from '../src/config/constants.js';
import { CELL, generateMap, pointAt } from '../src/game/maps.js';

const onEdge = (p) => p.x === 0 || p.y === 0 || p.x === COLS - 1 || p.y === ROWS - 1;

test('每張地圖的路徑都是連續、不重複、起訖點在邊緣', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let index = 0; index < 8; index++) {
      const map = generateMap(index, seed);
      const { path } = map;
      assert.ok(path.length >= 15, `路徑太短 seed=${seed} index=${index}`);
      const seen = new Set();
      path.forEach((p, i) => {
        assert.ok(p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS);
        const key = `${p.x},${p.y}`;
        assert.ok(!seen.has(key), `路徑重複 ${key}`);
        seen.add(key);
        if (i > 0) assert.equal(Math.abs(p.x - path[i - 1].x) + Math.abs(p.y - path[i - 1].y), 1);
      });
      assert.ok(onEdge(path[0]) && onEdge(path[path.length - 1]));
      const buildable = map.grid.flat().filter((c) => c === CELL.GROUND || c === CELL.POWER).length;
      assert.ok(buildable >= 80, `可建造格太少 ${buildable}`);
      assert.ok(map.grid.flat().includes(CELL.POWER));
    }
  }
});

test('飛行路線必須穿過地圖內部（不能整條在畫面外）', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (let index = 0; index < 5; index++) {
      const route = generateMap(index, seed).flyPath;
      const mid = pointAt(route, route.length / 2);
      assert.ok(mid.x > 0 && mid.x < WIDTH && mid.y > 0 && mid.y < HEIGHT, `seed=${seed} index=${index}`);
    }
  }
});

test('同一個 seed 產生相同地圖，不同 index 產生不同地圖', () => {
  assert.deepEqual(generateMap(2, 99).path, generateMap(2, 99).path);
  assert.notDeepEqual(generateMap(0, 99).path, generateMap(1, 99).path);
});

test('pointAt 沿路徑插值', () => {
  const route = generateMap(0, 5).groundPath;
  assert.deepEqual(pointAt(route, 0), route.points[0]);
  assert.deepEqual(pointAt(route, route.length + 10), route.points[route.points.length - 1]);
});
