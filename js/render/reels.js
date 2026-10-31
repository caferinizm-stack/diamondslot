// MAKARALAR — gerçek slot makinesi hissi: dikey dönüş, hızlanma (geri
// tepme), hareket bulanıklığı, sırayla duruş, yavaşlama + mekanik yaylanma.
//
// Her makara yalnız 5 hücre (görünür 3 + üst/alt tampon) kullanır; şerit
// konumu değiştikçe hücrelerin görseli değişir. Hareket yalnız CSS transform
// ile yapılır (GPU), kare başına DOM değişikliği en aza indirilir.

import CONFIG from '../config/gameConfig.js';
import { STRIPS } from '../engine/slotEngine.js';
import { symbolURL, spriteURL, SYMBOL_ANIM } from './symbols.js';

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

class Reel {
  constructor(index, strip, host) {
    this.index = index;
    this.strip = strip;
    this.L = strip.length;
    this.el = document.createElement('div');
    this.el.className = 'reel';
    this.track = document.createElement('div');
    this.track.className = 'reel-track';
    this.el.appendChild(this.track);
    this.cells = [];
    for (let k = -1; k <= CONFIG.ROWS; k++) {
      const c = document.createElement('div');
      c.className = 'cell';
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      c.appendChild(img);
      this.track.appendChild(c);
      this.cells.push({ k, el: c, img, src: '', sym: '' });
    }
    host.appendChild(this.el);

    this.top = Math.floor(Math.random() * this.L);   // üst satırdaki şerit indisi
    this.d = 0;            // gidilen yol (hücre)
    this.base = this.top;  // dönüş başındaki top
    this.phase = 'idle';   // idle | up | run | stop | bounce
    this.v = 0;
    this.blur = false;
    this.cellPx = 100;
    this._whole = null;     // son çizilen tam hücre (aynıysa hücreler yenilenmez)
    this._variant = null;
  }

  setSize(cellPx) {
    if (this.cellPx === cellPx) return;
    this.cellPx = cellPx;
    this.cells.forEach((c) => { c.el.style.transform = `translate3d(0, ${c.k * cellPx}px, 0)`; });
    this.render(true);
  }

  symAt(row) { return this.strip[((this.top + row) % this.L + this.L) % this.L]; }

  render(force = false) {
    const whole = Math.floor(this.d);
    const frac = this.d - whole;
    this.track.style.transform = `translate3d(0, ${(frac * this.cellPx).toFixed(2)}px, 0)`;
    // Hızlı yol: hücre konumu ve görünüm değişmediyse DOM'a hiç dokunma.
    const variant = this.blur ? 'blur' : 'normal';
    if (!force && whole === this._whole && variant === this._variant) return;
    this._whole = whole;
    this._variant = variant;
    const top = ((this.base - whole) % this.L + this.L) % this.L;
    this.top = top;
    for (const c of this.cells) {
      const sym = this.strip[((top + c.k) % this.L + this.L) % this.L];
      // Pişirilmiş bitmap hazırsa onu kullan (SVG'den kat kat hızlı).
      const src = spriteURL(sym, variant) ?? symbolURL(sym, variant);
      if (force || c.src !== src) {
        c.img.src = src;
        c.src = src;
        if (c.sym !== sym) {
          c.el.dataset.sym = sym;
          c.el.className = `cell sym-anim-${SYMBOL_ANIM[sym] ?? 'none'}`;
          c.sym = sym;
        }
      }
    }
  }

  /** Görünür hücre öğesi (satır 0..2). */
  cellEl(row) { return this.cells[row + 1].el; }
}

export class ReelSet {
  constructor(host, opts = {}) {
    this.host = host;
    this.reels = STRIPS.map((s, i) => new Reel(i, s, host));
    this.reduced = Boolean(opts.reducedMotion);
    this.onStop = opts.onStop ?? (() => {});
    this.raf = 0;
    this.spinning = false;
  }

  setSize(cellPx, gapPx) {
    this.host.style.setProperty('--cell', `${cellPx}px`);
    this.host.style.setProperty('--gap', `${gapPx}px`);
    this.reels.forEach((r) => r.setSize(cellPx));
  }

  /** Geçerli görünür tahta (grid[reel][row]). */
  grid() { return this.reels.map((r) => [0, 1, 2].map((row) => r.symAt(row))); }

  cell(reel, row) { return this.reels[reel].cellEl(row); }

  /** Tüm hücreleri yeniden çizer (sprite'lar hazır olduğunda çağrılır). */
  refresh() { this.reels.forEach((r) => r.render(true)); }

