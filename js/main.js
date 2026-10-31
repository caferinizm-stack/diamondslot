// DIAMOND SLOT — giriş noktası: motor + kasa + makaralar + efektler + ses +
// arayüz bağlantıları. Oyun sonucu motordan / sunucudan gelir; bu dosya yalnız
// akışı yönetir ve sonucu canlandırır.

import CONFIG from './config/gameConfig.js';
import { winningCells, symbolById } from './engine/slotEngine.js';
import { seededRandom } from './engine/rng.js';
import { DemoEngine, LiveEngine, readInjectedSession, clearTokensFromUrl, translateLiveError } from './engine/engines.js';
import { topSymbol } from './engine/stats.js';
import { StateMachine, SpinLock, STATES } from './game/stateMachine.js';
import { symbolURL, symbolSVG, preloadSymbols, SYMBOL_GLOW } from './render/symbols.js';
import { computeLayout, cabinetSVG, logoSVG } from './render/cabinet.js';
import { ReelSet } from './render/reels.js';
import { BackgroundFX, BurstFX, detectIntensity } from './render/fx.js';
import { SoundEngine } from './audio/sound.js';
import { createHost } from './host/gameHostAdapter.js';

const SUPABASE = {
  url: 'https://mwjyppehzqobmcrsmxlj.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13anlwcGVoenFvYm1jcnNteGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODYxOTksImV4cCI6MjEwNTc2MjE5OX0.OWXeMWkfzwftIJXGR4Pkr66mBq4IB5u6vM9T7I7Nx-0',
};
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('tr-TR');
const short = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
  if (n >= 1e4) return `${+(n / 1e3).toFixed(0)}K`;
  return fmt(n);
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const T = (ms) => (reduced ? ms * CONFIG.TIMING.reducedMotionScale : ms);
const store = {
  get(k, d) { try { const v = localStorage.getItem(CONFIG.STORAGE.prefix + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(CONFIG.STORAGE.prefix + k, JSON.stringify(v)); } catch { /* yok */ } },
};

// ─── durum ──────────────────────────────────────────────────────────────────
const host = createHost(window);
const sound = new SoundEngine(host.getSoundPrefs());
const lock = new SpinLock();
const sm = new StateMachine((s) => { $('app').dataset.state = s; updateButtons(); });
const game = {
  engine: null,
  balance: 0,
  bet: CONFIG.CREDITS.betLevels.includes(store.get('bet', 0)) ? store.get('bet', 0) : CONFIG.CREDITS.defaultBet,
  history: [],
  stats: null,
  autoLeft: 0,
  last: null,
  lineCycle: 0,
  ready: false,
};

let reels, bg, burst, layout;

// ─── kurulum ────────────────────────────────────────────────────────────────
async function boot() {
  const gemUrl = symbolURL('blue', 'glow');
  $('ld-gem').innerHTML = `<img src="${gemUrl}" alt="">`;
  document.querySelectorAll('.gem-ico').forEach((el) => { el.style.backgroundImage = `url(${symbolURL('blue', 'normal')})`; });
  $('brand').innerHTML = logoSVG(190);

  const intensity = detectIntensity(reduced);
  bg = new BackgroundFX($('bg-fx'), intensity, reduced);
  bg.start();
  burst = new BurstFX($('fx'), intensity);

  reels = new ReelSet($('reels'), { reducedMotion: reduced, onStop: () => reelsStopped?.() });
  doLayout();
  new ResizeObserver(() => doLayout()).observe($('stage'));
  $('reels').classList.add('idle');

  bindUI();
  renderUser();
  renderBet();

  await Promise.all([
    preloadSymbols(CONFIG.SYMBOLS.map((s) => s.id)),
    connect(),
  ]);
  game.ready = true;
  $('loader').classList.add('hide');
  setTimeout(() => $('loader').remove(), 500);
  host.notify('ready');
  host.notify('open');
  updateButtons();
}

async function connect() {
  const session = readInjectedSession();
  if (DEMO || (!host.embedded && !session)) {
    // Demo'da `?seed=` ile tekrarlanabilir sonuçlar (yalnız test; demo kredi değersizdir).
    const seed = Number(params.get('seed'));
    game.engine = new DemoEngine(DEMO && seed > 0 ? { rng: seededRandom(seed) } : {});
    setMode('demo');
  } else {
    try {
      const { createClient } = await import(SUPABASE_JS);
      const client = createClient(SUPABASE.url, SUPABASE.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'retra-diamond-auth' } });
      if (session) {
        const { error } = await client.auth.setSession(session);
        if (!error) clearTokensFromUrl();
      }
      const { data } = await client.auth.getSession();
      if (!data?.session) throw new Error('AUTH_REQUIRED');
      game.engine = new LiveEngine(client);
      setMode('live');
    } catch (e) {
      setMode('live');
      toast(translateLiveError(e), 4000);
      game.engine = null;
      return;
    }
  }
  try {
    applyState(await game.engine.connect());
  } catch (e) {
    toast(e.message || translateLiveError(e), 4000);
  }
}

