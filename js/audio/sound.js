// SES — tamamen tarayıcıda üretilen (Web Audio) özgün efektler ve müzik.
// Ses dosyası yoktur; Web Audio yoksa ya da tarayıcı engellerse oyun sessiz
// çalışmaya devam eder. Mobil kısıtlama: bağlam ilk dokunuşta açılır.

import CONFIG from '../config/gameConfig.js';

const KEY = `${CONFIG.STORAGE.prefix}sound`;

export class SoundEngine {
  constructor(prefs = {}) {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
    this.music = saved.music ?? prefs.music ?? CONFIG.SOUND.musicDefault;
    this.sfx = saved.sfx ?? prefs.sfx ?? CONFIG.SOUND.sfxDefault;
    this.reelNodes = null;
    this.musicTimer = null;
    this.step = 0;
  }

  /** İlk kullanıcı dokunuşunda çağrılır. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.gain.value = this.music ? CONFIG.SOUND.musicVolume : 0;
        this.sfxBus.gain.value = this.sfx ? CONFIG.SOUND.sfxVolume : 0;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.reverb = this._makeReverb();
        this.reverb.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.music) this._startMusic();
    } catch { this.ctx = null; }
  }

  _save() { try { localStorage.setItem(KEY, JSON.stringify({ music: this.music, sfx: this.sfx })); } catch { /* yok */ } }

  setMusic(on) {
    this.music = on; this._save();
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? CONFIG.SOUND.musicVolume : 0, this.ctx.currentTime, 0.2);
    if (on) this._startMusic(); else this._stopMusic();
  }

  setSfx(on) {
    this.sfx = on; this._save();
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? CONFIG.SOUND.sfxVolume : 0, this.ctx.currentTime, 0.05);
    if (!on) this.reelStop(true);
  }

  /** Sayfa gizlenince sesi durdur, geri gelince devam et. */
  suspend(hidden) {
    if (!this.ctx) return;
    try { if (hidden) this.ctx.suspend(); else this.ctx.resume(); } catch { /* yok */ }
  }

  get ok() { return Boolean(this.ctx) && this.sfx; }

  // ─── yardımcılar ────────────────────────────────────────────────────────
  _makeReverb() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    conv.connect(g);
    this.reverbIn = conv;
    return g;
  }

  _tone({ freq = 440, type = 'sine', at = 0, dur = 0.2, vol = 0.3, glide = null, bus = 'sfx', wet = 0.3, attack = 0.005 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    if (wet > 0 && this.reverbIn) {
      const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.reverbIn);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise({ at = 0, dur = 0.1, vol = 0.2, freq = 2000, q = 1, type = 'bandpass' }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
  }

  // ─── efektler ───────────────────────────────────────────────────────────
  click() {
    if (!this.ok) return;
    this._tone({ freq: 1400, type: 'triangle', dur: 0.05, vol: 0.18, wet: 0 });
    this._tone({ freq: 700, type: 'sine', dur: 0.08, vol: 0.12, wet: 0.1 });
  }

  spinStart() {
    if (!this.ok) return;
    this._noise({ dur: 0.35, vol: 0.25, freq: 900, q: 0.7, type: 'lowpass' });
    this._tone({ freq: 220, type: 'sawtooth', dur: 0.3, vol: 0.12, glide: 660, wet: 0.15 });
    this._tone({ freq: 880, type: 'triangle', at: 0.05, dur: 0.18, vol: 0.12, glide: 1760 });
  }

  /** Makaraların dönüş sesi: tıkırtılı ritim (durana kadar). */
  reelLoop(count = 5) {
    if (!this.ok) return;
    this.reelStop(true);
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.1);
    g.connect(this.sfxBus);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2.5;
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    lfo.connect(lg).connect(amp.gain);
    o.connect(f).connect(amp).connect(g);
    o.start(); lfo.start();
    this.reelNodes = { o, lfo, g, count };
  }

  reelStop(all = false) {
    const n = this.reelNodes;
    if (!n || !this.ctx) return;
    n.count -= 1;
    if (all || n.count <= 0) {
      const t = this.ctx.currentTime;
      n.g.gain.setTargetAtTime(0.0001, t, 0.04);
      try { n.o.stop(t + 0.2); n.lfo.stop(t + 0.2); } catch { /* yok */ }
      this.reelNodes = null;
    } else {
      n.g.gain.setTargetAtTime(0.16 * (n.count / 5) + 0.03, this.ctx.currentTime, 0.05);
    }
  }

  /** Makara duruşu: mekanik "tunk". */
  reelThunk(index = 0) {
    if (!this.ok) return;
    this._tone({ freq: 140 - index * 6, type: 'sine', dur: 0.16, vol: 0.4, glide: 70, wet: 0.08 });
    this._noise({ dur: 0.06, vol: 0.22, freq: 3200, q: 3 });
    this._tone({ freq: 1200 + index * 120, type: 'triangle', at: 0.01, dur: 0.06, vol: 0.06, wet: 0.2 });
  }

  anticipation() {
    if (!this.ok) return;
    for (let i = 0; i < 6; i++) this._tone({ freq: 520 + i * 90, type: 'triangle', at: i * 0.12, dur: 0.14, vol: 0.1, wet: 0.35 });
  }

  smallWin() {
    if (!this.ok) return;
    [784, 988, 1175, 1568].forEach((f, i) => this._tone({ freq: f, type: 'triangle', at: i * 0.07, dur: 0.35, vol: 0.18, wet: 0.45 }));
    this._noise({ at: 0.25, dur: 0.4, vol: 0.06, freq: 8000, q: 0.6, type: 'highpass' });
  }

  bigWin() {
    if (!this.ok) return;
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => this._tone({ freq: f, type: 'sawtooth', at: i * 0.09, dur: 0.5, vol: 0.09, wet: 0.5 }));
    [523, 659, 784].forEach((f) => this._tone({ freq: f, type: 'triangle', at: 0.7, dur: 1.8, vol: 0.12, wet: 0.6 }));
    this._tone({ freq: 65, type: 'sine', dur: 0.9, vol: 0.5, glide: 40, wet: 0.2 });
    for (let i = 0; i < 18; i++) this._tone({ freq: 2400 + Math.random() * 2400, type: 'sine', at: 0.5 + i * 0.08, dur: 0.12, vol: 0.05, wet: 0.7 });
  }

  /** Kazanç sayacı tıkırtısı. */
  tick() {
    if (!this.ok) return;
    this._tone({ freq: 1800 + Math.random() * 300, type: 'sine', dur: 0.04, vol: 0.05, wet: 0 });
  }

  bonusOpen() {
    if (!this.ok) return;
    this._noise({ dur: 0.9, vol: 0.18, freq: 400, q: 0.5, type: 'lowpass' });
    this._tone({ freq: 110, type: 'sawtooth', dur: 0.8, vol: 0.12, glide: 440, wet: 0.4 });
    [659, 880, 1109, 1319, 1760].forEach((f, i) => this._tone({ freq: f, type: 'triangle', at: 0.7 + i * 0.06, dur: 0.9, vol: 0.12, wet: 0.6 }));
  }

  bonusTrigger() {
    if (!this.ok) return;
    [392, 523, 659, 784].forEach((f, i) => this._tone({ freq: f, type: 'square', at: i * 0.11, dur: 0.22, vol: 0.07, wet: 0.4 }));
  }

  error() {
    if (!this.ok) return;
    this._tone({ freq: 220, type: 'square', dur: 0.15, vol: 0.08, glide: 160 });
  }

  // ─── müzik: yavaş, gizemli arpej + pad ──────────────────────────────────
  _startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
    const beat = 0.32;
    let next = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.6) {
        const at = next - this.ctx.currentTime;
        const chord = chords[Math.floor(this.step / 16) % chords.length];
        const n = this.step % 16;
        if (n === 0) chord.forEach((f) => this._tone({ freq: f / 2, type: 'sine', at, dur: beat * 16, vol: 0.08, bus: 'music', wet: 0.5, attack: 0.6 }));
        const arp = [0, 1, 2, 1, 2, 0, 2, 1][n % 8];
        if (n % 2 === 0) this._tone({ freq: chord[arp] * 2, type: 'triangle', at, dur: beat * 1.6, vol: 0.05, bus: 'music', wet: 0.6 });
        if (n % 4 === 2) this._tone({ freq: chord[2] * 4, type: 'sine', at, dur: beat * 0.8, vol: 0.02, bus: 'music', wet: 0.8 });
        this.step++;
        next += beat;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 150);
  }

  _stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
