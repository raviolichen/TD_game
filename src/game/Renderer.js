import { COLS, HEIGHT, ROWS, TILE, WIDTH } from '../config/constants.js';
import { TOWER_TYPES } from '../config/towers.js';
import { CELL } from './maps.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapCache = null;
    this.cachedMap = null;
    this.time = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = WIDTH * dpr;
    this.canvas.height = HEIGHT * dpr;
    this.cachedMap = null;
  }

  render(game, view, dt) {
    this.time += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.cachedMap !== game.map) this.buildMapCache(game.map);
    ctx.drawImage(this.mapCache, 0, 0, WIDTH, HEIGHT);
    this.drawPowerGlow(game.map);
    this.drawPathFlow(game);

    if (view.showGrid) this.drawGrid(game, view);
    this.drawRanges(game, view);
    for (const t of game.towers) this.drawTower(t, view);
    const ground = game.enemies.filter((e) => !e.flying);
    const air = game.enemies.filter((e) => e.flying);
    for (const e of ground) this.drawEnemy(e);
    for (const p of game.projectiles) this.drawProjectile(p);
    for (const e of air) this.drawEnemy(e);
    for (const fx of game.effects) this.drawEffect(fx);
    this.drawHover(game, view);
    this.drawTexts(game);
  }

  // ---------- 地圖（快取成離屏畫布） ----------
  buildMapCache(map) {
    const c = document.createElement('canvas');
    c.width = WIDTH * this.dpr;
    c.height = HEIGHT * this.dpr;
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const th = map.theme;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        g.fillStyle = (x + y) % 2 ? th.ground : th.ground2;
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // 路徑：先畫外框再畫內層，讓轉角平滑
    const pts = map.groundPath.points;
    g.lineJoin = 'round';
    g.lineCap = 'square';
    g.strokeStyle = th.pathEdge;
    g.lineWidth = TILE * 0.92;
    this.polyline(g, pts);
    g.strokeStyle = th.path;
    g.lineWidth = TILE * 0.74;
    this.polyline(g, pts);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = map.grid[y][x];
        if (cell === CELL.OBSTACLE) this.drawObstacle(g, x, y, th);
        if (cell === CELL.POWER) this.drawPowerTile(g, x, y);
      }
    }
    // 起點與終點
    const start = map.path[0];
    const end = map.path[map.path.length - 1];
    this.drawMarker(g, start, '#4caf50', '入');
    this.drawMarker(g, end, '#e53935', '出');
    this.mapCache = c;
    this.cachedMap = map;
  }

  polyline(g, pts) {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }

  drawObstacle(g, x, y, th) {
    const cx = (x + 0.5) * TILE;
    const cy = (y + 0.5) * TILE;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(cx, cy + 12, 13, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = th.obstacleColor;
    switch (th.obstacle) {
      case 'tree':
        g.fillStyle = '#6b4a2b';
        g.fillRect(cx - 3, cy + 2, 6, 10);
        g.fillStyle = th.obstacleColor;
        g.beginPath();
        g.arc(cx, cy - 3, 12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.15)';
        g.beginPath();
        g.arc(cx - 4, cy - 7, 5, 0, Math.PI * 2);
        g.fill();
        break;
      case 'cactus':
        g.fillRect(cx - 4, cy - 12, 8, 24);
        g.fillRect(cx - 12, cy - 4, 6, 4);
        g.fillRect(cx - 12, cy - 10, 4, 8);
        g.fillRect(cx + 6, cy - 2, 6, 4);
        g.fillRect(cx + 8, cy - 8, 4, 8);
        break;
      case 'ice':
      case 'crystal':
        g.beginPath();
        g.moveTo(cx, cy - 15);
        g.lineTo(cx + 9, cy + 2);
        g.lineTo(cx + 3, cy + 12);
        g.lineTo(cx - 7, cy + 10);
        g.lineTo(cx - 10, cy - 2);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.moveTo(cx, cy - 15);
        g.lineTo(cx - 10, cy - 2);
        g.lineTo(cx - 2, cy);
        g.closePath();
        g.fill();
        break;
      default:
        g.beginPath();
        g.moveTo(cx - 13, cy + 10);
        g.lineTo(cx - 8, cy - 8);
        g.lineTo(cx + 4, cy - 12);
        g.lineTo(cx + 13, cy + 2);
        g.lineTo(cx + 9, cy + 11);
        g.closePath();
        g.fill();
        g.strokeStyle = '#ff6a2a';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(cx - 6, cy - 2);
        g.lineTo(cx + 2, cy + 4);
        g.lineTo(cx + 8, cy - 2);
        g.stroke();
    }
    g.restore();
  }

  drawPowerTile(g, x, y) {
    const px = x * TILE;
    const py = y * TILE;
    g.save();
    g.strokeStyle = 'rgba(255, 215, 64, 0.9)';
    g.lineWidth = 2;
    g.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
    g.fillStyle = 'rgba(255, 215, 64, 0.18)';
    g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    g.fillStyle = 'rgba(255, 215, 64, 0.9)';
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('✦', px + TILE / 2, py + TILE / 2);
    g.restore();
  }

  drawMarker(g, tile, color, label) {
    const cx = (tile.x + 0.5) * TILE;
    const cy = (tile.y + 0.5) * TILE;
    g.save();
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(cx, cy, 11, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#fff';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, cx, cy + 1);
    g.restore();
  }

  drawPowerGlow(map) {
    const { ctx } = this;
    const a = 0.12 + 0.1 * Math.sin(this.time * 3);
    ctx.fillStyle = `rgba(255, 215, 64, ${a})`;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (map.grid[y][x] === CELL.POWER) ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
      }
    }
  }

  drawPathFlow(game) {
    if (game.state === 'wave') return;
    const { ctx } = this;
    const route = game.map.groundPath;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 14]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath();
    ctx.moveTo(route.points[0].x, route.points[0].y);
    for (const p of route.points) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // 飛行路線
    const fly = game.map.flyPath.points;
    ctx.strokeStyle = 'rgba(90, 200, 228, 0.35)';
    ctx.setLineDash([2, 10]);
    ctx.beginPath();
    ctx.moveTo(fly[0].x, fly[0].y);
    for (const p of fly) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  drawGrid(game, view) {
    const { ctx } = this;
    ctx.save();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (game.canPlace(x, y)) {
          ctx.fillStyle = view.mode === 'bench' ? 'rgba(120, 220, 255, 0.12)' : 'rgba(255,255,255,0.08)';
          ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        }
      }
    }
    ctx.restore();
  }

  drawRanges(game, view) {
    const sel = view.selected && game.findTower(view.selected);
    if (sel?.placed) this.rangeCircle(sel.cx, sel.cy, sel.stats.range * TILE, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.6)');
    if (view.mode === 'merge' && view.mergeTargets) {
      const { ctx } = this;
      ctx.save();
      for (const t of view.mergeTargets) {
        ctx.strokeStyle = `rgba(255, 215, 64, ${0.6 + 0.4 * Math.sin(this.time * 8)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
      }
      ctx.restore();
    }
  }

  rangeCircle(x, y, r, fill, stroke) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawHover(game, view) {
    const h = view.hover;
    if (!h || !view.ghost) return;
    const ok = game.canPlace(h.x, h.y);
    const cx = (h.x + 0.5) * TILE;
    const cy = (h.y + 0.5) * TILE;
    this.rangeCircle(cx, cy, view.ghost.range * TILE, ok ? 'rgba(120,200,255,0.12)' : 'rgba(255,80,80,0.12)', ok ? 'rgba(120,200,255,0.7)' : 'rgba(255,80,80,0.7)');
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.6;
    this.drawTowerBody(view.ghost.type, cx, cy, view.ghost.star ?? 1, -Math.PI / 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#7cf' : '#f55';
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x * TILE + 1, h.y * TILE + 1, TILE - 2, TILE - 2);
    ctx.restore();
  }

  // ---------- 塔 ----------
  drawTower(t, view) {
    const { ctx } = this;
    const selected = view.selected === t.id;
    if (selected) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
      ctx.restore();
    }
    this.drawTowerBody(t.type, t.cx, t.cy, t.star, t.angle);
    if (t.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.flash * 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 等級點
    ctx.save();
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(t.x * TILE + 4 + i * 6, t.y * TILE + TILE - 6, 4, 3);
    }
    // 星等
    if (t.star > 1) {
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffd740';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      const label = '★'.repeat(t.star - 1);
      ctx.strokeText(label, t.x * TILE + TILE - 2, t.y * TILE + 1);
      ctx.fillText(label, t.x * TILE + TILE - 2, t.y * TILE + 1);
    }
    ctx.restore();
  }

  drawTowerBody(type, cx, cy, star, angle) {
    const { ctx } = this;
    const def = TOWER_TYPES[type];
    ctx.save();
    // 底座
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.accent;
    if (def.hybrid) {
      this.poly(cx, cy, 15, 6, Math.PI / 6);
    } else {
      ctx.beginPath();
      ctx.roundRect(cx - 14, cy - 14, 28, 28, 6);
    }
    ctx.fill();
    ctx.fillStyle = def.color;
    if (def.hybrid) {
      this.poly(cx, cy, 11, 6, Math.PI / 6);
    } else {
      ctx.beginPath();
      ctx.roundRect(cx - 10, cy - 10, 20, 20, 4);
    }
    ctx.fill();
    if (star >= 3) {
      ctx.strokeStyle = star >= 4 ? '#ff80ab' : '#ffd740';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 砲管 / 圖示
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = def.accent;
    switch (def.projectile) {
      case 'shell':
        ctx.fillRect(0, -4, 14, 8);
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'shot':
        ctx.fillRect(0, -2, 18, 4);
        break;
      case 'bolt':
        ctx.rotate(-angle);
        ctx.fillStyle = '#fff8c4';
        ctx.beginPath();
        ctx.moveTo(-2, -8);
        ctx.lineTo(4, -1);
        ctx.lineTo(0, -1);
        ctx.lineTo(3, 8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case 'pulse':
        ctx.rotate(-angle);
        ctx.strokeStyle = def.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 5 + 2 * Math.sin(this.time * 4), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'orb':
      case 'glob':
        ctx.beginPath();
        ctx.arc(6, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.fillRect(0, -2, 13, 4);
        if (type === 'gatling') ctx.fillRect(0, -6, 12, 3), ctx.fillRect(0, 3, 12, 3);
    }
    ctx.restore();
  }

  poly(cx, cy, r, sides, rot) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ---------- 敵人 ----------
  drawEnemy(e) {
    const { ctx } = this;
    const r = e.radius;
    const bob = e.flying ? Math.sin(e.bob) * 3 - 8 : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + r * 0.7, r * (e.flying ? 0.6 : 0.9), r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    const y = e.y + bob;
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.def.color;
    if (e.def.boss) {
      this.poly(e.x, y, r, 8, this.time);
      ctx.fill();
      ctx.strokeStyle = '#ffd740';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (e.type === 'tank') {
      ctx.beginPath();
      ctx.roundRect(e.x - r, y - r, r * 2, r * 2, 4);
      ctx.fill();
    } else if (e.flying) {
      ctx.beginPath();
      const flap = Math.sin(e.bob * 2) * 4;
      ctx.moveTo(e.x - r * 1.4, y - flap);
      ctx.lineTo(e.x, y - r * 0.6);
      ctx.lineTo(e.x + r * 1.4, y - flap);
      ctx.lineTo(e.x, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'mage') {
      this.poly(e.x, y, r, 4, Math.PI / 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,180,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(e.x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.type === 'healer') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x - 1.5, y - 5, 3, 10);
        ctx.fillRect(e.x - 5, y - 1.5, 10, 3);
      }
    }
    // 眼睛
    if (!e.flying) {
      ctx.fillStyle = '#222';
      ctx.fillRect(e.x - r * 0.4, y - r * 0.25, 2.5, 2.5);
      ctx.fillRect(e.x + r * 0.4 - 2.5, y - r * 0.25, 2.5, 2.5);
    }
    if (e.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(140, 220, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.poisonTimer > 0) {
      ctx.fillStyle = 'rgba(154, 211, 90, 0.9)';
      ctx.beginPath();
      ctx.arc(e.x + r * 0.8, y - r * 0.9, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // 血條
    if (e.hp < e.maxHp) {
      const w = Math.max(18, r * 2);
      const pct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, y - r - 8, w, 4);
      ctx.fillStyle = pct > 0.5 ? '#66e070' : pct > 0.25 ? '#f2c14e' : '#ef5350';
      ctx.fillRect(e.x - w / 2, y - r - 8, w * pct, 4);
    }
    ctx.restore();
  }

  drawProjectile(p) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = p.color;
    switch (p.kind) {
      case 'arrow': {
        const a = Math.atan2(p.ty - p.y, p.tx - p.x);
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillStyle = '#fff3d0';
        ctx.fillRect(-6, -1, 10, 2);
        break;
      }
      case 'shell': {
        // 拋物線高度
        const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
        const t = 1 - Math.hypot(p.tx - p.x, p.ty - p.y) / total;
        const lift = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 14;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - lift, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  }

  drawEffect(fx) {
    const { ctx } = this;
    const t = fx.ttl / fx.maxTtl;
    ctx.save();
    switch (fx.kind) {
      case 'line':
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.width ?? 2;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        break;
      case 'bolt': {
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = fx.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        const segs = 5;
        for (let i = 1; i < segs; i++) {
          const k = i / segs;
          ctx.lineTo(fx.x + (fx.x2 - fx.x) * k + (Math.random() - 0.5) * 10, fx.y + (fx.y2 - fx.y) * k + (Math.random() - 0.5) * 10);
        }
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        break;
      }
      case 'explosion':
        ctx.globalAlpha = t * 0.7;
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * (1.1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ring':
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * (1 - t * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'death':
        ctx.globalAlpha = t;
        ctx.fillStyle = fx.color;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const d = (1 - t) * 16;
          ctx.fillRect(fx.x + Math.cos(a) * d - 2, fx.y + Math.sin(a) * d - 2, 4, 4);
        }
        break;
      case 'merge':
        ctx.globalAlpha = t;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 8 + (1 - t) * 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffd740';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 4 + (1 - t) * 18, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  drawTexts(game) {
    const { ctx } = this;
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    for (const t of game.texts) {
      ctx.globalAlpha = Math.min(1, t.ttl / t.maxTtl * 1.5);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
