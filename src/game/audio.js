import { MUSIC_TEMPO, MUSIC_THEMES } from '../config/music.js';

// 以 WebAudio 即時合成音效與背景音樂，無需音檔

const TOWER_FIRE = {
  arrow: 'arrow',
  cannon: 'cannonFire',
  frost: 'frost',
  lightning: 'zap',
  poison: 'poison',
  sniper: 'sniper',
  storm: 'zap',
  plague: 'cannonFire',
  hawk: 'sniper',
  plasma: 'plasma',
  blight: 'pulse',
  gatling: 'gatling'
};

const IMPACT = {
  shell: 'explosion',
  orb: 'frostHit',
  glob: 'splat'
};

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.45;
    this.lastPlayed = {};
    this.voices = 0;
    this.mood = { theme: 0, intensity: 'calm' };
    this.musicPaused = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
  }

  // 瀏覽器規定須在使用者操作後才能啟動音訊
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.master = ctx.createDynamicsCompressor();
      this.master.threshold.value = -14;
      this.master.ratio.value = 6;
      this.master.connect(ctx.destination);
      this.sfxGain = ctx.createGain();
      this.musicGain = ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.applyVolumes();
      this.noiseBuffer = this.makeNoise();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
      this.startSequencer();
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  }

  makeNoise() {
    const length = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(this.sfxOn ? this.sfxVolume : 0, now, 0.05);
    const music = this.musicOn && !this.musicPaused ? this.musicVolume * 0.6 : 0;
    this.musicGain.gain.setTargetAtTime(music, now, 0.3);
  }

  setSettings({ sfxOn, musicOn, sfxVolume, musicVolume }) {
    if (sfxOn !== undefined) this.sfxOn = sfxOn;
    if (musicOn !== undefined) this.musicOn = musicOn;
    if (sfxVolume !== undefined) this.sfxVolume = sfxVolume;
    if (musicVolume !== undefined) this.musicVolume = musicVolume;
    this.applyVolumes();
  }

  setMood(theme, intensity) {
    this.mood = { theme: theme % MUSIC_THEMES.length, intensity };
  }

  setMusicPaused(paused) {
    this.musicPaused = paused;
    this.applyVolumes();
  }

  // ---------- 合成基本元件 ----------
  tone(t, { freq, to = freq, dur, type = 'sine', vol = 0.1, attack = 0.005, out = this.sfxGain, detune = 0 }) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  noise(t, { dur, vol = 0.1, filter = 'lowpass', freq = 1000, to = freq, q = 1, attack = 0.003, out = this.sfxGain }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---------- 音效 ----------
  ready() {
    return this.ctx && this.ctx.state === 'running' && this.sfxOn;
  }

  play(name) {
    if (!this.ready()) return;
    const recipe = SOUNDS[name];
    if (!recipe) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed[name] ?? -1) < (recipe.gap ?? 0.03)) return;
    if (this.voices > 28) return;
    this.lastPlayed[name] = now;
    this.voices += 1;
    setTimeout(() => (this.voices -= 1), 250);
    recipe.fn(this, now);
  }

  playFire(towerType) {
    this.play(TOWER_FIRE[towerType] ?? 'arrow');
  }

  playImpact(kind) {
    if (IMPACT[kind]) this.play(IMPACT[kind]);
  }

  // ---------- 背景音樂（前瞻排程的步進音序器） ----------
  startSequencer() {
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.nextNoteTime < this.ctx.currentTime - 0.5) this.nextNoteTime = this.ctx.currentTime + 0.05;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      if (this.musicOn && !this.musicPaused) this.playStep(this.step, this.nextNoteTime);
      const sixteenth = 60 / MUSIC_TEMPO[this.mood.intensity] / 4;
      this.nextNoteTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    const theme = MUSIC_THEMES[this.mood.theme];
    const intensity = this.mood.intensity;
    const out = this.musicGain;
    const bar = Math.floor(step / 16);
    const beat = step % 16;
    const degree = theme.progression[bar];
    const note = (deg, octave = 0) => {
      const len = theme.scale.length;
      const idx = degree + deg;
      return theme.root + theme.scale[((idx % len) + len) % len] + 12 * (Math.floor(idx / len) + octave);
    };
    const sixteenth = 60 / MUSIC_TEMPO[intensity] / 4;

    // 和弦鋪底：每小節開頭
    if (beat === 0) {
      for (const d of [0, 2, 4]) {
        this.tone(t, { freq: midiToFreq(note(d)), dur: sixteenth * 16, type: 'triangle', vol: intensity === 'calm' ? 0.035 : 0.025, attack: 0.4, out, detune: d * 3 });
      }
    }
    // 低音
    const bassHits = intensity === 'calm' ? [0, 8] : [0, 3, 6, 8, 11, 14];
    if (bassHits.includes(beat)) {
      this.tone(t, { freq: midiToFreq(note(0, -2)), dur: sixteenth * (intensity === 'calm' ? 7 : 2.5), type: intensity === 'boss' ? 'sawtooth' : 'triangle', vol: 0.11, attack: 0.01, out });
    }
    // 琶音旋律
    const arpEvery = intensity === 'calm' ? 2 : 1;
    if (beat % arpEvery === 0) {
      const deg = theme.arp[(beat / arpEvery) % theme.arp.length];
      const vol = intensity === 'calm' ? 0.03 : 0.022;
      this.tone(t, { freq: midiToFreq(note(deg, 1)), dur: sixteenth * 1.6, type: intensity === 'calm' ? 'sine' : 'square', vol, attack: 0.005, out });
    }
    // 鼓組：只在戰鬥時
    if (intensity !== 'calm') {
      if (beat % 4 === 0 || (intensity === 'boss' && beat % 4 === 2 && beat > 8)) {
        this.tone(t, { freq: 150, to: 40, dur: 0.18, type: 'sine', vol: 0.32, attack: 0.002, out });
      }
      if (beat === 4 || beat === 12) this.noise(t, { dur: 0.14, vol: 0.12, filter: 'bandpass', freq: 1800, q: 0.8, out });
      if (beat % 2 === 0) this.noise(t, { dur: 0.04, vol: beat % 4 === 2 ? 0.05 : 0.03, filter: 'highpass', freq: 7000, out });
    } else if (beat === 0 && bar % 2 === 0) {
      // 平靜時偶爾的高音鈴聲
      this.tone(t, { freq: midiToFreq(note(4, 2)), dur: 1.2, type: 'sine', vol: 0.02, attack: 0.02, out });
    }
  }
}