function setMode(mode) {
  const chip = $('mode-chip');
  chip.className = `mode-chip ${mode}`;
  chip.textContent = mode === 'live' ? 'GERÇEK KRİSTAL' : 'DEMO KREDİ';
}

function applyState(st) {
  if (!st) return;
  setBalance(st.balance);
  if (st.user && !host.getUser()) renderUser(st.user);
  if (st.open === false) toast('Diamond Slot şu an kapalı.', 4000);
  game.history = [...(st.history ?? [])];
  game.stats = st.stats ? { ...st.stats, symbolCounts: { ...st.stats.symbolCounts } } : null;
}

function renderUser(fromServer = null) {
  const u = host.getUser() ?? fromServer;
  if (!u) { $('who').innerHTML = host.embedded ? '' : '<span>Tarayıcıda deneme</span>'; return; }
  const avatar = /^https:\/\//.test(u.avatar ?? '') ? u.avatar : '';
  $('who').innerHTML = `${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<b>${esc(u.name || 'Oyuncu')}</b>`;
}

// ─── yerleşim ───────────────────────────────────────────────────────────────
function doLayout() {
  const st = $('stage');
  const w = st.clientWidth;
  const h = st.clientHeight - 10;
  if (w < 50 || h < 50) return;
  layout = computeLayout(w, h, CONFIG.REELS, CONFIG.ROWS);
  const m = $('machine');
  m.style.width = `${layout.W}px`;
  m.style.height = `${layout.H}px`;
  $('cabinet').innerHTML = cabinetSVG(layout);
  const mq = $('marquee');
  mq.style.height = `${layout.marquee + layout.top * 0.2}px`;
  mq.innerHTML = logoSVG(Math.min(layout.W * 0.56, 320));
  const win = $('reel-window');
  Object.assign(win.style, { left: `${layout.winX}px`, top: `${layout.winY}px`, width: `${layout.winW}px`, height: `${layout.winH}px` });
  $('paylines').setAttribute('viewBox', `0 0 ${layout.winW} ${layout.winH}`);
  reels.setSize(layout.cell, layout.gap);
  if (game.last && sm.state === STATES.IDLE) showWinMarks(game.last, false);
}

const cellCenter = (reel, row) => [reel * (layout.cell + layout.gap) + layout.cell / 2, row * layout.cell + layout.cell / 2];

// ─── arayüz ─────────────────────────────────────────────────────────────────
function bindUI() {
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  $('btn-spin').addEventListener('click', () => {
    if (game.autoLeft > 0) { stopAuto(); return; }
    $('btn-spin').classList.remove('pressed'); void $('btn-spin').offsetWidth; $('btn-spin').classList.add('pressed');
    spin();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && $('sheet').hidden && $('bigwin').hidden && $('bonus').hidden) { e.preventDefault(); spin(); }
  });
  $('bet-minus').addEventListener('click', () => changeBet(-1));
  $('bet-plus').addEventListener('click', () => changeBet(1));
  $('btn-back').addEventListener('click', () => { sound.click(); host.close(); });
  $('btn-info').addEventListener('click', () => { sound.click(); openInfo(); });
  $('btn-history').addEventListener('click', () => { sound.click(); openHistory(); });
  $('btn-sound').addEventListener('click', () => { sound.click(); openSound(); });
  $('btn-auto').addEventListener('click', () => { sound.click(); if (game.autoLeft > 0) stopAuto(); else openAuto(); });
  $('sheet-close').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
  document.addEventListener('visibilitychange', () => sound.suspend(document.hidden));
  updateSoundIcon();
}

