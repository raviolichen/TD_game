import {
  AUTO_START_DELAY, DIFFICULTIES, INTEREST_CAP, INTEREST_RATE, RELOCATE_BONUS,
  TILE, VICTORY_WAVE, WAVES_PER_MAP
} from '../config/constants.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { TOWER_TYPES } from '../config/towers.js';
import { Enemy, Tower } from './entities.js';
import { CELL, generateMap, isBuildable } from './maps.js';
import { mergeResult, sellValue, upgradeCost } from './towerLogic.js';
import { bountyMultiplier, clearBonus, generateWave, hpMultiplier } from './waves.js';

export const SAVE_VERSION = 1;

export class Game {
  constructor({ difficulty = 'normal', seed = Date.now() >>> 0 } = {}) {
    const diff = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
    this.difficulty = difficulty;
    this.seed = seed;
    this.gold = diff.gold;
    this.lives = diff.lives;
    this.hpScale = diff.hp;
    this.wave = 0;
    this.mapIndex = 0;
    this.map = generateMap(0, seed);
    this.state = 'build';
    this.towers = [];
    this.bench = [];
    this.enemies = [];
    this.projectiles = [];
    this.effects = [];
    this.texts = [];
    this.spawnQueue = [];
    this.pendingSpawns = [];
    this.waveTime = 0;
    this.autoStart = false;
    this.autoTimer = AUTO_START_DELAY;
    this.nextId = 1;
    this.stats = { kills: 0, leaked: 0, goldEarned: 0, merges: 0 };
    this.victoryReached = false;
    this.listeners = {};
  }

  // ---------- 事件 ----------
  on(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }

  emit(name, data) {
    for (const fn of this.listeners[name] ?? []) fn(data);
  }

  // ---------- 查詢 ----------
  get nextWave() {
    return this.wave + 1;
  }

  get wavesUntilMapChange() {
    return WAVES_PER_MAP - (this.wave % WAVES_PER_MAP);
  }

  get allTowers() {
    return [...this.towers, ...this.bench];
  }

  findTower(id) {
    return this.allTowers.find((t) => t.id === id) ?? null;
  }

  towerAt(x, y) {
    return this.towers.find((t) => t.x === x && t.y === y) ?? null;
  }

  canPlace(x, y) {
    return isBuildable(this.map, x, y) && !this.towerAt(x, y);
  }

  previewWave(n = this.nextWave) {
    return generateWave(n, this.seed);
  }

  // ---------- 玩家操作 ----------
  buildTower(type, x, y) {
    const def = TOWER_TYPES[type];
    if (!def || def.hybrid) return { error: '無法建造此塔' };
    if (!this.canPlace(x, y)) return { error: '此處無法建造' };
    if (this.gold < def.cost) return { error: '金幣不足' };
    this.gold -= def.cost;
    const tower = new Tower({ id: this.nextId++, type });
    this.placeTower(tower, x, y);
    this.towers.push(tower);
    this.emit('build', tower);
    return { tower };
  }

  placeFromBench(id, x, y) {
    const index = this.bench.findIndex((t) => t.id === id);
    if (index < 0) return { error: '找不到此塔' };
    if (!this.canPlace(x, y)) return { error: '此處無法放置' };
    const [tower] = this.bench.splice(index, 1);
    this.placeTower(tower, x, y);
    this.towers.push(tower);
    this.emit('build', tower);
    return { tower };
  }

  placeTower(tower, x, y) {
    tower.x = x;
    tower.y = y;
    tower.onPower = this.map.grid[y][x] === CELL.POWER;
    tower.cooldown = 0.2;
    tower.refresh();
  }

  upgradeTower(id) {
    const tower = this.findTower(id);
    if (!tower) return { error: '找不到此塔' };
    const cost = upgradeCost(tower);
    if (cost === null) return { error: '已達最高等級' };
    if (this.gold < cost) return { error: '金幣不足' };
    this.gold -= cost;
    tower.invested += cost;
    tower.level += 1;
    tower.refresh();
    tower.flash = 0.4;
    this.emit('upgrade', tower);
    return { tower };
  }

  sellTower(id) {
    const tower = this.findTower(id);
    if (!tower) return { error: '找不到此塔' };
    const value = sellValue(tower);
    this.gold += value;
    this.towers = this.towers.filter((t) => t !== tower);
    this.bench = this.bench.filter((t) => t !== tower);
    if (tower.placed) this.addText(tower.cx, tower.cy - 10, `+${value}`, '#ffd54a');
    this.emit('sell', tower);
    return { value };
  }

