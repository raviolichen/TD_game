// 無畫面模擬：用簡單的貪婪 AI 玩遊戲，檢查平衡度
// 用法：node scripts/simulate.js [difficulty] [局數]
import { COLS, ROWS, STEP, TILE } from '../src/config/constants.js';
import { BASIC_TOWERS, TOWER_TYPES } from '../src/config/towers.js';
import { Game } from '../src/game/Game.js';
import { mergeResult, upgradeCost } from '../src/game/towerLogic.js';

const difficulty = process.argv[2] ?? 'normal';
const runs = Number(process.argv[3] ?? 5);
const ORDER = ['arrow', 'cannon', 'frost', 'arrow', 'lightning', 'sniper', 'poison', 'cannon'];

function coverage(game, x, y, range) {
  const cx = (x + 0.5) * TILE;
  const cy = (y + 0.5) * TILE;
  let n = 0;
  for (const p of game.map.path) {
    if (Math.hypot((p.x + 0.5) * TILE - cx, (p.y + 0.5) * TILE - cy) <= range * TILE) n++;
  }
  return n;
}

function bestSpot(game, range) {
  let best = null;
  let bestScore = -1;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!game.canPlace(x, y)) continue;
      const score = coverage(game, x, y, range) + (game.map.grid[y][x] === 3 ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

function tryMerge(game) {
  const all = game.allTowers;
  for (const a of all) {
    for (const b of all) {
      const r = mergeResult(a, b);
      if (r && (r.kind === 'star' || a.star >= 2)) {
        const [src, dst] = a.placed ? [b, a] : [a, b];
        game.mergeTowers(src.id, dst.id);
        return true;
      }
    }
  }
  return false;
}

function play(game, state) {
  while (game.bench.length) {
    const t = game.bench.sort((a, b) => b.star - a.star)[0];
    const spot = bestSpot(game, t.stats.range);
    if (!spot) break;
    game.placeFromBench(t.id, spot.x, spot.y);
  }
  while (tryMerge(game));
  for (let guard = 0; guard < 50; guard++) {
    const type = ORDER[state.next % ORDER.length];
    const cost = TOWER_TYPES[type].cost;
    const upgradable = game.towers.map((t) => ({ t, c: upgradeCost(t) })).filter((u) => u.c !== null).sort((a, b) => a.c - b.c)[0];
    if (game.towers.length < 24 && game.gold >= cost && (!upgradable || game.towers.length < 8 || state.next % 3 !== 0 || upgradable.c > cost)) {
      const spot = bestSpot(game, TOWER_TYPES[type].range);
      if (!spot) break;
      game.buildTower(type, spot.x, spot.y);
      state.next++;
      while (tryMerge(game));
    } else if (upgradable && game.gold >= upgradable.c) {
      game.upgradeTower(upgradable.t.id);
      if (game.towers.length < 24) state.next += game.towers.length >= 8 ? 1 : 0;
    } else break;
  }
}

const results = [];
for (let r = 0; r < runs; r++) {
  const game = new Game({ difficulty, seed: 1000 + r * 7919 });
  const state = { next: 0 };
  let leakedAt20 = null;
  while (game.state !== 'gameover' && game.wave < 120) {
    play(game, state);
    game.startWave();
    let t = 0;
    while (game.state === 'wave' && t < 600) {
      game.update(STEP);
      t += STEP;
    }
    if (game.wave === 20) leakedAt20 = game.stats.leaked;
    if (process.env.TRACE && r === 0) console.log(game.wave, game.state, game.towers.length, game.bench.length, game.gold, game.lives);
  }
  results.push({ seed: game.seed, wave: game.wave, towers: game.towers.length, leakedAt20, gold: game.gold, kinds: [...new Set(game.towers.map((t) => `${t.type}★${t.star}`))].join(' ') });
}
console.table(results);
console.log('平均到達波數', results.reduce((s, r) => s + r.wave, 0) / runs, BASIC_TOWERS.length);
