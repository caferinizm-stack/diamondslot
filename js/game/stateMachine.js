// Oyun / animasyon durum makinesi.
//
//   idle ──spin──▶ requesting ──result──▶ spinning ──stopped──▶ presenting
//     ▲               │ error                                     │
//     └───────────────┘                    ┌──────── bonus ◀──────┤
//     ▲                                    ▼                      │
//     └─────────────── done ◀──────── (celebrating) ◀─────────────┘
//
// Geçersiz geçiş hata fırlatır; böylece aynı çevirme iki kez başlatılamaz,
// animasyon sürerken yeni çevirme başlamaz.

export const STATES = Object.freeze({
  IDLE: 'idle',
  REQUESTING: 'requesting',   // sonuç motordan / sunucudan bekleniyor
  SPINNING: 'spinning',       // makaralar dönüyor (sonuç belli)
  PRESENTING: 'presenting',   // kazanan çizgiler gösteriliyor
  CELEBRATING: 'celebrating', // DIAMOND WIN ekranı
  BONUS: 'bonus',             // kristal sandık ekranı
});

const T = STATES;
export const TRANSITIONS = Object.freeze({
  [T.IDLE]: [T.REQUESTING],
  [T.REQUESTING]: [T.SPINNING, T.IDLE],
  [T.SPINNING]: [T.PRESENTING],
  [T.PRESENTING]: [T.BONUS, T.CELEBRATING, T.IDLE],
  [T.BONUS]: [T.CELEBRATING, T.PRESENTING, T.IDLE],
  [T.CELEBRATING]: [T.IDLE],
});

export class StateMachine {
  constructor(onChange = () => {}) {
    this.state = T.IDLE;
    this.onChange = onChange;
    this.log = [];
  }

  can(next) { return (TRANSITIONS[this.state] ?? []).includes(next); }

  go(next) {
    if (!this.can(next)) throw new Error(`BAD_TRANSITION ${this.state}→${next}`);
    const prev = this.state;
    this.state = next;
    this.log.push(`${prev}>${next}`);
    if (this.log.length > 50) this.log.shift();
    this.onChange(next, prev);
  }

  get busy() { return this.state !== T.IDLE; }
}

/**
 * Çevirme kilidi: hızlı çift tıklamada yalnız ilk istek geçer.
 * `tryStart()` true dönerse çağıran çevirmeyi başlatır, bitince `release()`.
 */
export class SpinLock {
  constructor() { this.locked = false; this.count = 0; }
  tryStart() {
    if (this.locked) return false;
    this.locked = true;
    this.count += 1;
    return true;
  }
  release() { this.locked = false; }
}
