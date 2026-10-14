import { COLS, ROWS, TILE } from '../config/constants.js';
import { THEMES } from '../config/themes.js';
import { createRng, hashSeed } from './rng.js';

export const CELL = { GROUND: 0, PATH: 1, OBSTACLE: 2, POWER: 3 };

const STYLES = ['serpentine-h', 'snake-h', 'serpentine-v', 'snake-v'];

// 沿 x 軸前進的蛇形路徑：在 (w, h) 的格子內從左邊走到右邊
function snakePath(w, h, rng) {
  const tiles = [];
  let x = 0;
  let y = rng.int(1, h - 2);
  tiles.push([x, y]);
  while (x < w - 1) {
    const nx = Math.min(x + rng.int(2, 4), w - 1);
    for (let i = x + 1; i <= nx; i++) tiles.push([i, y]);
    x = nx;
    if (x >= w - 1) break;
    let ny = y;
    for (let tries = 0; tries < 20 && Math.abs(ny - y) < 2; tries++) ny = rng.int(1, h - 2);
    if (Math.abs(ny - y) < 2) ny = y + 2 <= h - 2 ? y + 2 : y - 2;
    const dir = Math.sign(ny - y);
    for (let j = y + dir; j !== ny + dir; j += dir) tiles.push([x, j]);
    y = ny;
  }
  return tiles;
}

// 來回 S 形長路徑
function serpentinePath(w, h, rng) {
  const spacing = rng.int(3, 4);
  const lanes = [];
  for (let y = 1; y <= h - 2; y += spacing) lanes.push(y);
  const left = rng.int(1, 3);
  const right = w - 1 - rng.int(1, 3);
  const tiles = [];
  let x = 0;
  tiles.push([x, lanes[0]]);
  lanes.forEach((y, i) => {
    const goingRight = i % 2 === 0;
    const last = i === lanes.length - 1;
    const target = last ? (goingRight ? w - 1 : 0) : goingRight ? right : left;
    const dir = Math.sign(target - x);
    for (let i2 = x + dir; dir !== 0 && i2 !== target + dir; i2 += dir) tiles.push([i2, y]);
    x = target;
    if (!last) {
      for (let j = y + 1; j <= lanes[i + 1]; j++) tiles.push([x, j]);
    }
  });
  return tiles;
}

export function mapStyle(index, seed) {
  if (index < STYLES.length) return STYLES[index];
  return createRng(hashSeed(seed, 'style', index)).pick(STYLES);
}

export function generateMap(index, seed) {
  const rng = createRng(hashSeed(seed, 'map', index));
  const style = mapStyle(index, seed);
  const vertical = style.endsWith('-v');
  const [w, h] = vertical ? [ROWS, COLS] : [COLS, ROWS];
  const raw = style.startsWith('snake') ? snakePath(w, h, rng) : serpentinePath(w, h, rng);
  const flipX = rng.chance(0.5);
  const flipY = rng.chance(0.5);
  const path = raw.map(([a, b]) => {
    let x = vertical ? b : a;
    let y = vertical ? a : b;
    if (flipX) x = COLS - 1 - x;
    if (flipY) y = ROWS - 1 - y;
    return { x, y };
  });

  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(CELL.GROUND));
  for (const p of path) grid[p.y][p.x] = CELL.PATH;

  const nearPath = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (grid[y + dy]?.[x + dx] === CELL.PATH) return true;
      }
    }
    return false;
  };

  const ground = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (grid[y][x] === CELL.GROUND) ground.push({ x, y });
  }

  // 障礙物：避開路徑旁一格，保留足夠的建塔空間
  const obstacleChance = 0.06 + Math.min(index, 5) * 0.01;
  for (const c of ground) {
    if (!nearPath(c.x, c.y) && rng.chance(obstacleChance)) grid[c.y][c.x] = CELL.OBSTACLE;
  }

  // 能量格：位於路徑旁，蓋在上面的塔傷害提升
  const candidates = ground.filter((c) => grid[c.y][c.x] === CELL.GROUND && nearPath(c.x, c.y));
  const powerCount = Math.min(3 + Math.floor(index / 2), 6);
  for (let i = 0; i < powerCount && candidates.length; i++) {
    const c = candidates.splice(rng.int(0, candidates.length - 1), 1)[0];
    grid[c.y][c.x] = CELL.POWER;
  }

  const groundPath = buildWaypoints(path);
  // 飛行路線：出生點 → 入口格 → 直線飛到出口格 → 終點；
  // 入口與出口在同一邊時，若只連兩個場外點，整條路線會落在畫面外
  const flyPath = [groundPath[0], groundPath[1], groundPath[groundPath.length - 2], groundPath[groundPath.length - 1]];

  return {
    index,
    style,
    theme: THEMES[index % THEMES.length],
    cycle: Math.floor(index / THEMES.length),
    grid,
    path,
    groundPath: measure(groundPath),
    flyPath: measure(flyPath)
  };
}

const center = (t) => ({ x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE });

// 將格子路徑轉成轉角點，並在兩端往外延伸一格作為出生點與終點
export function buildWaypoints(path) {
  const points = [];
  const first = path[0];
  const second = path[1];
  points.push({ x: (first.x + 0.5 - (second.x - first.x)) * TILE, y: (first.y + 0.5 - (second.y - first.y)) * TILE });
  points.push(center(first));
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) points.push(center(b));
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  points.push(center(last));
  points.push({ x: (last.x + 0.5 + (last.x - prev.x)) * TILE, y: (last.y + 0.5 + (last.y - prev.y)) * TILE });
  return points;
}

export function measure(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

export function pointAt(route, dist) {
  const { points, cumulative } = route;
  if (dist <= 0) return { ...points[0] };
  for (let i = 1; i < points.length; i++) {
    if (dist <= cumulative[i]) {
      const seg = cumulative[i] - cumulative[i - 1];
      const t = seg === 0 ? 0 : (dist - cumulative[i - 1]) / seg;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t
      };
    }
  }
  return { ...points[points.length - 1] };
}

export function isBuildable(map, x, y) {
  const cell = map.grid[y]?.[x];
  return cell === CELL.GROUND || cell === CELL.POWER;
}
