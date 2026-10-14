// 以 WebAudio 合成的簡易音效，無需音檔
const SOUNDS = {
  shoot: { freq: 880, to: 600, dur: 0.05, type: 'square', vol: 0.02, gap: 0.07 },
  boom: { freq: 140, to: 50, dur: 0.18, type: 'sawtooth', vol: 0.06, gap: 0.08 },
  zap: { freq: 1200, to: 300, dur: 0.08, type: 'sawtooth', vol: 0.03, gap: 0.08 },
  build: { freq: 440, to: 660, dur: 0.1, type: 'triangle', vol: 0.08 },
  upgrade: { freq: 520, to: 1040, dur: 0.18, type: 'triangle', vol: 0.08 },
  merge: { freq: 330, to: 1320, dur: 0.35, type: 'triangle', vol: 0.1 },
  sell: { freq: 700, to: 350, dur: 0.12, type: 'triangle', vol: 0.07 },
  leak: { freq: 200, to: 90, dur: 0.25, type: 'square', vol: 0.07, gap: 0.15 },
  wave: { freq: 300, to: 600, dur: 0.3, type: 'square', vol: 0.05 },
  clear: { freq: 660, to: 990, dur: 0.3, type: 'triangle', vol: 0.08 },
  error: { freq: 160, to: 140, dur: 0.12, type: 'square', vol: 0.05 },
  relocate: { freq: 220, to: 880, dur: 0.6, type: 'sine', vol: 0.1 }
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastPlayed = {};
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name) {
    const s = SOUNDS[name];
    if (!s || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (s.gap && now - (this.lastPlayed[name] ?? -1) < s.gap) return;
    this.lastPlayed[name] = now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = s.type;
    osc.frequency.setValueAtTime(s.freq, now);
    osc.frequency.exponentialRampToValueAtTime(s.to, now + s.dur);
    gain.gain.setValueAtTime(s.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + s.dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + s.dur + 0.02);
  }
}
