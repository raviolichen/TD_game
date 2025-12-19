/**
 * AudioManager - 管理遊戲中的所有音效
 * 使用 Web Audio API 程序化生成音效，無需外部音檔
 */
export default class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.audioContext = null;
        this.masterGain = null;
        this.muted = false;
        this.volume = 0.3; // 預設音量

        this.init();
    }

    /**
     * 初始化 Web Audio API
     */
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
        } catch (e) {
            console.warn('Web Audio API 不可用:', e);
        }
    }

    /**
     * 確保音頻上下文已恢復（用戶互動後）
     */
    ensureContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * 播放建塔音效
     */
    playBuildSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(660, this.audioContext.currentTime + 0.2);

        gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.25);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 0.25);
    }

    /**
     * 播放升級音效
     */
    playUpgradeSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        // 上升音階
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.type = 'triangle';
            osc.frequency.value = freq;

            const startTime = this.audioContext.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

            osc.start(startTime);
            osc.stop(startTime + 0.15);
        });
    }

    /**
     * 播放合成音效
     */
    playCraftSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        // 魔法合成音效
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(300, this.audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.3);

        osc2.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.3);

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);

        osc1.start(this.audioContext.currentTime);
        osc2.start(this.audioContext.currentTime);
        osc1.stop(this.audioContext.currentTime + 0.4);
        osc2.stop(this.audioContext.currentTime + 0.4);
    }

    /**
     * 播放攻擊音效（根據塔類型）
     */
    playShootSound(towerType) {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        // 根據塔類型設定不同音效
        switch (towerType) {
            case 'arrow':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
                osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.05);
                gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.08);
                break;

            case 'fire':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
                osc.frequency.linearRampToValueAtTime(80, this.audioContext.currentTime + 0.15);
                gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.15);
                break;

            case 'ice':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
                osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
                gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.12);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.12);
                break;

            case 'magic':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.08);
                osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.12);
                gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.15);
                break;

            case 'lightning':
                // 電擊音效 - 快速噪音脈衝
                this.playNoiseShot(0.1, 0.2);
                break;

            default:
                // 通用射擊音效
                osc.type = 'square';
                osc.frequency.setValueAtTime(500, this.audioContext.currentTime);
                osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.06);
                gain.gain.setValueAtTime(0.12, this.audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + 0.08);
        }
    }

    /**
     * 播放噪音射擊（用於電擊等）
     */
    playNoiseShot(duration, volume) {
        if (!this.audioContext || this.muted) return;

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();

        source.buffer = buffer;
        source.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.value = volume;

        source.start(this.audioContext.currentTime);
    }

    /**
     * 播放波次開始音效
     */
    playWaveStartSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        // 警報音效
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'square';

        // 雙音交替
        const now = this.audioContext.currentTime;
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(550, now + 0.15);
        osc.frequency.setValueAtTime(440, now + 0.3);
        osc.frequency.setValueAtTime(550, now + 0.45);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.setValueAtTime(0.25, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.6);
    }

    /**
     * 播放敵人擊殺音效
     */
    playEnemyKillSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.15);

        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        osc.start(this.audioContext.currentTime);
        osc.stop(this.audioContext.currentTime + 0.15);
    }

    /**
     * 播放遊戲結束音效
     */
    playGameOverSound() {
        if (!this.audioContext || this.muted) return;
        this.ensureContext();

        // 下降音階
        const notes = [523, 466, 392, 349, 261]; // C5, Bb4, G4, F4, C4
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            const startTime = this.audioContext.currentTime + i * 0.2;
            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

            osc.start(startTime);
            osc.stop(startTime + 0.35);
        });
    }

    /**
     * 設置主音量
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
    }

    /**
     * 切換靜音
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
        return this.muted;
    }

    /**
     * 檢查是否靜音
     */
    isMuted() {
        return this.muted;
    }

    /**
     * 開始播放背景音樂 (BGM)
     * 使用程序化生成的 8-bit 風格循環音樂
     */
    startBGM() {
        if (!this.audioContext || this.isPlayingBGM) return;
        this.ensureContext();
        this.isPlayingBGM = true;
        this.bgmNodes = [];
        this.nextNoteTime = this.audioContext.currentTime;
        this.noteIndex = 0;

        // 簡單的 C 大調旋律模式 (可愛風格)
        // 頻率對照: C4=261.6, D4=293.7, E4=329.6, F4=349.2, G4=392.0, A4=440.0, B4=493.9, C5=523.3
        const melody = [
            { f: 261.6, d: 0.2 }, { f: 329.6, d: 0.2 }, { f: 392.0, d: 0.2 }, { f: 523.3, d: 0.2 }, // C E G C (Arp)
            { f: 392.0, d: 0.2 }, { f: 329.6, d: 0.2 }, { f: 261.6, d: 0.4 }, // G E C
            { f: 349.2, d: 0.2 }, { f: 349.2, d: 0.2 }, { f: 329.6, d: 0.2 }, { f: 329.6, d: 0.2 }, // F F E E
            { f: 293.7, d: 0.2 }, { f: 293.7, d: 0.2 }, { f: 392.0, d: 0.4 }, // D D G
            { f: 261.6, d: 0.2 }, { f: 329.6, d: 0.2 }, { f: 392.0, d: 0.2 }, { f: 493.9, d: 0.2 }, // C E G B
            { f: 523.3, d: 0.8 } // C5
        ];

        this.scheduleNextNote(melody);
    }

    scheduleNextNote(melody) {
        if (!this.isPlayingBGM || !this.audioContext) return;

        // 確保不落後太多，允許 0.1s 緩衝
        const secondsPerBeat = 0.5;
        const lookahead = 0.1;

        // 如果下個音符的時間快到了，就排程它
        while (this.nextNoteTime < this.audioContext.currentTime + lookahead) {
            const note = melody[this.noteIndex];
            this.playNote(note.f, this.nextNoteTime, note.d);

            // 更新時間與索引
            this.nextNoteTime += note.d;
            this.noteIndex = (this.noteIndex + 1) % melody.length;
        }

        // 保持循環檢查
        this.bgmTimer = setTimeout(() => {
            this.scheduleNextNote(melody);
        }, 50);
    }

    playNote(frequency, startTime, duration) {
        if (this.muted) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle'; // 三角波聽起來比較像 8-bit 遊戲機
        osc.frequency.value = frequency;

        // BGM 音量稍小以免蓋過音效
        const volume = 0.15;

        osc.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gain.gain.setValueAtTime(volume, startTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration);

        // 存儲引用以便停止（雖然這裡是自動停止，但為了徹底清理）
        // 實際運作太快，通常不需要手動 stop 已經排程完畢的音符，除非立即靜音
    }

    /**
     * 停止背景音樂
     */
    stopBGM() {
        this.isPlayingBGM = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.stopBGM();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