function updateButtons() {
  const busy = sm.busy || !game.ready || !game.engine;
  const spinBtn = $('btn-spin');
  spinBtn.disabled = game.autoLeft > 0 ? false : busy;
  spinBtn.classList.toggle('busy', sm.state === STATES.REQUESTING || sm.state === STATES.SPINNING);
  spinBtn.classList.toggle('auto', game.autoLeft > 0);
  const levels = CONFIG.CREDITS.betLevels;
  $('bet-minus').disabled = busy || game.autoLeft > 0 || game.bet <= levels[0];
  $('bet-plus').disabled = busy || game.autoLeft > 0 || game.bet >= levels[levels.length - 1];
  $('btn-auto').classList.toggle('on', game.autoLeft > 0);
  $('auto-left').textContent = game.autoLeft > 0 ? String(game.autoLeft) : '';
  $('reels').classList.toggle('idle', sm.state === STATES.IDLE);
}

function changeBet(dir) {
  if (sm.busy || game.autoLeft > 0) return;
  const levels = CONFIG.CREDITS.betLevels;
  const i = Math.max(0, Math.min(levels.length - 1, levels.indexOf(game.bet) + dir));
  if (levels[i] === game.bet) return;
  game.bet = levels[i];
  store.set('bet', game.bet);
  sound.click();
  renderBet();
  updateButtons();
}

function renderBet() { $('bet-value').textContent = fmt(game.bet); }

let balAnim = 0;
function setBalance(v, animate = false) {
  const el = $('balance').querySelector('span');
  const from = game.balance;
  game.balance = Number(v) || 0;
  cancelAnimationFrame(balAnim);
  if (!animate || from === game.balance) { el.textContent = fmt(game.balance); return; }
  const t0 = performance.now();
  const dur = T(700);
  const step = (t) => {
    const u = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(from + (game.balance - from) * (1 - Math.pow(1 - u, 3)));
    if (u < 1) balAnim = requestAnimationFrame(step);
  };
  balAnim = requestAnimationFrame(step);
}

function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

// ─── çevirme akışı ──────────────────────────────────────────────────────────
let reelsStopped = null;
const waitReels = () => new Promise((res) => { reelsStopped = () => { reelsStopped = null; res(); }; });

async function spin() {
  if (!game.ready || !game.engine) return;
  if (sm.state !== STATES.IDLE || !lock.tryStart()) return;   // çift tıklama / dönerken engel
  try {
    if (game.bet > game.balance) {
      sound.error();
      if (game.engine.mode === 'demo' && game.balance < CONFIG.CREDITS.betLevels[0]) {
        game.engine.refill();
        applyState(await game.engine.refresh());
        toast('Demo kredin yenilendi.');
      } else {
        toast(game.engine.mode === 'live' ? 'Kristal bakiyen bu bahis için yetersiz.' : 'Demo kredi bu bahis için yetersiz.');
        host.notify('lowbalance');
      }
      stopAuto();
      return;
    }

    clearWinMarks();
    sm.go(STATES.REQUESTING);
    sound.spinStart();
    sound.reelLoop(CONFIG.REELS);
    const startedAt = performance.now();
    const stopped = waitReels();
    reels.start();
    setBalance(game.balance - game.bet);   // bahis hemen düşer (sunucu onaylayacak)
    $('last-win').querySelector('span').textContent = '0';

    let result;
    try {
      result = await game.engine.spin(game.bet);
    } catch (e) {
      reels.abort(startedAt);
      await stopped;
      sound.reelStop(true);
      sm.go(STATES.IDLE);
      toast(e.message || 'Çevirme yapılamadı.');
      try { applyState(await game.engine.refresh()); } catch { setBalance(game.balance + game.bet); }
      stopAuto();
      return;
    }

    sm.go(STATES.SPINNING);
    reels.land(result.stops, {
      anticipation: result.anticipation,
      startedAt,
      onReelStop: (i) => {
        sound.reelThunk(i);
        sound.reelStop();
        if (i === CONFIG.REELS - 1) { $('machine').classList.remove('shake'); void $('machine').offsetWidth; $('machine').classList.add('shake'); }
      },
      onAnticipate: () => sound.anticipation(),
    });
    await stopped;
    sound.reelStop(true);

    // Güvenlik: makaralarda görünen tahta sonuçla aynı olmalı.
    const shown = reels.grid();
    if (JSON.stringify(shown) !== JSON.stringify(result.grid)) console.warn('[diamond] tahta uyuşmazlığı', shown, result.grid);

    sm.go(STATES.PRESENTING);
    game.last = result;
    await present(result);
    finishRound(result);
  } finally {
    lock.release();
    updateButtons();
    if (game.autoLeft > 0 && sm.state === STATES.IDLE) scheduleAuto();
  }
}

