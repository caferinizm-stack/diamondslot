// Oyun kaynakları: DEMO (tarayıcı) ve CANLI (sunucu, gerçek kristal).
//
// İki motor aynı arayüzü sunar:
//   mode: 'demo' | 'live'
//   connect()  → { balance, history, stats }
//   refresh()  → { balance, history, stats }
//   spin(bet)  → SpinResult (+ balance)
//
// SpinResult biçimi (slotEngine.spin ile aynı):
//   { id, bet, stops, grid, wins[{line,symbol,count,multiplier,amount,cells}],
//     lineTotal, bonus{count,cells,reward{id,mult,amount}}|null, totalWin,
//     tier, anticipation, balance }

import CONFIG from '../config/gameConfig.js';
import { spin as engineSpin, gridFromStops, evaluateGrid, winTier, STRIPS } from './slotEngine.js';
import { cryptoRandom } from './rng.js';
import { CreditManager } from './creditManager.js';
import { LocalHistory, emptyStats } from './stats.js';

function newId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// ─── DEMO ──────────────────────────────────────────────────────────────────
export class DemoEngine {
  constructor({ rng = cryptoRandom(), storage = safeStorage() } = {}) {
    this.mode = 'demo';
    this.rng = rng;
    this.wallet = new CreditManager({ storage });
    this.history = new LocalHistory(storage);
  }

  snapshot() {
    return { balance: this.wallet.balance, history: this.history.items, stats: this.history.stats };
  }

  async connect() { return this.snapshot(); }
  async refresh() { return this.snapshot(); }

  async spin(bet) {
    const id = newId();
    this.wallet.validateBet(bet);
    const result = engineSpin(this.rng, bet);   // sonuç ÖNCE belirlenir
    this.wallet.debit(id, bet);
    this.wallet.credit(id, result.totalWin);
    this.history.record(result);
    return { ...result, id, balance: this.wallet.balance };
  }

  refill() { return this.wallet.refill(); }
}

// ─── CANLI (gerçek kristal) ─────────────────────────────────────────────────
export const LIVE_ERRORS = {
  AUTH_REQUIRED: 'Oturum bulunamadı. Oyunu uygulamadan aç.',
  PROFILE_MISSING: 'Bu hesabın oyun profili yok.',
  BALANCE: 'Kristal bakiyen bu bahis için yetersiz.',
  BAD_BET: 'Geçersiz bahis miktarı.',
  TOO_FAST: 'Çok hızlı çevirdin, bir an bekle.',
  GAME_CLOSED: 'Diamond Slot şu an kapalı.',
};

