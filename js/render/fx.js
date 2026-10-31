// EFEKTLER (Canvas)
//   BackgroundFX — derin mor sisli atmosfer, ışık huzmeleri, yavaş süzülen
//                  ışık parçacıkları ve uzakta büyük elmas siluetleri.
//   BurstFX      — kazanma anı: mor ışık patlaması (şok dalgası), dönen elmas
//                  parçacıkları, kıvılcımlar. Ekranın üstünde, dokunuşu engellemez.

import CONFIG from '../config/gameConfig.js';
import { symbolURL } from './symbols.js';

export function detectIntensity(reduced) {
  if (CONFIG.FX.intensity !== 'auto') return CONFIG.FX.intensity;
  if (reduced) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 4 || mem <= 2) return 'medium';
  return 'high';
}

function fitCanvas(cv, scale = null) {
  const dpr = scale ?? Math.min(CONFIG.FX.maxDpr, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class BackgroundFX {
  constructor(canvas, intensity = 'high', reduced = false) {
    this.cv = canvas;
    this.n = CONFIG.FX.particles[intensity] ?? 40;
    this.reduced = reduced;
    this.parts = [];
    this.gems = [];
    this.t = 0;
    this.running = false;
    // Uzak elmaslar: bir kez bulanıklaştırılmış küçük görüntüler (her karede filtre yok).
    this.imgs = ['blue', 'purple', 'gold'].map((id) => {
      const sprite = { ready: false, cv: document.createElement('canvas') };
      const i = new Image();
      i.onload = () => {
        sprite.cv.width = sprite.cv.height = 128;
        const c = sprite.cv.getContext('2d');
        c.filter = 'blur(3px)';
        c.drawImage(i, 8, 8, 112, 112);
        sprite.ready = true;
      };
      i.src = symbolURL(id, 'normal');
      return sprite;
    });
    this.frameGap = 1000 / 24;   // yavaş atmosfer: 24 kare/sn yeter (telefon CPU'su)
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
  }

  resize() {
    // Arka plan yumuşak bir atmosferdir: yarım çözünürlükte çizilir (performans).
    const { ctx, w, h } = fitCanvas(this.cv, 0.5);
    this.ctx = ctx; this.w = w; this.h = h;
    this._bakeFog(w, h);
    this._bakeBeams();
    this.parts = Array.from({ length: this.n }, () => this._p(true));
    this.gems = Array.from({ length: 4 }, (_, i) => ({
      img: this.imgs[i % 3], x: rnd(0, w), y: rnd(0, h), s: rnd(90, 190), a: rnd(0.05, 0.11),
      vx: rnd(-4, 4), vy: rnd(-3, 3), r: rnd(0, Math.PI * 2), vr: rnd(-0.05, 0.05),
    }));
  }

  /**
   * Sis: üç radyal leke BİR KEZ düşük çözünürlüklü tuvale pişirilir. Kare
   * başına 3 tam ekran gradyan yerine tek bir ölçekli blit yapılır.
   */
  _bakeFog(w, h) {
    const k = 0.22;
    const cv = document.createElement('canvas');
    cv.width = Math.max(64, Math.round(w * k));
    cv.height = Math.max(64, Math.round(h * k));
    const c = cv.getContext('2d');
    const blobs = [
      [0.5, 0.34, 'rgba(160,60,255,.30)'],
      [0.24, 0.62, 'rgba(60,140,255,.22)'],
      [0.76, 0.70, 'rgba(160,60,255,.24)'],
    ];
    const r = Math.max(cv.width, cv.height) * 0.66;
    for (const [bx, by, color] of blobs) {
      const x = cv.width * bx, y = cv.height * by;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, cv.width, cv.height);
    }
    this.fog = cv;
  }

  /** Işık huzmeleri de bir kez pişirilir (mavi + mor), kare başına tek blit. */
  _bakeBeams() {
    this.beams = ['160,110,255', '90,170,255'].map((c) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 256;
      const x = cv.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, `rgba(${c},.55)`);
      g.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = g;
      x.beginPath(); x.moveTo(26, 0); x.lineTo(38, 0); x.lineTo(64, 256); x.lineTo(0, 256); x.closePath(); x.fill();
      // yumuşak kenar
      x.globalCompositeOperation = 'destination-in';
      const m = x.createLinearGradient(0, 0, 64, 0);
      m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.5, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = m; x.fillRect(0, 0, 64, 256);
      return cv;
    });
  }

  _p(anywhere = false) {
    return {
      x: rnd(0, this.w), y: anywhere ? rnd(0, this.h) : this.h + 10,
      r: rnd(0.6, 2.4), vy: rnd(-22, -6), vx: rnd(-5, 5), a: rnd(0.25, 0.9), tw: rnd(0, Math.PI * 2),
      hue: Math.random() < 0.25 ? 45 : Math.random() < 0.5 ? 190 : 280,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      if (t - last >= this.frameGap - 2) {
        const dt = Math.min(0.08, (t - last) / 1000);
        last = t;
        this.draw(dt);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  /** Kare hızını ayarlar (dönüş sırasında arka plan yavaşlatılır). */
  setFps(fps) {
    const n = Number(fps) || 30;
    this.frameGap = 1000 / Math.max(8, Math.min(60, n));
  }

  draw(dt) {
    const { ctx, w, h } = this;
    this.t += dt * (this.reduced ? 0.3 : 1);
    const t = this.t;
    ctx.clearRect(0, 0, w, h);

    // sis: pişirilmiş düşük çözünürlüklü katman, çok hafif sürüklenme
    if (this.fog) {
      const dx = Math.sin(t * 0.07) * w * 0.035;
      const dy = Math.cos(t * 0.05) * h * 0.03;
      ctx.drawImage(this.fog, -w * 0.03 + dx, -h * 0.03 + dy, w * 1.06, h * 1.06);
    }

    // ışık huzmeleri (pişirilmiş, kare başına yalnız blit)
    if (this.beams) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bw = Math.max(80, w * 0.13);
      const bl = h * 1.35;
      for (let i = 0; i < 4; i++) {
        const ang = (i - 1.5) * 0.17 + Math.sin(t * 0.18 + i * 1.6) * 0.1;
        ctx.save();
        ctx.translate(w * (0.15 + i * 0.23), -20);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(this.beams[i % 2], -bw / 2, 0, bw, bl);
        ctx.restore();
      }
      ctx.restore();
    }

    // uzakta büyük elmas siluetleri
    for (const gm of this.gems) {
      gm.x += gm.vx * dt; gm.y += gm.vy * dt; gm.r += gm.vr * dt;
      if (gm.x < -gm.s) gm.x = w + gm.s; if (gm.x > w + gm.s) gm.x = -gm.s;
      if (gm.y < -gm.s) gm.y = h + gm.s; if (gm.y > h + gm.s) gm.y = -gm.s;
      if (!gm.img.ready) continue;
      ctx.save();
      ctx.globalAlpha = gm.a;
      ctx.translate(gm.x, gm.y);
      ctx.rotate(gm.r);
      ctx.drawImage(gm.img.cv, -gm.s / 2, -gm.s / 2, gm.s, gm.s);
      ctx.restore();
    }

    // ışık parçacıkları
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.tw += dt * 2;
      if (p.y < -10) this.parts[i] = this._p();
      const a = p.a * (0.55 + 0.45 * Math.sin(p.tw));
      ctx.fillStyle = `hsla(${p.hue},100%,75%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.r > 1.8) {
        ctx.fillStyle = `hsla(${p.hue},100%,70%,${a * 0.18})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ─── Kazanma efektleri ──────────────────────────────────────────────────────
export class BurstFX {
  constructor(canvas, intensity = 'high') {
    this.cv = canvas;
    this.intensity = intensity;
    this.items = [];
    this.rings = [];
    this.flash = 0;
    this.running = false;
    this.gemImgs = ['blue', 'purple', 'gold', 'ruby', 'emerald'].map((id) => { const i = new Image(); i.src = symbolURL(id, 'normal'); return i; });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const { ctx, w, h } = fitCanvas(this.cv, Math.min(1.25, window.devicePixelRatio || 1));
    this.ctx = ctx; this.w = w; this.h = h;
  }

  /** Küçük kazanç: hücre çevresinde altın kıvılcımlar. */
  sparks(x, y, n = 14, hue = 45) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(60, 220);
      this.items.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rnd(0.5, 0.9), age: 0, r: rnd(1, 2.6), hue });
    }
    this._run();
  }

  /** Büyük kazanç: mor ışık patlaması + elmas parçacıkları. */
  bigBurst(x, y, power = 1) {
    const n = Math.round((CONFIG.FX.shards[this.intensity] ?? 50) * power);
    this.flash = 1;
    this.rings.push({ x, y, r: 10, v: Math.max(this.w, this.h) * 1.1, life: 1.1, age: 0, color: '190,90,255', width: 26 });
    this.rings.push({ x, y, r: 0, v: Math.max(this.w, this.h) * 0.8, life: 1.3, age: -0.12, color: '120,220,255', width: 12 });
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(220, 900) * (0.6 + power * 0.4);
      this.items.push({
        kind: Math.random() < 0.55 ? 'gem' : 'shard',
        img: this.gemImgs[i % this.gemImgs.length],
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, g: 900,
        rot: rnd(0, 6), vr: rnd(-9, 9), s: rnd(14, 34), life: rnd(1.6, 2.6), age: 0,
        hue: [190, 280, 45, 320][i % 4],
      });
    }
    this._run();
  }

  /** Sürekli elmas yağmuru (DIAMOND WIN süresince). */
  rain(seconds = 3, rate = 30) {
    this.rainUntil = performance.now() + seconds * 1000;
    this.rainRate = rate;
    this._run();
  }

  _run() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const alive = this._draw(dt, t);
      if (alive) requestAnimationFrame(loop);
      else { this.running = false; this.ctx.clearRect(0, 0, this.w, this.h); }
    };
    requestAnimationFrame(loop);
  }

  _draw(dt, now) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    if (this.rainUntil && now < this.rainUntil) {
      const k = Math.random() < this.rainRate * dt ? 1 : 0;
      for (let i = 0; i < k + (Math.random() < this.rainRate * dt ? 1 : 0); i++) {
        this.items.push({ kind: 'gem', img: this.gemImgs[Math.floor(rnd(0, 5))], x: rnd(0, w), y: -30, vx: rnd(-30, 30), vy: rnd(160, 320), g: 260, rot: rnd(0, 6), vr: rnd(-4, 4), s: rnd(16, 34), life: 3.2, age: 0 });
      }
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,120,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, w, h);
      this.flash = Math.max(0, this.flash - dt * 2.4);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.rings = this.rings.filter((r) => {
      r.age += dt;
      if (r.age < 0) return true;
      const u = r.age / r.life;
      if (u >= 1) return false;
      const rad = r.r + r.v * (1 - Math.pow(1 - u, 2.2));
      ctx.strokeStyle = `rgba(${r.color},${(1 - u) * 0.85})`;
      ctx.lineWidth = r.width * (1 - u) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = (r.width * (1 - u) + 1) * 3;
      ctx.strokeStyle = `rgba(${r.color},${(1 - u) * 0.18})`;
      ctx.stroke();
      return true;
    });
    ctx.restore();

    this.items = this.items.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) return false;
      const fade = 1 - Math.max(0, (p.age - p.life * 0.6) / (p.life * 0.4));
      p.vy += (p.g ?? 300) * dt;
      p.vx *= 1 - dt * 0.6;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `hsla(${p.hue},100%,70%,${fade})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        return true;
      }
      p.rot += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = fade;
      if (p.kind === 'gem' && p.img.complete) {
        // dönen elmas: yatay ölçek ile 3B dönüş hissi
        ctx.scale(Math.cos(p.age * 6 + p.rot), 1);
        ctx.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `hsla(${p.hue},100%,72%,0.95)`;
        ctx.beginPath();
        ctx.moveTo(0, -p.s * 0.5); ctx.lineTo(p.s * 0.22, 0); ctx.lineTo(0, p.s * 0.5); ctx.lineTo(-p.s * 0.22, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      return true;
    });
    return this.items.length > 0 || this.rings.length > 0 || this.flash > 0 || (this.rainUntil && now < this.rainUntil);
  }
}