function finishRound(r) {
  setBalance(r.balance, true);
  pushHistory(r);
  if (sm.state !== STATES.IDLE) sm.go(STATES.IDLE);
}

function pushHistory(r) {
  const best = [...r.wins].sort((a, b) => b.amount - a.amount)[0];
  const entry = {
    at: new Date().toISOString(), bet: r.bet, payout: r.totalWin, win: r.totalWin > 0,
    symbol: r.bonus ? 'bonus' : best?.symbol ?? null, count: r.bonus ? r.bonus.count : best?.count ?? 0, lines: r.wins.length,
  };
  game.history = [entry, ...game.history].slice(0, CONFIG.STORAGE.historySize);
  if (game.stats) {
    game.stats.rounds += 1;
    game.stats.totalWon += r.totalWin;
    game.stats.maxWin = Math.max(game.stats.maxWin, r.totalWin);
    game.stats.lastAt = entry.at;
    for (const col of r.grid) for (const s of col) game.stats.symbolCounts[s] = (game.stats.symbolCounts[s] ?? 0) + 1;
  }
  const lr = $('last-result');
  if (r.totalWin > 0) {
    const what = r.bonus ? `Kristal Sandık ×${r.bonus.reward.mult}` : best ? `${best.count}× ${symbolById(best.symbol)?.name ?? ''}` : '';
    lr.innerHTML = `Son tur: ${esc(what)} · <b>+${fmt(r.totalWin)}</b>`;
  } else {
    lr.innerHTML = `Son tur: <span class="lose">kazanç yok</span> · bahis ${fmt(r.bet)}`;
  }
}

// ─── sonuç gösterimi ────────────────────────────────────────────────────────
function clearWinMarks() {
  clearInterval(game.lineCycle);
  $('frames').innerHTML = '';
  $('paylines').innerHTML = '';
  $('reels').classList.remove('dim');
  $('win-banner').classList.remove('show');
  document.querySelectorAll('.cell.win').forEach((c) => {
    c.classList.remove('win');
    const img = c.querySelector('img');
    if (c.dataset.sym) img.src = symbolURL(c.dataset.sym, 'normal');
  });
}

const LINE_COLORS = ['#ffd34d', '#5ad8ff', '#ff7af5', '#2ee089', '#ff8a3d', '#b44dff', '#7ff6ff', '#ff4f7a'];

