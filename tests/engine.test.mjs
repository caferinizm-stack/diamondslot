// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../js/config/gameConfig.js';
import {
  spin, buildStrips, STRIPS, gridFromStops, evaluateLine, evaluateGrid, winTier, winningCells, assertValidBet,
} from '../js/engine/slotEngine.js';
import { seededRandom, sequenceRandom, weightedPick } from '../js/engine/rng.js';
import { drawBonusReward } from '../js/engine/bonus.js';
import { CreditManager } from '../js/engine/creditManager.js';
import { StateMachine, SpinLock, STATES } from '../js/game/stateMachine.js';
import { DemoEngine, resultFromServer } from '../js/engine/engines.js';
import { LocalHistory, topSymbol } from '../js/engine/stats.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

// ── Slot motoru ──────────────────────────────────────────────────────────
test('motor: 5×3 tahta, aynı tohum → aynı sonuç', () => {
  const a = spin(seededRandom(42), 1000);
  const b = spin(seededRandom(42), 1000);
  assert.equal(a.grid.length, 5);
  for (const col of a.grid) assert.equal(col.length, 3);
  assert.deepEqual(a, b);
});

test('motor: şeritler sabit ve ağırlıklarla uyumlu', () => {
  assert.deepEqual(buildStrips(), STRIPS);
  STRIPS.forEach((strip, r) => {
    for (const s of CONFIG.SYMBOLS) {
      assert.equal(strip.filter((x) => x === s.id).length, s.weights[r], `${s.id} makara ${r}`);
    }
  });
  assert.equal(STRIPS[0].includes('wild'), false);
  assert.equal(STRIPS[4].includes('wild'), false);
});

test('motor: geçersiz bahis reddedilir', () => {
  for (const bad of [0, -100, 99, 100.5, NaN, '100', null]) {
    assert.throws(() => spin(seededRandom(1), bad), /INVALID_BET/);
  }
  assert.doesNotThrow(() => assertValidBet(100));
});

// ── Sembol oluşturma ─────────────────────────────────────────────────────
test('semboller: 10 sembol, hepsi şeritte, kimlikler tekil', () => {
  const ids = CONFIG.SYMBOLS.map((s) => s.id);
  assert.deepEqual(ids, ['blue', 'purple', 'gold', 'ruby', 'emerald', 'crown', 'star', 'mystery', 'wild', 'bonus']);
  assert.equal(new Set(ids).size, ids.length);
  const seen = new Set(STRIPS.flat());
  for (const id of ids) assert.ok(seen.has(id), id);
});

// ── Kombinasyon hesaplama ────────────────────────────────────────────────
test('çizgi: soldan 3/4/5 eşleşme ödenir, kopuk dizi ödenmez', () => {
  assert.deepEqual(evaluateLine(['ruby', 'ruby', 'ruby', 'star', 'ruby']), { symbol: 'ruby', count: 3, pay: 25 });
  assert.deepEqual(evaluateLine(['blue', 'blue', 'blue', 'blue', 'blue']), { symbol: 'blue', count: 5, pay: 2000 });
  assert.equal(evaluateLine(['ruby', 'star', 'ruby', 'ruby', 'ruby']), null);
  assert.equal(evaluateLine(['star', 'ruby', 'ruby', 'ruby', 'ruby']), null);
});

test('çizgi: WILD yerine geçer, BONUS yerine geçmez', () => {
  assert.deepEqual(evaluateLine(['gold', 'wild', 'gold', 'wild', 'star']), { symbol: 'gold', count: 4, pay: 150 });
  assert.deepEqual(evaluateLine(['wild', 'wild', 'wild', 'crown', 'star']), { symbol: 'wild', count: 3, pay: 80 });
  // wild+wild+wild+blue+blue: blue×5 (2000) > wild×3 (80)
  assert.deepEqual(evaluateLine(['wild', 'wild', 'wild', 'blue', 'blue']), { symbol: 'blue', count: 5, pay: 2000 });
  assert.equal(evaluateLine(['bonus', 'wild', 'wild', 'ruby', 'ruby']), null);
  assert.deepEqual(evaluateLine(['ruby', 'wild', 'bonus', 'ruby', 'ruby']), null);
});