export function translateLiveError(error) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`;
  for (const [code, msg] of Object.entries(LIVE_ERRORS)) if (text.includes(code)) return msg;
  if (text.includes('Could not find the function')) return 'Sunucu fonksiyonları eksik (FAZ 88 çalıştırılmalı).';
  if (/failed to fetch|network|load failed|timeout|aborted/i.test(text)) return 'Bağlantı sorunu. Tekrar dene.';
  return 'Sunucuya ulaşılamadı. Tekrar dene.';
}

/** Sunucunun döndürdüğü çevirmeyi istemci biçimine çevirir (sunucu esastır). */
export function resultFromServer(spin, balance) {
  const bet = Number(spin.bet);
  const stops = (spin.stops ?? []).map(Number);
  if (stops.length !== CONFIG.REELS) throw new Error('BAD_SERVER_RESULT');
  const grid = gridFromStops(stops, STRIPS, CONFIG.ROWS);
  const wins = (spin.wins ?? []).map((w) => {
    const line = CONFIG.PAYLINES[Number(w.line)];
    const count = Number(w.count);
    return {
      line: Number(w.line),
      symbol: String(w.symbol),
      count,
      multiplier: Number(w.multiplier),
      amount: Number(w.amount),
      cells: line.slice(0, count).map((row, reel) => [reel, row]),
    };
  });
  const bonusCells = [];
  grid.forEach((col, r) => col.forEach((s, row) => { if (s === CONFIG.BONUS_ID) bonusCells.push([r, row]); }));
  const bonus = spin.bonus
    ? { count: Number(spin.bonus.count), cells: bonusCells, reward: { id: String(spin.bonus.id), mult: Number(spin.bonus.mult), amount: Number(spin.bonus.amount) } }
    : null;
  const totalWin = Number(spin.total_win);

  // Gerilim makaraları (görsel): ilk makaralarda 2 BONUS.
  let anticipation = -1;
  let seen = 0;
  for (let r = 0; r < CONFIG.REELS - 1; r++) {
    seen += grid[r].filter((s) => s === CONFIG.BONUS_ID).length;
    if (seen >= CONFIG.BONUS_TRIGGER - 1) { anticipation = r + 1; break; }
  }

  // Tutarlılık denetimi: istemci kuralları sunucuyla aynı mı? (yalnız uyarı)
  const local = evaluateGrid(grid, bet);
  if (local.lineTotal !== Number(spin.line_total)) {
    console.warn('[diamond] istemci/sunucu kural farkı', local.lineTotal, spin.line_total);
  }

  return {
    id: String(spin.id ?? ''), bet, stops, grid, wins,
    lineTotal: Number(spin.line_total), bonus, totalWin,
    tier: winTier(totalWin, bet), anticipation, balance: Number(balance),
  };
}

function normState(data) {
  const st = data?.stats ?? {};
  return {
    balance: Number(data?.balance ?? 0),
    user: data?.user ? { name: String(data.user.name ?? ''), avatar: String(data.user.avatar ?? '') } : null,
    open: data?.open !== false,
    history: (data?.history ?? []).map((h) => ({
      at: h.at, bet: Number(h.bet), payout: Number(h.payout), win: Number(h.payout) > 0,
      symbol: h.symbol ?? null, count: Number(h.count ?? 0), lines: Number(h.lines ?? 0),
    })),
    stats: {
      ...emptyStats(),
      rounds: Number(st.rounds ?? 0), totalWon: Number(st.total_won ?? 0),
      maxWin: Number(st.max_win ?? 0), lastAt: st.last_at ?? null,
      symbolCounts: st.symbol_counts ?? {},
    },
  };
}

export class LiveEngine {
  /** @param {any} client supabase-js istemcisi (oturumu açılmış) */
  constructor(client) {
    this.mode = 'live';
    this.client = client;
    this.pending = null;
  }

  async _rpc(fn, args) {
    let { data, error } = await this.client.rpc(fn, args);
    if (error && /jwt|token|401|pgrst30/i.test(`${error.message} ${error.code}`)) {
      try { await this.client.auth.refreshSession(); } catch { /* yoksay */ }
      ({ data, error } = await this.client.rpc(fn, args));
    }
    if (error) { const e = new Error(translateLiveError(error)); e.raw = error; throw e; }
    return data;
  }

  async connect() { return this.refresh(); }

  async refresh() { return normState(await this._rpc('diamond_state', {})); }

  async spin(bet) {
    if (this.pending) throw new Error(LIVE_ERRORS.TOO_FAST);
    const id = newId();   // sunucuda tekrar işlemeyi engeller
    this.pending = this._rpc('diamond_spin', { p_bet: bet, p_client: id });
    try {
      const data = await this.pending;
      return resultFromServer(data.spin, data.balance);
    } finally {
      this.pending = null;
    }
  }
}

// ─── Oturum (uygulama WebView'i adresin # kısmına ekler) ────────────────────
export function readInjectedSession(loc = globalThis.location) {
  for (const raw of [loc?.hash?.slice(1) ?? '', loc?.search?.slice(1) ?? '']) {
    if (!raw) continue;
    const p = new URLSearchParams(raw);
    const access = p.get('access_token');
    const refresh = p.get('refresh_token');
    if (access && refresh) return { access_token: access, refresh_token: refresh };
  }
  return null;
}

export function clearTokensFromUrl() {
  try {
    const url = new URL(location.href);
    if (url.hash.includes('access_token')) {
      const p = new URLSearchParams(url.hash.slice(1));
      p.delete('access_token'); p.delete('refresh_token');
      url.hash = p.toString();
      history.replaceState(null, '', url.toString());
    }
  } catch { /* yoksay */ }
}
