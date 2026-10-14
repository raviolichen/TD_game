import { TILE } from '../config/constants.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { TOWER_TYPES } from '../config/towers.js';
import { pointAt } from './maps.js';
import { getTowerStats } from './towerLogic.js';

export class Tower {
  constructor({ id, type, level = 1, star = 1, invested, targetMode, kills = 0, damageDealt = 0 }) {
    const def = TOWER_TYPES[type];
    this.id = id;
    this.type = type;
    this.level = level;
    this.star = star;
    this.invested = invested ?? def.cost;
    this.targetMode = targetMode ?? def.defaultTarget ?? 'first';
    this.kills = kills;
    this.damageDealt = damageDealt;
    this.x = null;
    this.y = null;
    this.onPower = false;
    this.cooldown = 0;
    this.angle = -Math.PI / 2;
    this.flash = 0;
    this.refresh();
  }

  get def() {
    return TOWER_TYPES[this.type];
  }

  get placed() {
    return this.x !== null;
  }

  get cx() {
    return (this.x + 0.5) * TILE;
  }

  get cy() {
    return (this.y + 0.5) * TILE;
  }

  refresh() {
    this.stats = getTowerStats(this.type, this.level, this.star, this.onPower);
  }

  serialize() {
    const { id, type, level, star, invested, targetMode, kills, damageDealt, x, y } = this;
    return { id, type, level, star, invested, targetMode, kills, damageDealt: Math.round(damageDealt), x, y };
  }
}

export class Enemy {
  constructor({ id, type, route, hpMult, bountyMult, dist = 0 }) {
    const def = ENEMY_TYPES[type];
    this.id = id;
    this.type = type;
    this.def = def;
    this.route = route;
    this.maxHp = def.hp * hpMult;
    this.hp = this.maxHp;
    this.hpMult = hpMult;
    this.bountyMult = bountyMult;
    this.bounty = Math.round(def.bounty * bountyMult);
    this.speed = def.speed * TILE;
    this.armor = def.armor ?? 0;
    this.mr = def.mr ?? 0;
    this.flying = Boolean(def.flying);
    this.radius = def.size * TILE;
    this.dist = dist;
    this.slowAmount = 0;
    this.slowTimer = 0;
    this.poisonDps = 0;
    this.poisonTimer = 0;
    this.healTimer = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.leaked = false;
    this.bob = Math.random() * Math.PI * 2;
    const p = pointAt(route, dist);
    this.x = p.x;
    this.y = p.y;
  }

  get progress() {
    return this.dist / this.route.length;
  }

  applySlow(amount, duration) {
    const effective = amount * (1 - (this.def.slowResist ?? 0));
    if (effective >= this.slowAmount || this.slowTimer <= 0) this.slowAmount = effective;
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyPoison(dps, duration) {
    this.poisonDps = Math.max(this.poisonTimer > 0 ? this.poisonDps : 0, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  update(dt) {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowAmount = 0;
    }
    this.dist += this.speed * (1 - this.slowAmount) * dt;
    const p = pointAt(this.route, this.dist);
    this.x = p.x;
    this.y = p.y;
    this.bob += dt * 6;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.dist >= this.route.length) {
      this.alive = false;
      this.leaked = true;
    }
  }
}