  /** Dönüşü başlat (sonuç henüz gelmemiş olabilir). */
  start() {
    const T = CONFIG.TIMING;
    const now = performance.now();
    this.spinning = true;
    this.stopPlan = null;
    this.done = 0;
    for (const r of this.reels) {
      r.base = r.top;
      r.d = 0;
      r.phase = 'up';
      r.t0 = now + r.index * 45;   // hafif kademeli kalkış
      r.v = 0;
      r.el.classList.remove('anticipate', 'landed');
    }
    this.vmax = T.maxSpeedCellsPerSec * (this.reduced ? 0.7 : 1);
    cancelAnimationFrame(this.raf);
    let last = now;
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this._step(t, dt);
      if (this.spinning) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /**
   * Sonucu bildir: makaralar sırayla `stops` konumunda durur.
   * @param {number[]} stops üst satır şerit indisleri
   * @param {{ anticipation?: number, startedAt: number, onReelStop?: Function, onAnticipate?: Function }} o
   */
  land(stops, o) {
    const T = CONFIG.TIMING;
    const k = this.reduced ? T.reducedMotionScale : 1;
    const begin = Math.max(performance.now(), o.startedAt + T.minSpinMs * k);
    const times = [];
    let extra = 0;
    for (let i = 0; i < this.reels.length; i++) {
      if (o.anticipation >= 0 && i > o.anticipation - 1 && i >= o.anticipation) extra += T.anticipationExtraMs * k;
      times.push(begin + i * T.reelStaggerMs * k + extra);
    }
    this.stopPlan = { stops, times, o };
  }

  _step(t, dt) {
    const T = CONFIG.TIMING;
    const plan = this.stopPlan;
    let anyMoving = false;
    for (const r of this.reels) {
      if (t < r.t0) { anyMoving = true; continue; }
      switch (r.phase) {
        case 'up': {
          // geri tepme: kısa süre yukarı, sonra hızlan
          const u = (t - r.t0) / T.spinUpMs;
          if (u < 0.4) r.d = -0.22 * Math.sin((u / 0.4) * Math.PI * 0.5);
          else {
            r.d = -0.22 + Math.pow((u - 0.4) / 0.6, 2) * 0.9;
            r.v = this.vmax * Math.min(1, (u - 0.4) / 0.6);
          }
          if (u >= 1) { r.phase = 'run'; r.v = this.vmax; }
          r.blur = u > 0.7;
          anyMoving = true;
          break;
        }
        case 'run': {
          r.d += r.v * dt;
          r.blur = true;
          if (plan && t >= plan.times[r.index]) this._beginStop(r, plan.stops[r.index], t);
          // gerilim: bu makara gerilim makarasıysa
          if (plan && plan.o.anticipation >= 0 && r.index >= plan.o.anticipation && !r.el.classList.contains('anticipate')) {
            const prevStopped = r.index === 0 || this.reels[r.index - 1].phase === 'idle' || this.reels[r.index - 1].phase === 'bounce';
            if (prevStopped) { r.el.classList.add('anticipate'); plan.o.onAnticipate?.(r.index); r.v = this.vmax * 1.25; }
          }
          anyMoving = true;
          break;
        }
        case 'stop': {
          const u = Math.min(1, (t - r.s0) / r.sDur);
          r.d = r.sFrom + (r.sTo - r.sFrom) * easeOutCubic(u);
          r.blur = u < 0.55;
          if (u >= 1) {
            r.d = r.sTo;
            r.phase = 'bounce';
            r.b0 = t;
            r.el.classList.remove('anticipate');
            r.el.classList.add('landed');
            plan.o.onReelStop?.(r.index);
          }
          anyMoving = true;
          break;
        }
        case 'bounce': {
          // mekanik yaylanma: hafif aşağı taşma, geri oturma
          const u = Math.min(1, (t - r.b0) / 200);
          r.d = r.sTo + Math.sin(u * Math.PI) * 0.09 * (1 - u * 0.4);
          r.blur = false;
          if (u >= 1) { r.d = r.sTo; r.phase = 'idle'; this.done += 1; }
          anyMoving = true;
          break;
        }
        default: break;
      }
      r.render();
    }
    if (this.done >= this.reels.length || !anyMoving) {
      this.spinning = false;
      for (const r of this.reels) { r.d = r.sTo ?? r.d; r.render(); }
      this.onStop(this.grid());
    }
  }

  _beginStop(r, stop, t) {
    const T = CONFIG.TIMING;
    const L = r.L;
    const want = this.reduced ? T.stopEaseMs * T.reducedMotionScale : T.stopEaseMs;
    // Yavaşlama yolu: ease-out'un ilk hızı makara hızına eşit olsun.
    const D = Math.ceil(r.d + (r.v * want) / 1000 / 3 + 0.6);
    // Şerit bağlantısı: tam hızda (bulanıkken) şerit, durma noktası `stop`
    // olacak şekilde yeniden hizalanır — göz fark etmez, sonuç birebir oturur.
    //   top = base − D (mod L) = stop  →  base = stop + D (mod L)
    const whole = Math.floor(r.d);
    const visibleTop = ((r.base - whole) % L + L) % L;
    r.base = ((stop + D) % L + L) % L;
    r.spliced = visibleTop !== ((r.base - whole) % L + L) % L;
    r.sFrom = r.d;
    r.sTo = D;
    r.s0 = t;
    r.sDur = Math.max(want * 0.8, ((3 * (D - r.d)) / r.v) * 1000);
    r.phase = 'stop';
  }

  /** Sonuç gelmeden hata olursa makaraları eski yerlerinde durdur. */
  abort(startedAt) {
    this.land(this.reels.map((r) => r.base), { anticipation: -1, startedAt });
  }
}