const SOUNDS = {
  // 塔的攻擊
  arrow: {
    gap: 0.06,
    fn: (a, t) => {
      a.noise(t, { dur: 0.07, vol: 0.06, filter: 'highpass', freq: 2500, to: 5000 });
      a.tone(t, { freq: 700, to: 380, dur: 0.06, type: 'triangle', vol: 0.05 });
    }
  },
  gatling: {
    gap: 0.045,
    fn: (a, t) => {
      a.noise(t, { dur: 0.035, vol: 0.08, filter: 'bandpass', freq: 3000, q: 1.5 });
      a.tone(t, { freq: 220, to: 120, dur: 0.03, type: 'square', vol: 0.03 });
    }
  },
  cannonFire: {
    gap: 0.08,
    fn: (a, t) => {
      a.tone(t, { freq: 160, to: 45, dur: 0.22, type: 'sine', vol: 0.35 });
      a.noise(t, { dur: 0.12, vol: 0.12, filter: 'lowpass', freq: 1500, to: 300 });
    }
  },
  frost: {
    gap: 0.08,
    fn: (a, t) => {
      a.tone(t, { freq: 1800, to: 2600, dur: 0.12, type: 'triangle', vol: 0.04 });
      a.tone(t + 0.03, { freq: 2400, to: 3200, dur: 0.1, type: 'sine', vol: 0.03 });
    }
  },
  zap: {
    gap: 0.08,
    fn: (a, t) => {
      a.noise(t, { dur: 0.16, vol: 0.12, filter: 'bandpass', freq: 3500, to: 900, q: 4 });
      a.tone(t, { freq: 90, to: 60, dur: 0.14, type: 'sawtooth', vol: 0.06 });
    }
  },
  poison: {
    gap: 0.1,
    fn: (a, t) => {
      a.tone(t, { freq: 260, to: 520, dur: 0.07, type: 'sine', vol: 0.08 });
      a.tone(t + 0.05, { freq: 340, to: 680, dur: 0.06, type: 'sine', vol: 0.06 });
    }
  },
  sniper: {
    gap: 0.08,
    fn: (a, t) => {
      a.noise(t, { dur: 0.18, vol: 0.2, filter: 'highpass', freq: 1200, to: 400, attack: 0.001 });
      a.tone(t, { freq: 1600, to: 180, dur: 0.12, type: 'square', vol: 0.06, attack: 0.001 });
      a.noise(t + 0.02, { dur: 0.35, vol: 0.05, filter: 'lowpass', freq: 600, to: 150 });
    }
  },
  plasma: {
    gap: 0.1,
    fn: (a, t) => {
      a.tone(t, { freq: 200, to: 1200, dur: 0.18, type: 'sawtooth', vol: 0.06 });
      a.tone(t, { freq: 300, to: 1800, dur: 0.18, type: 'square', vol: 0.03 });
    }
  },
  pulse: {
    gap: 0.15,
    fn: (a, t) => {
      a.tone(t, { freq: 220, to: 70, dur: 0.35, type: 'sine', vol: 0.16, attack: 0.02 });
      a.noise(t, { dur: 0.3, vol: 0.05, filter: 'bandpass', freq: 800, to: 200, q: 2 });
    }
  },
  // 命中與爆炸
  explosion: {
    gap: 0.07,
    fn: (a, t) => {
      a.noise(t, { dur: 0.45, vol: 0.32, filter: 'lowpass', freq: 2200, to: 120, attack: 0.002 });
      a.tone(t, { freq: 110, to: 30, dur: 0.4, type: 'sine', vol: 0.35, attack: 0.002 });
    }
  },
  frostHit: {
    gap: 0.08,
    fn: (a, t) => a.noise(t, { dur: 0.12, vol: 0.05, filter: 'highpass', freq: 5000, to: 8000 })
  },
  splat: {
    gap: 0.08,
    fn: (a, t) => {
      a.noise(t, { dur: 0.15, vol: 0.08, filter: 'lowpass', freq: 900, to: 200 });
      a.tone(t, { freq: 180, to: 90, dur: 0.1, type: 'sine', vol: 0.06 });
    }
  },
  kill: {
    gap: 0.05,
    fn: (a, t) => a.tone(t, { freq: 520, to: 1040, dur: 0.06, type: 'triangle', vol: 0.035 })
  },
  bossDeath: {
    fn: (a, t) => {
      for (let i = 0; i < 4; i++) {
        a.noise(t + i * 0.12, { dur: 0.6, vol: 0.35, filter: 'lowpass', freq: 2500 - i * 400, to: 80 });
        a.tone(t + i * 0.12, { freq: 120 - i * 15, to: 25, dur: 0.6, type: 'sine', vol: 0.3 });
      }
    }
  },
  // 介面
  build: { fn: (a, t) => [440, 660].forEach((f, i) => a.tone(t + i * 0.06, { freq: f, dur: 0.1, type: 'triangle', vol: 0.09 })) },
  upgrade: { fn: (a, t) => [523, 659, 784].forEach((f, i) => a.tone(t + i * 0.06, { freq: f, dur: 0.14, type: 'triangle', vol: 0.09 })) },
  merge: {
    fn: (a, t) => {
      [523, 659, 784, 1047].forEach((f, i) => a.tone(t + i * 0.07, { freq: f, dur: 0.25, type: 'triangle', vol: 0.1 }));
      a.noise(t + 0.25, { dur: 0.4, vol: 0.05, filter: 'highpass', freq: 6000 });
    }
  },
  sell: { fn: (a, t) => [880, 1320].forEach((f, i) => a.tone(t + i * 0.05, { freq: f, dur: 0.12, type: 'sine', vol: 0.08 })) },
  leak: { gap: 0.15, fn: (a, t) => a.tone(t, { freq: 220, to: 90, dur: 0.3, type: 'square', vol: 0.08 }) },
  wave: {
    fn: (a, t) => [392, 392, 523].forEach((f, i) => a.tone(t + i * 0.12, { freq: f, dur: i === 2 ? 0.35 : 0.1, type: 'square', vol: 0.06 }))
  },
  boss: {
    fn: (a, t) => [0, 0.35].forEach((d) => a.tone(t + d, { freq: 110, to: 98, dur: 0.3, type: 'sawtooth', vol: 0.12 }))
  },
  clear: { fn: (a, t) => [523, 659, 784, 1047].forEach((f, i) => a.tone(t + i * 0.08, { freq: f, dur: 0.2, type: 'triangle', vol: 0.08 })) },
  error: { fn: (a, t) => a.tone(t, { freq: 160, to: 140, dur: 0.14, type: 'square', vol: 0.06 }) },
  relocate: {
    fn: (a, t) => {
      a.tone(t, { freq: 220, to: 880, dur: 0.8, type: 'sine', vol: 0.12, attack: 0.05 });
      a.noise(t, { dur: 0.9, vol: 0.06, filter: 'bandpass', freq: 400, to: 3000, q: 2 });
    }
  }
};