  // 將 source 合成到 target 上；結果留在 target 的位置（若 target 在倉庫則留在倉庫）
  mergeTowers(sourceId, targetId) {
    const source = this.findTower(sourceId);
    const target = this.findTower(targetId);
    const result = mergeResult(source, target);
    if (!result) return { error: '這兩座塔無法合成' };
    const merged = new Tower({
      id: this.nextId++,
      type: result.type,
      level: result.level,
      star: result.star,
      invested: result.invested,
      kills: source.kills + target.kills,
      damageDealt: source.damageDealt + target.damageDealt,
      targetMode: TOWER_TYPES[result.type].defaultTarget ?? target.targetMode
    });
    this.towers = this.towers.filter((t) => t !== source && t !== target);
    this.bench = this.bench.filter((t) => t !== source && t !== target);
    if (target.placed) {
      this.placeTower(merged, target.x, target.y);
      this.towers.push(merged);
      this.addEffect({ kind: 'merge', x: merged.cx, y: merged.cy, ttl: 0.7, color: TOWER_TYPES[result.type].color });
    } else {
      this.bench.push(merged);
    }
    merged.flash = 0.6;
    this.stats.merges += 1;
    this.emit('merge', { tower: merged, kind: result.kind });
    return { tower: merged, kind: result.kind };
  }

  setTargetMode(id, mode) {
    const tower = this.findTower(id);
    if (tower) tower.targetMode = mode;
  }

  startWave() {
    if (this.state !== 'build' && this.state !== 'relocate') return false;
    this.wave += 1;
    const plan = generateWave(this.wave, this.seed);
    this.spawnQueue = plan.spawns.map((s) => ({ ...s }));
    this.waveHp = hpMultiplier(this.wave) * this.hpScale;
    this.waveBounty = bountyMultiplier(this.wave);
    this.waveTime = 0;
    this.state = 'wave';
    this.emit('waveStart', plan);
    return true;
  }