function showWinMarks(r, animate = true) {
  $('frames').innerHTML = '';
  const cells = winningCells(r);
  if (!cells.length) return;
  $('reels').classList.add('dim');
  const bonusSet = new Set((r.bonus?.cells ?? []).map(([a, b]) => `${a}:${b}`));
  const frag = document.createDocumentFragment();
  for (const [reel, row] of cells) {
    const c = reels.cell(reel, row);
    c.classList.add('win');
    c.style.setProperty('--glow', SYMBOL_GLOW[c.dataset.sym] ?? '#ffd34d');
    c.querySelector('img').src = symbolURL(c.dataset.sym, 'win');
    const f = document.createElement('div');
    f.className = `wframe${bonusSet.has(`${reel}:${row}`) ? ' is-bonus' : ''}`;
    const [x, y] = cellCenter(reel, row);
    const s = layout.cell;
    Object.assign(f.style, { left: `${x - s / 2 + 2}px`, top: `${y - s / 2 + 2}px`, width: `${s - 4}px`, height: `${s - 4}px` });
    if (!animate) f.style.animation = 'none';
    f.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect class="wf-glow" x="3" y="3" width="94" height="94" rx="12"/><rect class="wf-core" x="3" y="3" width="94" height="94" rx="12"/></svg>`;
    frag.appendChild(f);
  }
  $('frames').appendChild(frag);
  drawLines(r.wins);
}

function drawLines(wins) {
  const defs = `<defs><linearGradient id="wf-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4b0"/><stop offset=".5" stop-color="#ffc93a"/><stop offset="1" stop-color="#ff7af5"/></linearGradient></defs>`;
  const lines = wins.map((w) => {
    const color = LINE_COLORS[w.line % LINE_COLORS.length];
    const ptsAll = CONFIG.PAYLINES[w.line].map((row, reel) => cellCenter(reel, row));
    const p = ptsAll.slice(0, w.count);
    // çizgi pencerenin iki kenarına uzansın
    const first = [Math.max(2, p[0][0] - layout.cell / 2), p[0][1]];
    const pts = [first, ...p].map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ');
    return `<polyline class="pl-glow" points="${pts}" stroke="${color}"/><polyline class="pl-core" points="${pts}" stroke="${color}"/>`;
  });
  $('paylines').innerHTML = defs + lines.join('');
}

/** Kazanç miktarı sayacı. */
function countUp(el, to, ms, onTick) {
  return new Promise((res) => {
    const t0 = performance.now();
    let lastTick = 0;
    const step = (t) => {
      const u = Math.min(1, (t - t0) / ms);
      const v = Math.round(to * (1 - Math.pow(1 - u, 2.4)));
      el.textContent = fmt(v);
      if (onTick && t - lastTick > 70 && u < 1) { lastTick = t; onTick(); }
      if (u < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

async function present(r) {
  const lineWin = r.lineTotal;
  const winEl = $('last-win').querySelector('span');
  if (r.totalWin <= 0 && !r.bonus) return;

  showWinMarks(r);
  // kıvılcımlar: kazanan hücrelerin ekran konumunda
  const wr = $('reel-window').getBoundingClientRect();
  for (const [reel, row] of winningCells(r).slice(0, 10)) {
    const [x, y] = cellCenter(reel, row);
    burst.sparks(wr.left + x, wr.top + y, 8, r.bonus && r.bonus.cells.some(([a, b]) => a === reel && b === row) ? 285 : 45);
  }

  if (lineWin > 0) {
    sound.smallWin();
    const banner = $('win-banner');
    banner.innerHTML = `+${fmt(lineWin)}`;
    banner.classList.add('show');
    $('last-win').classList.remove('flash'); void $('last-win').offsetWidth; $('last-win').classList.add('flash');
    await countUp(winEl, lineWin, T(r.tier === 'small' && !r.bonus ? 700 : 500), () => sound.tick());
    cycleLines(r);
  }

  if (r.bonus) {
    sound.bonusTrigger();
    await sleep(T(900));
    sm.go(STATES.BONUS);
    await runBonus(r);
    winEl.textContent = fmt(r.totalWin);
  }

  if (r.tier === 'big' || r.tier === 'mega') {
    sm.go(STATES.CELEBRATING);
    await runBigWin(r);
  } else if (r.totalWin > 0) {
    await sleep(T(game.autoLeft > 0 ? 500 : 250));
  }
  if (r.totalWin > 0 && game.engine.mode === 'live') host.notify('win', r.totalWin);
}

/** Kazanan çizgileri tek tek döndürerek gösterir (sonraki çevirmeye kadar). */
function cycleLines(r) {
  clearInterval(game.lineCycle);
  if (r.wins.length < 2) return;
  let i = 0;
  game.lineCycle = setInterval(() => {
    if (sm.state === STATES.REQUESTING || sm.state === STATES.SPINNING) { clearInterval(game.lineCycle); return; }
    drawLines([r.wins[i % r.wins.length]]);
    i++;
  }, 1100);
}

// ─── büyük kazanç ───────────────────────────────────────────────────────────
async function runBigWin(r) {
  const ov = $('bigwin');
  const mega = r.tier === 'mega';
  const g = symbolURL('blue', 'glow');
  $('bw-gem').innerHTML = `<div class="spinner"><img src="${g}" alt=""><img src="${g}" alt=""></div>`;
  const letters = [...'DIAMOND WIN!'].map((ch, i) => (ch === ' ' ? '<span class="sp"></span>' : `<span style="--i:${i}">${ch}</span>`)).join('');
  $('bw-title').innerHTML = `${mega ? '<div class="bw-mega">MEGA</div>' : ''}<div class="bw-row">${letters}</div>`;
  $('bw-amount').textContent = '0';
  ov.hidden = false;
  ov.classList.remove('out');
  bg.stop();   // arka plan karartıldı: çizmeye gerek yok
  $('machine').classList.add('zoom', 'celebrate');
  sound.bigWin();
  const cx = innerWidth / 2, cy = innerHeight * 0.42;
  burst.bigBurst(cx, cy, mega ? 1.6 : 1);
  burst.rain(mega ? 4.5 : 3, mega ? 40 : 24);
  setTimeout(() => burst.bigBurst(cx, cy, 0.6), T(900));

  const dur = T(mega ? CONFIG.TIMING.megaWinMs : CONFIG.TIMING.bigWinMs);
  let skip;
  const skipP = new Promise((res) => { skip = res; });
  const onTap = () => skip();
  setTimeout(() => ov.addEventListener('click', onTap), 600);
  await Promise.race([countUp($('bw-amount'), r.totalWin, dur * 0.55, () => sound.tick()), skipP]);
  $('bw-amount').textContent = fmt(r.totalWin);
  await Promise.race([sleep(dur * 0.45 + (game.autoLeft > 0 ? 0 : 600)), skipP]);
  ov.removeEventListener('click', onTap);
  ov.classList.add('out');
  $('machine').classList.remove('zoom', 'celebrate');
  await sleep(380);
  ov.hidden = true;
  bg.start();
}

// ─── bonus ──────────────────────────────────────────────────────────────────
async function runBonus(r) {
  const ov = $('bonus');
  const chest = $('bn-chest');
  chest.className = 'bn-chest idle';
  chest.innerHTML = symbolSVG('bonus', 'glow', { size: 300 });
  $('bn-reward').innerHTML = '';
  $('bn-collect').hidden = true;
  $('bn-sub').textContent = `${r.bonus.count} BONUS sembolü! Sandığı açmak için dokun`;
  ov.hidden = false;
  bg.stop();

  await new Promise((res) => {
    const go = () => { chest.removeEventListener('click', go); clearTimeout(auto); res(); };
    chest.addEventListener('click', go);
    const auto = setTimeout(go, game.autoLeft > 0 ? 1400 : 12000);
  });
  chest.className = 'bn-chest shake';
  $('bn-sub').textContent = 'Açılıyor…';
  sound.bonusOpen();
  await sleep(T(1000));
  chest.className = 'bn-chest open';
  const rect = chest.getBoundingClientRect();
  burst.bigBurst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, 0.8);
  $('bn-sub').textContent = 'Kristal Sandık ödülü';
  const g = symbolURL('blue', 'normal');
  $('bn-reward').innerHTML = `<div class="amt"><i class="gem-ico" style="background-image:url(${g})"></i><b id="bn-amt">0</b></div><div class="mult">BAHİS × ${r.bonus.reward.mult}</div>`;
  await countUp($('bn-amt'), r.bonus.reward.amount, T(1200), () => sound.tick());
  $('bn-collect').hidden = false;
  await new Promise((res) => {
    const go = () => { $('bn-collect').removeEventListener('click', go); clearTimeout(auto); res(); };
    $('bn-collect').addEventListener('click', go);
    const auto = setTimeout(go, game.autoLeft > 0 ? 1200 : 15000);
  });
  sound.click();
  ov.hidden = true;
  bg.start();
}

// ─── otomatik dönüş ─────────────────────────────────────────────────────────
function scheduleAuto() {
  clearTimeout(game.autoTimer);
  game.autoTimer = setTimeout(() => {
    if (game.autoLeft <= 0 || sm.state !== STATES.IDLE) return;
    game.autoLeft -= 1;
    updateButtons();
    spin();
  }, T(CONFIG.TIMING.autoSpinGapMs));
}

function startAuto(n) {
  closeSheet();
  game.autoLeft = n;
  updateButtons();
  scheduleAuto();
}

function stopAuto() {
  game.autoLeft = 0;
  clearTimeout(game.autoTimer);
  updateButtons();
}

// ─── paneller ───────────────────────────────────────────────────────────────
function openSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
}
function closeSheet() { $('sheet').hidden = true; }

function openInfo() {
  const lineBet = game.bet / CONFIG.PAYLINES.length;
  const items = CONFIG.SYMBOLS.filter((s) => !s.scatter).map((s) => {
    const px = [5, 4, 3].map((n) => `${n}× <b>${short(Math.round(lineBet * s.pays[n]))}</b>`).join(' · ');
    return `<div class="pt-item"><img src="${symbolURL(s.id, 'glow')}" alt=""><div><div class="nm">${esc(s.name)}</div><div class="px">${px}</div></div></div>`;
  }).join('');
  const lines = CONFIG.PAYLINES.map((l, i) => {
    const pts = l.map((row, r) => `${6 + r * 12},${6 + row * 12}`).join(' ');
    return `<svg viewBox="0 0 60 36"><g fill="#3a2a6a">${[0, 1, 2].map((row) => [0, 1, 2, 3, 4].map((r) => `<rect x="${1 + r * 12}" y="${1 + row * 12}" width="10" height="10" rx="2"/>`).join('')).join('')}</g><polyline points="${pts}" fill="none" stroke="${LINE_COLORS[i % LINE_COLORS.length]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><text x="30" y="35" font-size="5" fill="#a99ccc" text-anchor="middle">${i + 1}</text></svg>`;
  }).join('');
  const live = game.engine?.mode === 'live';
  openSheet('OYUN BİLGİSİ', `
    <p>5 makara · 3 satır · <b>20 ödeme çizgisi</b>. Aynı sembol soldan sağa, ilk makaradan başlayarak en az 3 kez arka arkaya gelirse kazanırsın. Ödemeler mevcut bahsine (${fmt(game.bet)}) göre gösterilir.</p>
    <h4>SEMBOLLER</h4><div class="paytable">${items}</div>
    <h4>ÖZEL SEMBOLLER</h4>
    <div class="paytable">
      <div class="pt-item"><img src="${symbolURL('wild', 'glow')}" alt=""><div><div class="nm">WILD</div><div class="px">Yalnız 2, 3 ve 4. makarada çıkar; BONUS dışındaki her sembolün yerine geçer.</div></div></div>
      <div class="pt-item"><img src="${symbolURL('bonus', 'glow')}" alt=""><div><div class="nm">BONUS · Kristal Sandık</div><div class="px">Ekranın herhangi bir yerinde 3+ BONUS → sandık açılır: bahis × 5…100 (4 BONUS ×2, 5 BONUS ×4).</div></div></div>
    </div>
    <h4>ÖDEME ÇİZGİLERİ</h4><div class="lines-grid">${lines}</div>
    <h4>KURALLAR</h4>
    <p>Her çizgide yalnız en yüksek kazanç ödenir; çizgi kazançları toplanır. Bir çevirmede en fazla bahis × ${fmt(CONFIG.MAX_WIN_X)} kazanılır. Teorik geri ödeme oranı ≈ %95.</p>
    <p class="note">${live
      ? 'Oyun gerçek kristal bakiyenle oynanır. Her sonuç SUNUCUDA belirlenir; animasyon sonucu değiştirmez.'
      : 'Bu sayfa DEMO kredi ile çalışır: demo kredi kristale dönüşmez, aktarılamaz ve satılamaz.'}</p>`);
}

