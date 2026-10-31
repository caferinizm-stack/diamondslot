// Oyun geçmişi (son 10) ve istatistikler — yalnız gerçek sonuçlardan hesaplanır.
// Gerçek kristal modunda bu veriler sunucudan (`diamond_state`) gelir; demo
// modunda tarayıcıda tutulur. İki kaynak da aynı biçimi kullanır.

import CONFIG from '../config/gameConfig.js';

export function emptyStats() {
  return { rounds: 0, totalWon: 0, maxWin: 0, lastAt: null, symbolCounts: {} };
}

/** En çok çıkan sembol (eşitlikte sembol listesindeki sıra). */
export function topSymbol(symbolCounts) {
  let best = null;
  let bestN = 0;
  for (const s of CONFIG.SYMBOLS) {
    const n = symbolCounts?.[s.id] ?? 0;
    if (n > bestN) { best = s.id; bestN = n; }
  }
  return best;
}

/** Bir sonucu geçmiş kaydına çevirir. */
export function historyEntry(result, at = new Date()) {
  const best = [...(result.wins ?? [])].sort((a, b) => b.amount - a.amount)[0];
  return {
    at: at.toISOString(),
    bet: result.bet,
    payout: result.totalWin,
    win: result.totalWin > 0,
    symbol: result.bonus ? CONFIG.BONUS_ID : best?.symbol ?? null,
    count: result.bonus ? result.bonus.count : best?.count ?? 0,
    lines: (result.wins ?? []).length,
  };
}

export class LocalHistory {
  constructor(storage = null, key = `${CONFIG.STORAGE.prefix}demo-history`) {
    this.storage = storage;
    this.key = key;
    this.items = [];
    this.stats = emptyStats();
    try {
      const raw = storage?.getItem(key);
      const data = raw ? JSON.parse(raw) : null;
      if (data && Array.isArray(data.items)) this.items = data.items.slice(0, CONFIG.STORAGE.historySize);
      if (data?.stats) this.stats = { ...emptyStats(), ...data.stats };
    } catch { /* boş başla */ }
  }

  record(result, at = new Date()) {
    const entry = historyEntry(result, at);
    this.items.unshift(entry);
    this.items = this.items.slice(0, CONFIG.STORAGE.historySize);
    const st = this.stats;
    st.rounds += 1;
    st.totalWon += result.totalWin;
    st.maxWin = Math.max(st.maxWin, result.totalWin);
    st.lastAt = entry.at;
    for (const col of result.grid) for (const s of col) st.symbolCounts[s] = (st.symbolCounts[s] ?? 0) + 1;
    try { this.storage?.setItem(this.key, JSON.stringify({ items: this.items, stats: st })); } catch { /* yoksay */ }
    return entry;
  }
}