test('tahta: ödeme = bahis × çarpan / 20, hücreler doğru', () => {
  const grid = [
    ['star', 'ruby', 'crown'], ['star', 'ruby', 'crown'], ['star', 'ruby', 'mystery'],
    ['emerald', 'gold', 'purple'], ['bonus', 'gold', 'emerald'],
  ];
  const { wins, lineTotal } = evaluateGrid(grid, 1000);
  const mid = wins.find((w) => w.line === 0);
  assert.equal(mid.symbol, 'ruby');
  assert.equal(mid.amount, 1000 * 25 / 20);
  assert.deepEqual(mid.cells, [[0, 1], [1, 1], [2, 1]]);
  assert.equal(lineTotal, wins.reduce((s, w) => s + w.amount, 0));
});

test('kazanç sınıfı', () => {
  assert.equal(winTier(0, 100), 'none');
  assert.equal(winTier(500, 100), 'small');
  assert.equal(winTier(1500, 100), 'big');
  assert.equal(winTier(5000, 100), 'mega');
});

// ── Bonus tetikleme ──────────────────────────────────────────────────────
test('bonus: 3+ BONUS sembolü bonus açar, ödül bahse göre', () => {
  // BONUS sembolünü 0,1,2. makaranın üst satırına getiren durma konumları.
  const stops = STRIPS.map((s) => s.indexOf('bonus'));
  const grid = gridFromStops(stops);
  assert.equal(grid[0][0], 'bonus');
  const n = stops.length;
  const rng = sequenceRandom([...stops.map((st, r) => (st + 0.5) / STRIPS[r].length), 0.01]);
  const r = spin(rng, 1000);
  assert.deepEqual(r.stops, stops);
  assert.ok(r.bonus, 'bonus açılmalı');
  assert.ok(r.bonus.count >= 3 && r.bonus.count <= n);
  assert.equal(r.bonus.reward.amount, 1000 * r.bonus.reward.mult);
  assert.equal(r.totalWin, Math.min(r.lineTotal + r.bonus.reward.amount, 1000 * CONFIG.MAX_WIN_X));
  assert.ok(r.anticipation >= 1);
});

test('bonus: 2 BONUS açmaz; sayı arttıkça ödül artar', () => {
  const rw3 = drawBonusReward(sequenceRandom([0]), 100, 3);
  const rw5 = drawBonusReward(sequenceRandom([0]), 100, 5);
  assert.equal(rw5.mult, rw3.mult * 4);
  let opened = 0;
  const rng = seededRandom(9);
  for (let i = 0; i < 20000; i++) {
    const r = spin(rng, 100);
    const c = r.grid.flat().filter((s) => s === 'bonus').length;
    assert.equal(Boolean(r.bonus), c >= 3);
    if (r.bonus) opened++;
  }
  assert.ok(opened > 100);
});

test('ağırlıklı seçim sınırları', () => {
  const items = [{ weight: 1, id: 'a' }, { weight: 3, id: 'b' }];
  assert.equal(weightedPick(sequenceRandom([0]), items).id, 'a');
  assert.equal(weightedPick(sequenceRandom([0.999]), items).id, 'b');
});

test('RTP %93-%97 aralığında (200 bin tur)', () => {
  const rng = seededRandom(123);
  let paid = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) paid += spin(rng, 1000).totalWin;
  const rtp = paid / (N * 1000);
  assert.ok(rtp > 0.93 && rtp < 0.97, `RTP ${rtp}`);
});

// ── Demo kredi yönetimi ──────────────────────────────────────────────────
test('demo kredi: düş/ekle, negatif yok, geçersiz bahis yok', () => {
  const w = new CreditManager({ storage: memStore(), start: 1000 });
  assert.throws(() => w.debit('a', 2500), /BAD_BET|BALANCE/);
  assert.throws(() => w.debit('a', 123), /BAD_BET/);
  w.debit('s1', 500);
  assert.equal(w.balance, 500);
  w.credit('s1', 0);
  w.debit('s2', 500);
  assert.equal(w.balance, 0);
  assert.throws(() => w.debit('s3', 100), /BALANCE/);
  assert.ok(w.balance >= 0);
  assert.throws(() => w.credit('s9', 10), /UNKNOWN_SPIN/);
  assert.throws(() => w.credit('s2', -5), /BAD_AMOUNT/);
  assert.equal(w.refill(), true);
  assert.equal(w.balance, 1000);
});

