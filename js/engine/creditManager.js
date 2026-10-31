// DEMO KREDİ CÜZDANI (yalnız `?demo=1`)
//
// Oyun motorundan ayrıdır: motor sonucu üretir, cüzdan bahsi düşer / kazancı
// ekler. Gerçek kristal ile oynarken bu sınıf KULLANILMAZ; bakiye sunucudadır.
//
// Kurallar:
//   * Bahis tamsayı, pozitif ve izinli seviyelerden biri olmalı.
//   * Bakiye asla negatife düşmez.
//   * Aynı çevirme kimliği (spinId) iki kez işlenmez.

import CONFIG from '../config/gameConfig.js';

export class CreditError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export class CreditManager {
  /**
   * @param {{ storage?: Storage|null, key?: string, start?: number, betLevels?: number[] }} opts
   */
  constructor(opts = {}) {
    this.storage = opts.storage ?? null;
    this.key = opts.key ?? `${CONFIG.STORAGE.prefix}demo-balance`;
    this.start = opts.start ?? CONFIG.CREDITS.demoStart;
    this.betLevels = opts.betLevels ?? CONFIG.CREDITS.betLevels;
    this.done = new Set();
    this.balance = this.start;
    try {
      const raw = this.storage?.getItem(this.key);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isSafeInteger(n) && n >= 0) this.balance = n;
    } catch { /* kayıt yoksa başlangıç bakiyesi */ }
  }

  validateBet(bet) {
    if (!Number.isInteger(bet) || bet <= 0 || !this.betLevels.includes(bet)) {
      throw new CreditError('BAD_BET');
    }
    if (bet > this.balance) throw new CreditError('BALANCE');
  }

  canAfford(bet) {
    try { this.validateBet(bet); return true; } catch { return false; }
  }

  /** Bahsi düşer. Aynı spinId ikinci kez gelirse hata. */
  debit(spinId, bet) {
    if (!spinId || this.done.has(`d:${spinId}`)) throw new CreditError('DUPLICATE');
    this.validateBet(bet);
    this.done.add(`d:${spinId}`);
    this.balance -= bet;
    this._save();
    return this.balance;
  }

  /** Kazancı ekler (yalnız düşülmüş bir çevirme için, bir kez). */
  credit(spinId, amount) {
    if (!this.done.has(`d:${spinId}`)) throw new CreditError('UNKNOWN_SPIN');
    if (this.done.has(`c:${spinId}`)) throw new CreditError('DUPLICATE');
    if (!Number.isSafeInteger(amount) || amount < 0) throw new CreditError('BAD_AMOUNT');
    this.done.add(`c:${spinId}`);
    this.balance += amount;
    this._save();
    return this.balance;
  }

  /** Demo kredi bittiğinde başlangıç tutarına yeniler. */
  refill() {
    if (this.balance >= Math.min(...this.betLevels)) return false;
    this.balance = this.start;
    this._save();
    return true;
  }

  _save() {
    try { this.storage?.setItem(this.key, String(this.balance)); } catch { /* yoksay */ }
  }
}