  // ---------- 主迴圈 ----------
  update(dt) {
    if (this.state === 'gameover') {
      this.updateVisuals(dt);
      return;
    }
    if (this.state === 'build' && this.autoStart) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) this.startWave();
    }
    if (this.state === 'wave') this.updateSpawns(dt);

    for (const enemy of this.enemies) this.updateEnemy(enemy, dt);
    for (const tower of this.towers) this.updateTower(tower, dt);
    for (const p of this.projectiles) this.updateProjectile(p, dt);

    if (this.pendingSpawns.length) {
      this.enemies.push(...this.pendingSpawns);
      this.pendingSpawns = [];
    }
    for (const enemy of this.enemies) {
      if (enemy.leaked) this.leak(enemy);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => !p.done);
    this.updateVisuals(dt);

    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'gameover';
      this.emit('gameover');
      return;
    }
    if (this.state === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.endWave();
    }
  }

  updateSpawns(dt) {
    this.waveTime += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].time <= this.waveTime) {
      const { type } = this.spawnQueue.shift();
      this.spawnEnemy(type);
    }
  }

  spawnEnemy(type, dist = 0, route = null) {
    const flying = Boolean(ENEMY_TYPES[type].flying);
    const enemy = new Enemy({
      id: this.nextId++,
      type,
      route: route ?? (flying ? this.map.flyPath : this.map.groundPath),
      hpMult: this.waveHp,
      bountyMult: this.waveBounty,
      dist
    });
    this.pendingSpawns.push(enemy);
    return enemy;
  }

  updateEnemy(enemy, dt) {
    if (!enemy.alive) return;
    enemy.update(dt);
    if (enemy.poisonTimer > 0) {
      enemy.poisonTimer -= dt;
      this.dealDamage(enemy, enemy.poisonDps * dt, 'magic', 0, enemy.poisonSource, true);
    }
    if (enemy.def.heal && enemy.alive) {
      enemy.healTimer -= dt;
      if (enemy.healTimer <= 0) {
        enemy.healTimer = 1;
        const range = enemy.def.healRange * TILE;
        for (const other of this.enemies) {
          if (other !== enemy && other.alive && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= range) {
            other.hp = Math.min(other.maxHp, other.hp + other.maxHp * enemy.def.heal);
          }
        }
        this.addEffect({ kind: 'ring', x: enemy.x, y: enemy.y, radius: range, ttl: 0.4, color: '#7fe07a' });
      }
    }
  }

  leak(enemy) {
    const cost = enemy.def.lives ?? 1;
    this.lives -= cost;
    this.stats.leaked += 1;
    this.addText(enemy.x, enemy.y, `-${cost}❤`, '#ff6b6b');
    this.emit('leak', enemy);
  }

  // ---------- 塔的攻擊 ----------
  findTarget(tower) {
    const s = tower.stats;
    const range = s.range * TILE;
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive || (e.flying && !s.targetsAir)) continue;
      const d = Math.hypot(e.x - tower.cx, e.y - tower.cy);
      if (d > range + e.radius) continue;
      let score;
      switch (tower.targetMode) {
        case 'last': score = -e.progress; break;
        case 'strong': score = e.hp; break;
        case 'close': score = -d; break;
        default: score = e.progress;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  enemiesInRange(x, y, radius, targetsAir) {
    return this.enemies.filter((e) => e.alive && (targetsAir || !e.flying) && Math.hypot(e.x - x, e.y - y) <= radius + e.radius);
  }

  updateTower(tower, dt) {
    if (tower.flash > 0) tower.flash -= dt;
    tower.cooldown -= dt;
    if (tower.cooldown > 0) return;
    const s = tower.stats;
    if (s.pulse) {
      const targets = this.enemiesInRange(tower.cx, tower.cy, s.range * TILE, s.targetsAir);
      if (!targets.length) return;
      for (const e of targets) this.hit(e, s.damage, s, tower);
      this.addEffect({ kind: 'ring', x: tower.cx, y: tower.cy, radius: s.range * TILE, ttl: 0.45, color: tower.def.color });
      tower.cooldown = 1 / s.rate;
      this.emit('fire', tower);
      return;
    }
    const target = this.findTarget(tower);
    if (!target) return;
    tower.angle = Math.atan2(target.y - tower.cy, target.x - tower.cx);
    tower.cooldown = 1 / s.rate;
    this.fire(tower, target);
    this.emit('fire', tower);
  }

  fire(tower, target) {
    const s = tower.stats;
    const muzzle = { x: tower.cx + Math.cos(tower.angle) * 14, y: tower.cy + Math.sin(tower.angle) * 14 };
    if (s.projectile === 'bolt') {
      this.chainLightning(tower, target, muzzle);
      return;
    }
    if (s.projectile === 'shot') {
      const crit = s.critChance > 0 && Math.random() < s.critChance;
      this.hit(target, s.damage * (crit ? s.critMult : 1), s, tower);
      this.addEffect({ kind: 'line', x: muzzle.x, y: muzzle.y, x2: target.x, y2: target.y, ttl: 0.15, color: crit ? '#ffef6b' : '#ffffff', width: crit ? 3 : 2 });
      if (crit) this.addText(target.x, target.y - 14, '暴擊!', '#ffef6b');
      return;
    }
    this.projectiles.push({
      kind: s.projectile,
      x: muzzle.x,
      y: muzzle.y,
      sx: muzzle.x,
      sy: muzzle.y,
      target,
      tx: target.x,
      ty: target.y,
      speed: s.projectileSpeed * TILE,
      stats: s,
      tower,
      color: tower.def.color,
      done: false
    });
  }

  chainLightning(tower, first, muzzle) {
    const s = tower.stats;
    const hitSet = new Set();
    let current = first;
    let damage = s.damage;
    let from = muzzle;
    for (let i = 0; i < s.chain && current; i++) {
      hitSet.add(current);
      this.addEffect({ kind: 'bolt', x: from.x, y: from.y, x2: current.x, y2: current.y, ttl: 0.18, color: tower.def.color });
      from = { x: current.x, y: current.y };
      this.hit(current, damage, s, tower);
      damage *= s.chainFalloff;
      let next = null;
      let nextDist = s.chainRange * TILE;
      for (const e of this.enemies) {
        if (!e.alive || hitSet.has(e) || (e.flying && !s.targetsAir)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d <= nextDist) {
          next = e;
          nextDist = d;
        }
      }
      current = next;
    }
  }

  updateProjectile(p, dt) {
    if (p.done) return;
    if (p.target.alive) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step) {
      p.x = p.tx;
      p.y = p.ty;
      p.done = true;
      this.impact(p);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  impact(p) {
    const s = p.stats;
    if (s.splash > 0) {
      const radius = s.splash * TILE;
      for (const e of this.enemiesInRange(p.x, p.y, radius, s.targetsAir)) this.hit(e, s.damage, s, p.tower);
      this.addEffect({ kind: 'explosion', x: p.x, y: p.y, radius, ttl: 0.35, color: p.color });
    } else if (p.target.alive) {
      this.hit(p.target, s.damage, s, p.tower);
    }
    this.emit('impact', p);
  }

  hit(enemy, damage, s, tower) {
    if (!enemy.alive) return;
    if (s.slow) enemy.applySlow(s.slow, s.slowDuration);
    if (s.poisonDps) {
      enemy.applyPoison(s.poisonDps, s.poisonDuration);
      enemy.poisonSource = tower;
    }
    this.dealDamage(enemy, damage, s.damageType, s.armorPierce, tower);
  }

  dealDamage(enemy, amount, damageType, pierce, tower, silent = false) {
    if (!enemy.alive) return;
    const reduction = damageType === 'physical' ? enemy.armor * (1 - pierce) : enemy.mr;
    const dealt = Math.min(enemy.hp, amount * (1 - reduction));
    enemy.hp -= dealt;
    if (!silent) enemy.hitFlash = 0.08;
    if (tower) tower.damageDealt += dealt;
    if (enemy.hp <= 0.0001) this.kill(enemy, tower);
  }

  kill(enemy, tower) {
    enemy.alive = false;
    this.gold += enemy.bounty;
    this.stats.kills += 1;
    this.stats.goldEarned += enemy.bounty;
    if (tower) tower.kills += 1;
    this.addText(enemy.x, enemy.y - 8, `+${enemy.bounty}`, '#ffd54a');
    this.addEffect({ kind: 'death', x: enemy.x, y: enemy.y, radius: enemy.radius, ttl: 0.4, color: enemy.def.color });
    const { splitInto, splitCount } = enemy.def;
    if (splitInto) {
      for (let i = 0; i < splitCount; i++) {
        this.spawnEnemy(splitInto, Math.max(0, enemy.dist - i * 10), enemy.route);
      }
    }
    this.emit('kill', enemy);
  }

  // ---------- 波次結束與地圖變遷 ----------
  endWave() {
    const bonus = clearBonus(this.wave);
    const interest = Math.min(Math.floor(this.gold * INTEREST_RATE), INTEREST_CAP);
    this.gold += bonus + interest;
    this.stats.goldEarned += bonus + interest;
    this.projectiles = [];
    this.state = 'build';
    this.autoTimer = AUTO_START_DELAY;
    this.emit('waveCleared', { wave: this.wave, bonus, interest });
    if (this.wave >= VICTORY_WAVE && !this.victoryReached) {
      this.victoryReached = true;
      this.emit('victory', { wave: this.wave });
    }
    if (this.wave % WAVES_PER_MAP === 0) this.beginRelocation();
    this.emit('autosave');
  }

  beginRelocation() {
    for (const tower of this.towers) {
      tower.x = null;
      tower.y = null;
      tower.onPower = false;
      tower.refresh();
      this.bench.push(tower);
    }
    this.towers = [];
    this.mapIndex += 1;
    this.map = generateMap(this.mapIndex, this.seed);
    this.gold += RELOCATE_BONUS;
    this.effects = [];
    this.texts = [];
    this.state = 'relocate';
    this.emit('relocate', { map: this.map, bonus: RELOCATE_BONUS });
  }

  // ---------- 視覺效果 ----------
  addEffect(effect) {
    effect.maxTtl = effect.ttl;
    this.effects.push(effect);
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
  }

  updateVisuals(dt) {
    for (const e of this.effects) e.ttl -= dt;
    this.effects = this.effects.filter((e) => e.ttl > 0);
    for (const t of this.texts) {
      t.ttl -= dt;
      t.y -= 22 * dt;
    }
    this.texts = this.texts.filter((t) => t.ttl > 0);
    if (this.texts.length > 80) this.texts.splice(0, this.texts.length - 80);
  }

  // ---------- 存檔 ----------
  serialize() {
    return {
      version: SAVE_VERSION,
      difficulty: this.difficulty,
      seed: this.seed,
      wave: this.wave,
      mapIndex: this.mapIndex,
      gold: this.gold,
      lives: this.lives,
      state: this.state === 'relocate' ? 'relocate' : 'build',
      towers: this.towers.map((t) => t.serialize()),
      bench: this.bench.map((t) => t.serialize()),
      nextId: this.nextId,
      stats: { ...this.stats },
      autoStart: this.autoStart,
      victoryReached: this.victoryReached
    };
  }

  static fromSave(data) {
    if (!data || data.version !== SAVE_VERSION) return null;
    const game = new Game({ difficulty: data.difficulty, seed: data.seed });
    game.wave = data.wave;
    game.mapIndex = data.mapIndex;
    game.map = generateMap(data.mapIndex, data.seed);
    game.gold = data.gold;
    game.lives = data.lives;
    game.state = data.state;
    game.nextId = data.nextId;
    game.stats = { ...game.stats, ...data.stats };
    game.autoStart = Boolean(data.autoStart);
    game.victoryReached = Boolean(data.victoryReached);
    for (const t of data.towers) {
      const tower = new Tower(t);
      game.placeTower(tower, t.x, t.y);
      game.towers.push(tower);
    }
    game.bench = data.bench.map((t) => new Tower(t));
    return game;
  }
}