test('demo kredi: kayıttan geri yüklenir, bozuk kayıt yok sayılır', () => {
  const st = memStore();
  const a = new CreditManager({ storage: st, start: 1000 });
  a.debit('x', 250);
  assert.equal(new CreditManager({ storage: st, start: 1000 }).balance, 750);
  st.setItem(a.key, '-50');
  assert.equal(new CreditManager({ storage: st, start: 1000 }).balance, 1000);
});

// ── Tekrar engelleme ─────────────────────────────────────────────────────
test('tekrar engelleme: aynı spinId iki kez işlenmez, kilit tek geçiş verir', () => {
  const w = new CreditManager({ storage: memStore(), start: 10000 });
  w.debit('same', 100);
  assert.throws(() => w.debit('same', 100), /DUPLICATE/);
  w.credit('same', 50);
  assert.throws(() => w.credit('same', 50), /DUPLICATE/);
  assert.equal(w.balance, 9950);

  const lock = new SpinLock();
  const results = Array.from({ length: 10 }, () => lock.tryStart());
  assert.equal(results.filter(Boolean).length, 1);
  lock.release();
  assert.equal(lock.tryStart(), true);
});

test('demo motor: bakiye = önce − bahis + kazanç; geçmiş 10 kayıt', async () => {
  const eng = new DemoEngine({ rng: seededRandom(5), storage: memStore() });
  let { balance } = await eng.connect();
  for (let i = 0; i < 14; i++) {
    const r = await eng.spin(500);
    assert.equal(r.balance, balance - 500 + r.totalWin);
    balance = r.balance;
  }
  const s = await eng.refresh();
  assert.equal(s.history.length, 10);
  assert.equal(s.stats.rounds, 14);
  assert.ok(topSymbol(s.stats.symbolCounts));
});

// ── Animasyon durum geçişleri ────────────────────────────────────────────
test('durum makinesi: geçerli akışlar ve geçersiz geçişler', () => {
  const seen = [];
  const sm = new StateMachine((n) => seen.push(n));
  sm.go(STATES.REQUESTING);
  assert.throws(() => sm.go(STATES.REQUESTING), /BAD_TRANSITION/);   // çift spin
  sm.go(STATES.SPINNING);
  assert.throws(() => sm.go(STATES.IDLE), /BAD_TRANSITION/);         // dönerken bitemez
  sm.go(STATES.PRESENTING);
  sm.go(STATES.BONUS);
  sm.go(STATES.CELEBRATING);
  sm.go(STATES.IDLE);
  assert.deepEqual(seen, ['requesting', 'spinning', 'presenting', 'bonus', 'celebrating', 'idle']);
  sm.go(STATES.REQUESTING);
  sm.go(STATES.IDLE);              // sunucu hatası → geri dön
  assert.equal(sm.busy, false);
});

// ── Sunucu sonucu dönüşümü ───────────────────────────────────────────────
test('sunucu sonucu: hücreler ve bonus istemcide yeniden kurulur', () => {
  const local = spin(seededRandom(77), 1000);
  const server = {
    id: 'x', bet: 1000, stops: local.stops, line_total: local.lineTotal, total_win: local.totalWin,
    wins: local.wins.map(({ cells, ...w }) => w),
    bonus: local.bonus ? { count: local.bonus.count, ...local.bonus.reward } : null,
  };
  const r = resultFromServer(server, 12345);
  assert.deepEqual(r.grid, local.grid);
  assert.deepEqual(r.wins, local.wins);
  assert.equal(r.balance, 12345);
  assert.deepEqual(winningCells(r), winningCells(local));
});

test('geçmiş: kayıt biçimi', () => {
  const h = new LocalHistory(memStore());
  const r = spin(seededRandom(3), 100);
  const e = h.record(r, new Date('2026-10-31T10:00:00Z'));
  assert.equal(e.bet, 100);
  assert.equal(e.payout, r.totalWin);
  assert.equal(e.win, r.totalWin > 0);
  assert.equal(e.at, '2026-10-31T10:00:00.000Z');
});
