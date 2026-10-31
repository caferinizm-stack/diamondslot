// Sembol kütüphanesi ve ekran yerleşimi testleri (node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../js/config/gameConfig.js';
import { symbolSVG, SYMBOL_ART } from '../js/render/symbols.js';
import { computeLayout, cabinetSVG, logoSVG } from '../js/render/cabinet.js';

const VARIANTS = ['normal', 'blur', 'win', 'glow'];

test('semboller: her oyun sembolünün özgün SVG çizimi var', () => {
  for (const s of CONFIG.SYMBOLS) assert.ok(SYMBOL_ART[s.id], `${s.id} çizimi yok`);
  // Her sembolün gövde çizimi diğerlerinden farklı
  const bodies = Object.keys(SYMBOL_ART).map((id) => symbolSVG(id, 'normal').replaceAll(`${id}-normal-`, 'X-'));
  assert.equal(new Set(bodies).size, bodies.length);
});

test('semboller: 4 görünüm, emoji yok, tüm url(#…) başvuruları tanımlı', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const id of Object.keys(SYMBOL_ART)) {
    const seen = new Set();
    for (const v of VARIANTS) {
      const svg = symbolSVG(id, v);
      assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'), `${id}/${v}`);
      assert.equal(emoji.test(svg), false, `${id}/${v} emoji içeriyor`);
      const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(ref), `${id}/${v}: #${ref} tanımsız`);
      // açılan / kapanan etiket dengesi
      const open = (svg.match(/<[a-zA-Z][\w:-]*(\s[^>]*)?(?<!\/)>/g) ?? []).length;
      const close = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
      assert.equal(open, close, `${id}/${v} etiket dengesi`);
      seen.add(svg);
    }
    assert.equal(seen.size, VARIANTS.length, `${id} görünümleri farklı olmalı`);
  }
});

test('semboller: bulanık görünüm dikey hareket bulanıklığı içerir', () => {
  for (const id of Object.keys(SYMBOL_ART)) assert.match(symbolSVG(id, 'blur'), /stdDeviation="0 10"/);
});

test('kasa + logo SVG üretilir', () => {
  const L = computeLayout(360, 400);
  const svg = cabinetSVG(L);
  assert.match(svg, /class="bulb/);
  assert.match(logoSVG(200), /DIAMOND/);
});

test('mobil uyum: 5×3 pencere her ekran boyutunda sığar', () => {
  const sizes = [[300, 300], [320, 330], [344, 360], [360, 380], [375, 420], [390, 560], [412, 600], [768, 700], [1366, 520], [600, 260]];
  for (const [w, h] of sizes) {
    const L = computeLayout(w, h);
    assert.ok(L.W <= w + 0.5, `${w}x${h}: genişlik taşıyor (${L.W})`);
    assert.ok(L.H <= h + 0.5 || L.W === 240, `${w}x${h}: yükseklik taşıyor (${L.H})`);
    assert.ok(L.cell > 30, `${w}x${h}: hücre çok küçük (${L.cell})`);
    assert.ok(Math.abs(L.winX + L.winW + L.side - L.W) < 0.5, `${w}x${h}: 5 makara pencereye tam sığmalı`);
    assert.ok(Math.abs(L.winH - L.cell * CONFIG.ROWS) < 0.01);
  }
});