function openHistory() {
  const render = () => {
    const rows = game.history.length
      ? game.history.map((h) => {
        const d = new Date(h.at);
        const when = isNaN(d) ? '' : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const res = h.symbol === 'bonus' ? `Kristal Sandık (${h.count} BONUS)` : h.win ? `${h.count}× ${esc(symbolById(h.symbol)?.name ?? '')}${h.lines > 1 ? ` · ${h.lines} çizgi` : ''}` : 'Kazanç yok';
        const icon = h.symbol ? `<img src="${symbolURL(h.symbol, 'normal')}" alt="">` : `<img src="${symbolURL('mystery', 'blur')}" alt="" style="opacity:.4">`;
        return `<div class="hist-row">${icon}<div><div class="r">${res}</div><div class="t">${when}</div></div><div class="p ${h.win ? 'win' : 'lose'}">${h.win ? `+${fmt(h.payout)}` : `−${fmt(h.bet)}`}<span class="b">bahis ${fmt(h.bet)} → ${fmt(h.payout)}</span></div></div>`;
      }).join('')
      : '<div class="empty">Henüz oyun yok.</div>';
    const st = game.stats;
    const top = st ? topSymbol(st.symbolCounts) : null;
    const last = st?.lastAt ? new Date(st.lastAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const stats = st ? `<div class="stats">
      <div class="stat"><span>Toplam tur</span><b>${fmt(st.rounds)}</b></div>
      <div class="stat"><span>Toplam kazanç</span><b>${fmt(st.totalWon)}</b></div>
      <div class="stat"><span>En yüksek kazanç</span><b>${fmt(st.maxWin)}</b></div>
      <div class="stat"><span>En son tur</span><b style="font-size:13px">${last}</b></div>
      <div class="stat" style="grid-column:1/-1"><span>En çok çıkan sembol</span><b>${top ? `<img src="${symbolURL(top, 'normal')}" alt="">${esc(symbolById(top)?.name ?? '')}` : '—'}</b></div>
    </div>` : '';
    openSheet('GEÇMİŞ VE İSTATİSTİK', `<h4 style="margin-top:0">İSTATİSTİK</h4>${stats}<h4>SON ${CONFIG.STORAGE.historySize} OYUN</h4><div class="hist">${rows}</div>`);
  };
  render();
  game.engine?.refresh().then((st) => { applyState(st); if (!$('sheet').hidden && $('sheet-title').textContent.startsWith('GEÇMİŞ')) render(); }).catch(() => {});
}

function updateSoundIcon() { $('btn-sound').classList.toggle('muted', !sound.music && !sound.sfx); }

function openSound() {
  openSheet('SES', `
    <div class="opt-row"><span>Oyun müziği</span><button class="switch ${sound.music ? 'on' : ''}" id="sw-music" aria-label="Müzik"></button></div>
    <div class="opt-row"><span>Efekt sesleri</span><button class="switch ${sound.sfx ? 'on' : ''}" id="sw-sfx" aria-label="Efektler"></button></div>
    <p class="note">Sesler tarayıcıda üretilir. Telefonda ses, ekrana ilk dokunuşla açılır.</p>`);
  $('sw-music').onclick = (e) => { sound.unlock(); sound.setMusic(!sound.music); e.currentTarget.classList.toggle('on', sound.music); updateSoundIcon(); };
  $('sw-sfx').onclick = (e) => { sound.unlock(); sound.setSfx(!sound.sfx); e.currentTarget.classList.toggle('on', sound.sfx); sound.click(); updateSoundIcon(); };
}

function openAuto() {
  if (!game.engine) return;
  openSheet('OTOMATİK DÖNÜŞ', `
    <div class="auto-grid">${CONFIG.AUTO_SPIN_OPTIONS.map((n) => `<button class="pill-btn" data-n="${n}">${n}</button>`).join('')}</div>
    <p class="note">Her dönüşte bahis (${fmt(game.bet)}) düşülür ve normal oyun kuralları uygulanır. SPIN butonuna ya da AUTO'ya basarak istediğin an durdurabilirsin. Bakiye yetmezse otomatik durur.</p>`);
  $('sheet-body').querySelectorAll('[data-n]').forEach((b) => { b.onclick = () => { sound.click(); startAuto(Number(b.dataset.n)); }; });
}

// ─── başlat ─────────────────────────────────────────────────────────────────
window.__diamond = { game, sm, CONFIG, fx: () => ({ bg, burst, reels }) };   // test ve hata ayıklama için
boot().catch((e) => {
  console.error(e);
  toast('Oyun başlatılamadı. Sayfayı yenile.', 6000);
  $('loader')?.classList.add('hide');
});
window.addEventListener('pagehide', () => host.notify('close'));
