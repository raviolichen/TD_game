import { COLS, DIFFICULTIES, MAX_LEVEL, MAX_STAR, RECIPE_MIN_STAR, ROWS, STEP, VICTORY_WAVE, WAVES_PER_MAP } from '../config/constants.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { BASIC_TOWERS, RECIPES, TARGET_MODES, TOWER_TYPES } from '../config/towers.js';
import { Sfx } from '../game/audio.js';
import { Game } from '../game/Game.js';
import { Renderer } from '../game/Renderer.js';
import { storage } from '../game/storage.js';
import { dps, getTowerStats, mergeResult, sellValue, upgradeCost } from '../game/towerLogic.js';
import { renderHelp } from './help.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString());
const stars = (n) => '★'.repeat(n);
const SPEEDS = [1, 2, 3];

export class App {
  constructor() {
    this.canvas = $('canvas');
    this.renderer = new Renderer(this.canvas);
    this.sfx = new Sfx();
    this.game = null;
    this.difficulty = 'normal';
    this.speedIndex = 0;
    this.paused = false;
    this.view = { mode: 'none', selected: null, hover: null, ghost: null, showGrid: false, mergeTargets: null };
    this.panelKey = '';
    this.benchKey = '';
    this.waveKey = '';
    this.acc = 0;
    this.last = performance.now();

    this.buildShop();
    this.buildMenu();
    $('help-content').innerHTML = renderHelp();
    this.bindControls();
    this.bindCanvas();
    this.bindKeys();
    const syncTopbar = () => document.documentElement.style.setProperty('--topbar-h', `${$('topbar').offsetHeight}px`);
    syncTopbar();
    window.addEventListener('resize', () => {
      syncTopbar();
      this.renderer.resize();
    });
    document.addEventListener('visibilitychange', () => {
      this.last = performance.now();
      this.acc = 0;
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- 遊戲生命週期 ----------
  startGame(game) {
    this.game = game;
    this.view = { mode: 'none', selected: null, hover: null, ghost: null, showGrid: false, mergeTargets: null };
    this.panelKey = this.benchKey = this.waveKey = '';
    this.paused = false;
    this.acc = 0;
    $('toasts').innerHTML = '';
    this.bindGameEvents(game);
    $('menu').hidden = true;
    $('result').hidden = true;
    this.updateBanner();
    if (game.state === 'relocate') this.toast('地圖已變遷，請從倉庫重新部署你的塔', 'gold');
  }

  bindGameEvents(game) {
    game.on('waveStart', (plan) => {
      this.sfx.play(plan.boss ? 'boss' : 'wave');
      if (plan.boss) this.toast(`第 ${plan.wave} 波：魔王來襲！`, 'bad');
      this.updateBanner();
    });
    game.on('waveCleared', ({ wave, bonus, interest }) => {
      this.sfx.play('clear');
      this.toast(`第 ${wave} 波完成！獎勵 +${bonus}${interest ? `，利息 +${interest}` : ''}`, 'gold');
      this.updateBanner();
    });
    game.on('relocate', ({ map, bonus }) => {
      this.sfx.play('relocate');
      this.cancelMode();
      this.view.selected = null;
      this.toast(`🌍 地圖變遷：${map.theme.name}！所有塔已收進倉庫，獲得遷移補助 +${bonus}`, 'gold');
      this.updateBanner();
    });
    game.on('autosave', () => storage.saveGame(game.serialize()));
    game.on('build', () => this.sfx.play('build'));
    game.on('upgrade', () => this.sfx.play('upgrade'));
    game.on('sell', () => this.sfx.play('sell'));
    game.on('merge', ({ tower, kind }) => {
      this.sfx.play('merge');
      this.toast(kind === 'recipe' ? `✨ 配方合成：${tower.def.name}！` : `合成成功：${tower.def.name} ${stars(tower.star)}`, 'good');
    });
    game.on('leak', () => this.sfx.play('leak'));
    game.on('fire', (tower) => this.sfx.playFire(tower.type));
    game.on('impact', (p) => this.sfx.playImpact(p.kind));
    game.on('kill', (enemy) => this.sfx.play(enemy.def.boss ? 'bossDeath' : 'kill'));
    game.on('victory', ({ wave }) => {
      storage.recordBest(wave);
      this.showResult('🏆 勝利！', `你守住了 ${wave} 波，橫跨 ${game.mapIndex + 1} 張地圖！`, [
        { label: '繼續無盡模式', primary: true, action: () => ($('result').hidden = true) },
        { label: '回主選單', action: () => this.openMenu() }
      ]);
    });
    game.on('gameover', () => {
      storage.recordBest(game.wave - 1);
      storage.clearGame();
      this.showResult('💀 遊戲結束', `你撐到了第 ${game.wave} 波。`, [
        { label: '再玩一次', primary: true, action: () => this.startGame(new Game({ difficulty: game.difficulty })) },
        { label: '回主選單', action: () => this.openMenu() }
      ]);
    });
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    const game = this.game;
    if (game) {
      const overlayOpen = !$('menu').hidden || !$('help').hidden || !$('result').hidden;
      if (!this.paused && !overlayOpen) {
        this.acc += dt * SPEEDS[this.speedIndex];
        let steps = 0;
        while (this.acc >= STEP && steps < 240) {
          game.update(STEP);
          this.acc -= STEP;
          steps++;
        }
        if (steps >= 240) this.acc = 0;
      }
      this.validateView();
      this.updateMusicMood();
      this.renderer.render(game, this.view, dt);
      this.updateHud();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // 塔被賣掉/合成後清掉失效的選取
  validateView() {
    const v = this.view;
    if (v.selected && !this.game.findTower(v.selected)) v.selected = null;
    if (v.mode === 'merge' && !this.game.findTower(v.mergeSource)) this.cancelMode();
    if (v.mode === 'bench' && !this.game.bench.some((t) => t.id === v.benchId)) this.cancelMode();
    if (v.mode === 'merge') v.mergeTargets = this.mergeCandidates(this.game.findTower(v.mergeSource)).filter((t) => t.placed);
  }

  // ---------- 選單與結果 ----------
  buildMenu() {
    const box = $('difficulty');
    box.innerHTML = '';
    for (const [key, d] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement('button');
      b.textContent = d.name;
      b.dataset.diff = key;
      b.className = key === this.difficulty ? 'active' : '';
      b.onclick = () => {
        this.difficulty = key;
        for (const el of box.children) el.classList.toggle('active', el.dataset.diff === key);
      };
      box.appendChild(b);
    }
    this.refreshMenu();
  }

  refreshMenu() {
    const save = storage.loadGame();
    const cont = $('btn-continue');
    cont.hidden = !save;
    if (save) cont.textContent = `繼續遊戲（第 ${save.wave} 波・${DIFFICULTIES[save.difficulty]?.name ?? ''}）`;
    const best = storage.bestWave();
    $('best').textContent = best ? `最佳紀錄：第 ${best} 波` : '';
  }

  openMenu() {
    if (this.game && this.game.state !== 'gameover' && this.game.state !== 'wave') storage.saveGame(this.game.serialize());
    this.refreshMenu();
    $('result').hidden = true;
    $('menu').hidden = false;
  }

  showResult(title, body, actions) {
    const g = this.game;
    $('result-title').textContent = title;
    $('result-body').innerHTML = `<p>${body}</p>
      <dl class="result-stats">
        <dt>擊殺數</dt><dd>${fmt(g.stats.kills)}</dd>
        <dt>漏怪數</dt><dd>${fmt(g.stats.leaked)}</dd>
        <dt>合成次數</dt><dd>${fmt(g.stats.merges)}</dd>
        <dt>總收入</dt><dd>${fmt(g.stats.goldEarned)}</dd>
        <dt>最佳紀錄</dt><dd>第 ${storage.bestWave()} 波</dd>
      </dl>`;
    const box = $('result-actions');
    box.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.className = `big ${a.primary ? 'primary' : ''}`;
      b.onclick = a.action;
      box.appendChild(b);
    }
    $('result').hidden = false;
  }

  // ---------- 控制列 ----------
  bindControls() {
    $('btn-new').onclick = () => {
      this.sfx.unlock();
      if (storage.loadGame() && !confirm('開始新遊戲會覆蓋目前存檔，確定嗎？')) return;
      storage.clearGame();
      this.startGame(new Game({ difficulty: this.difficulty }));
    };
    $('btn-continue').onclick = () => {
      this.sfx.unlock();
      const game = Game.fromSave(storage.loadGame());
      if (game) this.startGame(game);
      else {
        storage.clearGame();
        this.refreshMenu();
      }
    };
    $('btn-menu-help').onclick = () => ($('help').hidden = false);
    $('btn-help').onclick = () => ($('help').hidden = false);
    $('btn-menu').onclick = () => this.openMenu();
    for (const el of document.querySelectorAll('[data-close]')) el.onclick = () => ($(el.dataset.close).hidden = true);
    $('btn-start').onclick = () => this.startWave();
    $('btn-auto').onclick = () => {
      if (!this.game) return;
      this.game.autoStart = !this.game.autoStart;
      this.game.autoTimer = 6;
    };
    $('btn-speed').onclick = () => this.cycleSpeed();
    $('btn-pause').onclick = () => this.togglePause();
    $('btn-sound').onclick = () => this.updateAudio({ sfxOn: !this.sfx.sfxOn });
    $('btn-music').onclick = () => this.updateAudio({ musicOn: !this.sfx.musicOn });
    $('vol-music').oninput = (e) => this.updateAudio({ musicVolume: e.target.value / 100, musicOn: true });
    $('vol-sfx').oninput = (e) => this.updateAudio({ sfxVolume: e.target.value / 100, sfxOn: true });
    this.updateAudio(storage.loadSettings(), false);
    // 第一次點擊或按鍵時啟動音訊（瀏覽器限制）
    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  updateAudio(settings, save = true) {
    if (save) this.sfx.unlock();
    this.sfx.setSettings(settings);
    const { sfxOn, musicOn, sfxVolume, musicVolume } = this.sfx;
    if (save) storage.saveSettings({ sfxOn, musicOn, sfxVolume, musicVolume });
    $('btn-sound').classList.toggle('off', !sfxOn);
    $('btn-music').classList.toggle('off', !musicOn);
    $('vol-music').value = Math.round(musicVolume * 100);
    $('vol-sfx').value = Math.round(sfxVolume * 100);
  }

  updateMusicMood() {
    const g = this.game;
    let intensity = 'calm';
    if (g.state === 'wave') intensity = g.enemies.some((e) => e.def.boss) || g.wave % 10 === 0 ? 'boss' : 'battle';
    this.sfx.setMood(g.mapIndex, intensity);
    this.sfx.setMusicPaused(this.paused || g.state === 'gameover');
  }

  startWave() {
    const g = this.game;
    if (!g) return;
    this.sfx.unlock();
    if (g.state === 'relocate' && g.bench.length && !confirm(`倉庫還有 ${g.bench.length} 座塔沒有部署，確定要開始下一波嗎？（之後仍可隨時部署）`)) return;
    if (g.startWave()) this.updateBanner();
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    $('btn-speed').textContent = `${SPEEDS[this.speedIndex]}×`;
  }

  togglePause() {
    this.paused = !this.paused;
    $('btn-pause').textContent = this.paused ? '▶' : '⏸';
    $('paused-overlay').hidden = !this.paused;
  }

  // ---------- 商店 ----------
  buildShop() {
    const shop = $('shop');
    this.shopButtons = {};
    for (const type of BASIC_TOWERS) {
      const def = TOWER_TYPES[type];
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.title = `${def.name}（${def.hotkey}）\n${def.desc}`;
      b.innerHTML = `<span class="key">${def.hotkey}</span><span class="swatch" style="background:${def.color};border-color:${def.accent}"></span><span>${def.name}</span><span class="cost">${def.cost}</span>`;
      b.onclick = () => this.selectBuild(type);
      shop.appendChild(b);
      this.shopButtons[type] = b;
    }
  }

  selectBuild(type) {
    if (!this.game) return;
    this.sfx.unlock();
    if (this.view.mode === 'build' && this.view.buildType === type) {
      this.cancelMode();
      return;
    }
    this.cancelMode();
    const def = TOWER_TYPES[type];
    this.view.mode = 'build';
    this.view.buildType = type;
    this.view.showGrid = true;
    this.view.ghost = { type, range: def.range, star: 1 };
    this.view.selected = null;
  }

  enterBenchMode(id) {
    const tower = this.game.bench.find((t) => t.id === id);
    if (!tower) return;
    this.cancelMode();
    this.view.mode = 'bench';
    this.view.benchId = id;
    this.view.selected = id;
    this.view.showGrid = true;
    this.view.ghost = { type: tower.type, range: tower.stats.range, star: tower.star };
  }

  enterMergeMode(id) {
    const tower = this.game.findTower(id);
    if (!tower) return;
    const candidates = this.mergeCandidates(tower);
    if (!candidates.length) {
      this.toast('沒有可以合成的對象', 'bad');
      this.sfx.play('error');
      return;
    }
    this.cancelMode();
    this.view.mode = 'merge';
    this.view.mergeSource = id;
    this.view.selected = id;
    this.toast('點選要合成的目標塔（金框標示），或從倉庫點選', 'gold');
  }

  cancelMode() {
    Object.assign(this.view, { mode: 'none', buildType: null, benchId: null, mergeSource: null, ghost: null, showGrid: false, mergeTargets: null });
  }

  mergeCandidates(tower) {
    if (!tower) return [];
    return this.game.allTowers.filter((t) => mergeResult(tower, t));
  }

  // ---------- 畫布輸入 ----------
  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }

  bindCanvas() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      this.view.hover = this.cellFromEvent(e);
      if (this.drag && this.view.hover && (this.view.hover.x !== this.drag.x || this.view.hover.y !== this.drag.y)) {
        this.drag.moved = true;
      }
    });
    c.addEventListener('pointerleave', () => (this.view.hover = null));
    c.addEventListener('pointerdown', (e) => {
      if (!this.game || e.button === 2) return;
      this.sfx.unlock();
      const cell = this.cellFromEvent(e);
      if (!cell) return;
      this.view.hover = cell;
      const tower = this.game.towerAt(cell.x, cell.y);
      if (this.view.mode === 'none' && tower) {
        this.drag = { ...cell, id: tower.id, moved: false };
        c.setPointerCapture(e.pointerId);
      }
    });
    c.addEventListener('pointerup', (e) => {
      if (!this.game || e.button === 2) return;
      const cell = this.cellFromEvent(e);
      const drag = this.drag;
      this.drag = null;
      if (drag?.moved) {
        // 拖曳合成
        const target = cell && this.game.towerAt(cell.x, cell.y);
        if (target && target.id !== drag.id) {
          const res = this.game.mergeTowers(drag.id, target.id);
          if (res.error) this.fail(res.error);
          else this.view.selected = res.tower.id;
        }
        return;
      }
      if (cell) this.handleClick(cell);
    });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelMode();
      this.view.selected = null;
    });
  }

  handleClick({ x, y }) {
    const g = this.game;
    const v = this.view;
    const tower = g.towerAt(x, y);
    switch (v.mode) {
      case 'build': {
        if (tower) {
          this.cancelMode();
          v.selected = tower.id;
          return;
        }
        const res = g.buildTower(v.buildType, x, y);
        if (res.error) this.fail(res.error);
        else if (g.gold < TOWER_TYPES[v.buildType].cost) this.cancelMode();
        return;
      }
      case 'bench': {
        const res = g.placeFromBench(v.benchId, x, y);
        if (res.error) {
          if (tower) {
            // 點到已放置的塔：嘗試把倉庫的塔合成上去
            const merged = g.mergeTowers(v.benchId, tower.id);
            if (!merged.error) {
              this.cancelMode();
              v.selected = merged.tower.id;
              return;
            }
          }
          this.fail(res.error);
          return;
        }
        this.cancelMode();
        v.selected = res.tower.id;
        const nextBench = g.bench[0];
        if (g.state === 'relocate' && nextBench) this.enterBenchMode(nextBench.id);
        return;
      }
      case 'merge': {
        if (tower && tower.id !== v.mergeSource) {
          const res = g.mergeTowers(v.mergeSource, tower.id);
          if (res.error) {
            this.fail(res.error);
            return;
          }
          this.cancelMode();
          v.selected = res.tower.id;
          return;
        }
        this.cancelMode();
        return;
      }
      default:
        v.selected = tower ? tower.id : null;
    }
  }

  fail(message) {
    this.toast(message, 'bad');
    this.sfx.play('error');
  }

  // ---------- 鍵盤 ----------
  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.game || !$('menu').hidden || e.target.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      const type = BASIC_TOWERS.find((t) => TOWER_TYPES[t].hotkey === key);
      const sel = this.view.selected;
      if (type) this.selectBuild(type);
      else if (key === ' ') {
        e.preventDefault();
        this.startWave();
      } else if (key === 'escape') {
        this.cancelMode();
        this.view.selected = null;
        $('help').hidden = true;
      } else if (key === 'p') this.togglePause();
      else if (key === 'f') this.cycleSpeed();
      else if (key === 'h') $('help').hidden = !$('help').hidden;
      else if (key === 'u' && sel) this.doUpgrade(sel);
      else if (key === 's' && sel) this.doSell(sel);
      else if (key === 'm' && sel) this.enterMergeMode(sel);
      else if (key === 't' && sel) {
        const t = this.game.findTower(sel);
        const modes = Object.keys(TARGET_MODES);
        if (t) t.targetMode = modes[(modes.indexOf(t.targetMode) + 1) % modes.length];
      }
    });
  }

  doUpgrade(id) {
    const res = this.game.upgradeTower(id);
    if (res.error) this.fail(res.error);
  }

  doSell(id) {
    const res = this.game.sellTower(id);
    if (res.error) this.fail(res.error);
    else {
      this.view.selected = null;
      this.toast(`賣出 +${res.value}`, 'gold');
    }
  }

  // ---------- HUD ----------
  updateHud() {
    const g = this.game;
    setText('lives', g.lives);
    setText('gold', fmt(g.gold));
    setText('wave', `${g.wave}${g.state === 'wave' || g.state === 'gameover' ? '' : ` / 下一波 ${g.nextWave}`}`);
    setText('map-name', `${g.mapIndex + 1}. ${g.map.theme.name}`);
    const left = g.wavesUntilMapChange;
    const shift = $('map-shift');
    const shiftText = g.state === 'wave' && g.wave % WAVES_PER_MAP === 0
      ? '⚠ 本波結束後地圖變遷'
      : `距地圖變遷 ${left} 波`;
    if (shift.textContent !== shiftText) shift.textContent = shiftText;
    shift.classList.toggle('soon', left <= 3 || (g.state === 'wave' && g.wave % WAVES_PER_MAP === 0));

    const start = $('btn-start');
    const canStart = g.state === 'build' || g.state === 'relocate';
    start.disabled = !canStart;
    let label = canStart ? `開始第 ${g.nextWave} 波` : `第 ${g.wave} 波進行中`;
    if (canStart && g.autoStart && g.state === 'build') label += `（${Math.ceil(g.autoTimer)}）`;
    if (start.textContent !== label) start.textContent = label;
    setText('btn-auto', g.autoStart ? '自動：開' : '自動：關');
    $('btn-auto').classList.toggle('active', g.autoStart);

    for (const [type, b] of Object.entries(this.shopButtons)) {
      b.classList.toggle('unaffordable', g.gold < TOWER_TYPES[type].cost);
      b.classList.toggle('active', this.view.mode === 'build' && this.view.buildType === type);
    }
    this.updateInfo();
    this.updateBench();
    this.updateWavePreview();
  }

  updateBanner() {
    const g = this.game;
    const banner = $('banner');
    let text = '';
    if (g.state === 'relocate') {
      text = g.bench.length
        ? `🌍 地圖變遷！點選倉庫中的塔，再點地圖免費部署（剩 ${g.bench.length} 座）`
        : '✅ 部署完成！準備好就開始下一波';
    } else if (g.state === 'build' && g.wave === 0) {
      text = '選擇右側的塔放到地圖上，然後按「開始第 1 波」';
    }
    banner.hidden = !text;
    if (banner.textContent !== text) banner.textContent = text;
  }

  updateInfo() {
    const g = this.game;
    const t = this.view.selected ? g.findTower(this.view.selected) : null;
    const up = t ? upgradeCost(t) : null;
    const key = t
      ? [t.id, t.level, t.star, t.targetMode, t.placed, t.onPower, Math.floor(t.kills / 5), up !== null && g.gold >= up, this.view.mode, g.allTowers.length, g.state].join('|')
      : `none|${this.view.mode}`;
    if (key === this.panelKey) {
      if (t) setText('info-kills', `${fmt(t.kills)} / ${fmt(t.damageDealt)}`);
      return;
    }
    this.panelKey = key;
    this.updateBanner();
    const box = $('info');
    if (!t) {
      box.innerHTML = this.view.mode === 'build'
        ? `<p class="hint">點擊地圖空地建造 <b>${TOWER_TYPES[this.view.buildType].name}</b>。右鍵或 <kbd>Esc</kbd> 取消。<br />金色 ✦ 能量格可提升 25% 傷害。</p>`
        : '<p class="hint">點選地圖上的塔查看、升級、合成或賣出。<br />把同種同星的塔拖到另一座上即可合成。</p>';
      return;
    }
    const def = t.def;
    const s = t.stats;
    const next = t.level < MAX_LEVEL ? getTowerStats(t.type, t.level + 1, t.star, t.onPower) : null;
    const nextTxt = (cur, nv, f = (v) => v.toFixed(1)) => (next && nv - cur > 0.001 ? ` <span class="up">→ ${f(nv)}</span>` : '');
    const rows = [
      ['傷害', `${fmt(s.damage)}${nextTxt(s.damage, next?.damage, fmt)}`],
      ['射程', `${s.range.toFixed(1)}${nextTxt(s.range, next?.range)}`],
      ['攻速', `${s.rate.toFixed(2)}/秒${nextTxt(s.rate, next?.rate, (v) => v.toFixed(2))}`],
      ['DPS', `${fmt(dps(s))}${next ? ` <span class="up">→ ${fmt(dps(next))}</span>` : ''}`]
    ];
    if (s.splash) rows.push(['爆炸範圍', s.splash.toFixed(1)]);
    if (s.slow) rows.push(['緩速', `${Math.round(s.slow * 100)}% / ${s.slowDuration}秒`]);
    if (s.poisonDps) rows.push(['毒傷', `${fmt(s.poisonDps)}/秒 × ${s.poisonDuration}秒`]);
    if (s.chain) rows.push(['連鎖', `${s.chain} 個目標`]);
    if (s.armorPierce) rows.push(['穿甲', `${Math.round(s.armorPierce * 100)}%`]);
    if (s.critChance) rows.push(['暴擊', `${Math.round(s.critChance * 100)}% × ${s.critMult}`]);
    rows.push(['類型', `${s.damageType === 'physical' ? '物理' : '魔法'}${s.targetsAir ? '・可對空' : '・僅地面'}`]);
    if (t.onPower) rows.push(['能量格', '<span class="up">傷害 +25%</span>']);
    rows.push(['擊殺/傷害', `<span id="info-kills">${fmt(t.kills)} / ${fmt(t.damageDealt)}</span>`]);

    const candidates = this.mergeCandidates(t);
    const recipeHints = RECIPES.filter((r) => r.a === t.type || r.b === t.type).map((r) => {
      const other = r.a === t.type ? r.b : r.a;
      return `${TOWER_TYPES[other].name} → <b>${TOWER_TYPES[r.result].name}</b>`;
    });
    const mergeInfo = [
      t.star < MAX_STAR ? `同種 ${stars(t.star)} 塔 → <b>${def.name} ${stars(t.star + 1)}</b>` : '已達最高星等',
      recipeHints.length ? `配方（雙方 ≥ ${stars(RECIPE_MIN_STAR)}）：${recipeHints.join('、')}` : ''
    ].filter(Boolean).join('<br />');

    const benchPlace = !t.placed ? '<button class="primary" data-act="place">放置到地圖</button>' : '';
    box.innerHTML = `
      <div class="tower-head">
        <span class="swatch ${def.hybrid ? 'hybrid' : ''}" style="background:${def.color};border-color:${def.accent}"></span>
        <div><div class="name">${def.name} <span class="stars">${stars(t.star)}</span></div>
        <small>等級 ${t.level}/${MAX_LEVEL}${t.placed ? '' : '・倉庫中'}</small></div>
      </div>
      <p class="desc">${def.desc}</p>
      <dl class="statgrid">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="btn-row">
        ${benchPlace}
        <button data-act="upgrade" ${up === null || g.gold < up ? 'disabled' : ''}>${up === null ? '已滿級' : `升級 <kbd>U</kbd> ${up}`}</button>
        <button data-act="merge" class="${this.view.mode === 'merge' ? 'active' : ''}" ${candidates.length ? '' : 'disabled'}>合成 <kbd>M</kbd> (${candidates.length})</button>
        <button data-act="sell" class="danger">賣出 <kbd>S</kbd> ${sellValue(t)}</button>
      </div>
      ${t.placed ? `<div class="btn-row target-row">${Object.entries(TARGET_MODES).map(([k, name]) => `<button data-target="${k}" class="${t.targetMode === k ? 'active' : ''}">${name}</button>`).join('')}</div>` : ''}
      <p class="merge-hint">${mergeInfo}</p>`;
    box.querySelector('[data-act="upgrade"]').onclick = () => this.doUpgrade(t.id);
    box.querySelector('[data-act="sell"]').onclick = () => this.doSell(t.id);
    box.querySelector('[data-act="merge"]').onclick = () => (this.view.mode === 'merge' ? this.cancelMode() : this.enterMergeMode(t.id));
    box.querySelector('[data-act="place"]')?.addEventListener('click', () => this.enterBenchMode(t.id));
    for (const b of box.querySelectorAll('[data-target]')) b.onclick = () => g.setTargetMode(t.id, b.dataset.target);
  }

  updateBench() {
    const g = this.game;
    const key = g.bench.map((t) => `${t.id}:${t.level}:${t.star}`).join(',') + `|${this.view.benchId}|${this.view.mode}|${g.state}`;
    if (key === this.benchKey) return;
    this.benchKey = key;
    this.updateBanner();
    $('bench-count').textContent = g.bench.length ? `${g.bench.length} 座` : '';
    $('bench-panel').classList.toggle('highlight', g.bench.length > 0);
    const box = $('bench');
    if (!g.bench.length) {
      box.innerHTML = '<p class="hint">地圖變遷時，所有塔會收進倉庫，可免費重新部署。</p>';
      return;
    }
    box.innerHTML = '';
    const sorted = [...g.bench].sort((a, b) => b.star - a.star || b.level - a.level);
    for (const t of sorted) {
      const b = document.createElement('button');
      const merging = this.view.mode === 'merge' && this.view.mergeSource !== t.id;
      const valid = merging && mergeResult(g.findTower(this.view.mergeSource), t);
      b.className = `bench-item ${this.view.benchId === t.id || valid ? 'active' : ''}`;
      b.innerHTML = `<span class="swatch" style="background:${t.def.color};border-color:${t.def.accent}"></span>${t.def.name} ${stars(t.star)} Lv${t.level}`;
      b.onclick = () => {
        if (merging) {
          const res = g.mergeTowers(this.view.mergeSource, t.id);
          if (res.error) this.fail(res.error);
          else {
            this.cancelMode();
            this.view.selected = res.tower.id;
          }
          return;
        }
        this.enterBenchMode(t.id);
      };
      box.appendChild(b);
    }
  }

  updateWavePreview() {
    const g = this.game;
    const n = g.state === 'wave' ? g.wave : g.nextWave;
    if (this.waveKey === `${n}|${g.state}`) return;
    this.waveKey = `${n}|${g.state}`;
    $('next-wave-no').textContent = g.state === 'wave' ? `第 ${n} 波（進行中）` : `第 ${n} 波`;
    const plan = g.previewWave(n);
    const counts = {};
    for (const grp of plan.groups) counts[grp.type] = (counts[grp.type] ?? 0) + grp.count;
    const traits = (def) => [
      def.armor && `護甲 ${Math.round(def.armor * 100)}%`,
      def.mr && `魔抗 ${Math.round(def.mr * 100)}%`,
      def.flying && '飛行',
      def.heal && '治療',
      def.splitInto && '死亡分裂',
      def.speed >= 1.5 && '高速'
    ].filter(Boolean).join('・');
    const extra = n % WAVES_PER_MAP === 0 ? '<div class="boss-warning">⚠ 此波結束後地圖將會變遷</div>' : '';
    const victory = n === VICTORY_WAVE ? '<div class="boss-warning">🏆 最終之戰！</div>' : '';
    $('next-wave').innerHTML = `${plan.boss ? '<div class="boss-warning">☠ 魔王波</div>' : ''}${extra}${victory}
      <div class="wave-list">${Object.entries(counts).map(([type, c]) => {
        const def = ENEMY_TYPES[type];
        return `<div class="row"><span class="dot" style="background:${def.color}"></span>${def.name} ×${c} <span class="traits">${traits(def)}</span></div>`;
      }).join('')}</div>`;
  }

  toast(message, kind = '') {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), 3200);
  }
}

function setText(id, value) {
  const el = $(id);
  const text = String(value);
  if (el.textContent !== text) el.textContent = text;
}
