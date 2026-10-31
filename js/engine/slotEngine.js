// DIAMOND SLOT — OYUN MOTORU (saf mantık, DOM / ses / animasyon yok)
//
// * Sonuç, animasyon BAŞLAMADAN önce bu motor tarafından belirlenir.
//   Makaralar yalnız bu sonuca doğru döner; animasyon sonucu değiştiremez.
// * Kredi yönetimi burada yoktur (creditManager.js) — motor yalnız
//   "bu bahisle bu tahta çıktı, şu kadar kazandırır" der.
// * Rastgelelik dışarıdan verilir (rng.js), testlerde tohumlanabilir.

import CONFIG from '../config/gameConfig.js';
import { randInt, seededRandom } from './rng.js';
import { drawBonusReward } from './bonus.js';

const SYMBOL_BY_ID = new Map(CONFIG.SYMBOLS.map((s) => [s.id, s]));

export function symbolById(id) {
  return SYMBOL_BY_ID.get(id) ?? null;
}

/**
 * Makara şeritleri: her makarada sembol ağırlıkları kadar kopya, sabit
 * tohumla karıştırılır (her açılışta aynı şerit = gerçek makine gibi).
 * Aynı sembolün art arda gelmesi mümkün olduğunca dağıtılır.
 */
export function buildStrips(config = CONFIG, seed = 20261031) {
  const rng = seededRandom(seed);
  const strips = [];
  for (let r = 0; r < config.REELS; r++) {
    const pool = [];
    for (const s of config.SYMBOLS) {
      for (let k = 0; k < (s.weights[r] ?? 0); k++) pool.push(s.id);
    }
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Komşu tekrarlarını azalt (aynı iki sembol yan yana gelmesin).
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < pool.length; i++) {
        const next = (i + 1) % pool.length;
        if (pool[i] === pool[next]) {
          const k = (next + 2 + randInt(rng, pool.length - 3)) % pool.length;
          [pool[next], pool[k]] = [pool[k], pool[next]];
        }
      }
    }
    strips.push(pool);
  }
  return strips;
}

export const STRIPS = buildStrips();

/** Durma konumlarından 5×3 tahta: grid[reel][row]. */
export function gridFromStops(stops, strips = STRIPS, rows = CONFIG.ROWS) {
  return stops.map((stop, r) => {
    const strip = strips[r];
    const col = [];
    for (let row = 0; row < rows; row++) col.push(strip[(stop + row) % strip.length]);
    return col;
  });
}

/**
 * Tek çizgiyi değerlendirir. Soldan sağa ardışık eşleşme; WILD, BONUS
 * dışındaki her sembolün yerine geçer. Yalnız WILD'lardan oluşan baş kısım
 * WILD olarak da ödenir; ikisinden yüksek olan seçilir.
 */
export function evaluateLine(symbols, config = CONFIG) {
  const wild = config.WILD_ID;
  const bonus = config.BONUS_ID;
  if (symbols[0] === bonus) return null;

  // Ana sembol: ilk WILD olmayan.
  let base = null;
  for (const s of symbols) {
    if (s === bonus) break;
    if (s !== wild) { base = s; break; }
  }

  const runOf = (target) => {
    let n = 0;
    for (const s of symbols) {
      if (s === target || (s === wild && target !== bonus)) n++;
      else break;
    }
    return n;
  };
  let wildRun = 0;
  for (const s of symbols) { if (s === wild) wildRun++; else break; }

  const pay = (id, n) => (n >= 3 ? (symbolById(id)?.pays?.[n] ?? 0) : 0);

  const options = [];
  if (base) {
    const n = runOf(base);
    options.push({ symbol: base, count: n, pay: pay(base, n) });
  }
  if (wildRun >= 3) options.push({ symbol: wild, count: wildRun, pay: pay(wild, wildRun) });

  const best = options.filter((o) => o.pay > 0).sort((a, b) => b.pay - a.pay)[0];
  return best ?? null;
}

/** Tahtadaki bütün ödemeleri hesaplar. */
export function evaluateGrid(grid, bet, config = CONFIG) {
  const wins = [];
  config.PAYLINES.forEach((line, index) => {
    const symbols = line.map((row, reel) => grid[reel][row]);
    const res = evaluateLine(symbols, config);
    if (!res) return;
    const cells = line.slice(0, res.count).map((row, reel) => [reel, row]);
    wins.push({
      line: index,
      symbol: res.symbol,
      count: res.count,
      multiplier: res.pay,
      amount: Math.round((bet * res.pay) / config.PAYLINES.length),
      cells,
    });
  });

  const bonusCells = [];
  grid.forEach((col, reel) => col.forEach((s, row) => {
    if (s === config.BONUS_ID) bonusCells.push([reel, row]);
  }));

  const lineTotal = wins.reduce((s, w) => s + w.amount, 0);
  return { wins, lineTotal, bonusCells };
}

/** Kazanç sınıfı: none | small | big | mega */
export function winTier(amount, bet, config = CONFIG) {
  if (amount <= 0) return 'none';
  const x = amount / bet;
  if (x >= config.WIN_TIERS.mega) return 'mega';
  if (x >= config.WIN_TIERS.big) return 'big';
  return 'small';
}

/** Bahis değerini doğrular (geçersizse hata). */
export function assertValidBet(bet, config = CONFIG) {
  if (!Number.isInteger(bet) || bet <= 0 || !config.CREDITS.betLevels.includes(bet)) {
    throw new Error('INVALID_BET');
  }
}

/**
 * Bir çevirme sonucunu üretir. Saf fonksiyon: aynı rng → aynı sonuç.
 *
 * @returns {{
 *   bet:number, stops:number[], grid:string[][], wins:object[],
 *   lineTotal:number, bonus:null|{count:number,cells:number[][],reward:object},
 *   totalWin:number, tier:string, anticipation:number
 * }}
 */
export function spin(rng, bet, config = CONFIG, strips = STRIPS) {
  assertValidBet(bet, config);
  const stops = strips.map((strip) => randInt(rng, strip.length));
  const grid = gridFromStops(stops, strips, config.ROWS);
  const { wins, lineTotal, bonusCells } = evaluateGrid(grid, bet, config);

  let bonus = null;
  if (bonusCells.length >= config.BONUS_TRIGGER) {
    const reward = drawBonusReward(rng, bet, bonusCells.length, config);
    bonus = { count: bonusCells.length, cells: bonusCells, reward };
  }
  const totalWin = Math.min(lineTotal + (bonus ? bonus.reward.amount : 0), bet * config.MAX_WIN_X);

  // Gerilim: ilk makaralarda 2 BONUS görüldüyse, sonrakiler daha uzun döner.
  let anticipation = -1;
  let seen = 0;
  for (let r = 0; r < config.REELS - 1; r++) {
    seen += grid[r].filter((s) => s === config.BONUS_ID).length;
    if (seen >= config.BONUS_TRIGGER - 1) { anticipation = r + 1; break; }
  }

  return {
    bet, stops, grid, wins, lineTotal, bonus, totalWin,
    tier: winTier(totalWin, bet, config),
    anticipation,
  };
}

/** Kazanan bütün hücreler (tekrarsız) — vurgulama için. */
export function winningCells(result) {
  const set = new Set();
  for (const w of result.wins) for (const [r, row] of w.cells) set.add(`${r}:${row}`);
  if (result.bonus) for (const [r, row] of result.bonus.cells) set.add(`${r}:${row}`);
  return [...set].map((k) => k.split(':').map(Number));
}
