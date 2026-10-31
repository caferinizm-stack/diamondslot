// DIAMOND SLOT — MERKEZİ SEMBOL KÜTÜPHANESİ (özgün SVG çizimleri)
//
// Her sembol 200×200 bir SVG olarak KODLA çizilir (emoji / hazır ikon yok).
// Her sembolün dört görünümü vardır:
//   normal  — makarada duran sembol
//   blur    — dönüş sırasında dikey hareket bulanıklığı
//   win     — kazanma anı (yoğun hale + parlak yüzeyler)
//   glow    — ışıklı özel görünüm (bilgi ekranı, bonus, büyük kazanç)
// Animasyonlu görünüm (hafif dönme / parıltı) CSS ile bu görsellerin üstünde
// yapılır (diamond-slot.css ▸ .sym-anim-*).

const NS = 'http://www.w3.org/2000/svg';

// ─── yardımcılar ────────────────────────────────────────────────────────────
const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
const poly = (p, fill, extra = '') => `<polygon points="${pts(p)}" fill="${fill}" ${extra}/>`;
const lin = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

/** 4 kollu parıltı yıldızı. */
const sparkle = (x, y, s, color = '#fff', op = 1) =>
  `<path d="M${x} ${y - s} C${x + s * 0.12} ${y - s * 0.12} ${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} C${x + s * 0.12} ${y + s * 0.12} ${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} C${x - s * 0.12} ${y + s * 0.12} ${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} C${x - s * 0.12} ${y - s * 0.12} ${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z" fill="${color}" opacity="${op}"/>`;

/** Ortak tanımlar: gölge, hale, parıltı süzgeçleri. */
function baseDefs(p, glowColor) {
  return `
  <filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="${p}soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
  ${rad(`${p}halo`, [[0, glowColor, 0.55], [0.45, glowColor, 0.18], [1, glowColor, 0]])}
  ${rad(`${p}shadow`, [[0, '#000', 0.55], [1, '#000', 0]])}
  ${lin(`${p}prism`, [[0, '#ff4fd8', 0.0], [0.2, '#ff4fd8', 0.55], [0.4, '#ffe14f', 0.55], [0.6, '#4fffb0', 0.55], [0.8, '#4fb8ff', 0.55], [1, '#4fb8ff', 0]], 0, 0, 1, 1)}
  ${lin(`${p}sheen`, [[0, '#fff', 0], [0.45, '#fff', 0], [0.5, '#fff', 0.85], [0.55, '#fff', 0], [1, '#fff', 0]], 0, 0, 1, 0.35)}`;
}

/** Yüzey renklerinden açık→koyu doğrusal geçiş üretir. */
function facetGrads(p, shades) {
  return shades.map((c, i) => lin(`${p}f${i}`, [[0, c[0]], [1, c[1]]], 0, 0, 0.35, 1)).join('');
}

// ─── 1) BLUE DIAMOND — klasik yan görünüş pırlanta (ışık kırılmalı) ───────
function brilliantSide(p, pal) {
  const Q = [[20, 84], [40, 84], [60, 84], [80, 84], [100, 84], [120, 84], [140, 84], [160, 84], [180, 84]];
  const P1 = [56, 46], Pa = [78, 46], Pm = [100, 46], Pb = [122, 46], P3 = [144, 46];
  const C = [100, 176];
  const crown = [
    [Q[0], P1, Q[2], 0], [P1, Pa, Q[2], 2], [Pa, Q[2], Q[4], 1], [Pa, Pm, Q[4], 3],
    [Pm, Pb, Q[4], 2], [Pb, Q[4], Q[6], 1], [Pb, P3, Q[6], 3], [P3, Q[6], Q[8], 4],
  ];
  const pav = [];
  for (let i = 0; i < 8; i++) pav.push([Q[i], Q[i + 1], C, [5, 6, 4, 7, 6, 4, 7, 5][i]]);
  let s = '';
  for (const [a, b, c, k] of [...crown, ...pav]) s += poly([a, b, c], `url(#${p}f${k})`, `stroke="${pal.edge}" stroke-width="1.1" stroke-opacity=".55" stroke-linejoin="round"`);
  // Tabla iç yansıması + girdle
  s += poly([P1, P3, [134, 56], [66, 56]], `url(#${p}table)`, 'opacity=".85"');
  s += `<path d="M20 84 H180" stroke="${pal.edge}" stroke-width="2.2" stroke-opacity=".9"/>`;
  // Işık kırılması: tayf şeritleri
  s += poly([[60, 84], [100, 176], [86, 84]], `url(#${p}prism)`, 'opacity=".55" style="mix-blend-mode:screen"');
  s += poly([[120, 84], [100, 176], [140, 84]], `url(#${p}prism)`, 'opacity=".35" style="mix-blend-mode:screen"');
  // İç yansımalar
  s += `<path d="M48 84 L100 160 L152 84" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.4"/>`;
  s += `<path d="M78 46 L100 84 L122 46" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`;
  return {
    defs: facetGrads(p, pal.f) + lin(`${p}table`, [[0, '#ffffff', 0.95], [0.5, pal.f[0][0], 0.6], [1, pal.f[2][1], 0.3]], 0, 0, 1, 1)
      + lin(`${p}rim`, [[0, pal.neon[0]], [1, pal.neon[1]]], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts([Q[0], P1, P3, Q[8], C])}" fill="none" stroke="url(#${p}rim)" stroke-width="3.4" stroke-linejoin="round"/>`,
    sparkles: sparkle(64, 52, 13) + sparkle(150, 92, 8, '#fff', 0.9) + sparkle(96, 140, 6, '#fff', 0.7),
    sheenClip: `<polygon points="${pts([Q[0], P1, P3, Q[8], C])}"/>`,
  };
}

// ─── 2) PURPLE DIAMOND — üstten yuvarlak pırlanta (sekizgen yıldız kesim) ─
function brilliantTop(p, pal) {
  const cx = 100, cy = 104, R = 76, r = 40, n = 8;
  const pt = (rr, a) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  let s = '';
  const outer = [], inner = [];
  for (let i = 0; i < n * 2; i++) outer.push(pt(R, (i / (n * 2)) * Math.PI * 2 - Math.PI / 2));
  for (let i = 0; i < n; i++) inner.push(pt(r, (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n));
  // Dış halka (girdle) yüzeyleri
  for (let i = 0; i < n; i++) {
    const a = outer[i * 2], b = outer[(i * 2 + 1) % (n * 2)], c = outer[(i * 2 + 2) % (n * 2)];
    const ia = inner[(i + n - 1) % n], ib = inner[i];
    s += poly([a, b, ib], `url(#${p}f${(i % 4) + 1})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".5"`);
    s += poly([b, c, ib], `url(#${p}f${((i + 2) % 4) + 3})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".5"`);
    s += poly([a, ib, ia], `url(#${p}f${(i % 3) + 2})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".45"`);
  }
  // Yıldız yüzeyleri + tabla
  for (let i = 0; i < n; i++) {
    const ia = inner[i], ib = inner[(i + 1) % n], o = outer[(i * 2 + 2) % (n * 2)];
    s += poly([ia, ib, [cx, cy]], `url(#${p}f${i % 2 ? 0 : 2})`, 'opacity=".9"');
    s += poly([ia, o, ib], `url(#${p}f${(i % 3) + 4})`, `stroke="${pal.edge}" stroke-width=".8" stroke-opacity=".5"`);
  }
  s += `<polygon points="${pts(inner)}" fill="url(#${p}table)" stroke="#fff" stroke-opacity=".55" stroke-width="1.3"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${p}prism)" opacity=".28" style="mix-blend-mode:screen"/>`;
  s += `<path d="M${cx - 30} ${cy - 22} Q${cx} ${cy - 40} ${cx + 30} ${cy - 22}" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return {
    defs: facetGrads(p, pal.f) + rad(`${p}table`, [[0, '#ffffff', 0.95], [0.4, pal.f[0][1], 0.75], [1, pal.f[3][1], 0.6]], 0.4, 0.35, 0.8)
      + lin(`${p}rim`, [[0, pal.neon[0]], [1, pal.neon[1]]], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts(outer)}" fill="none" stroke="url(#${p}rim)" stroke-width="3.6" stroke-linejoin="round"/>`,
    sparkles: sparkle(68, 64, 14) + sparkle(146, 132, 8, '#fff', 0.85),
    sheenClip: `<polygon points="${pts(outer)}"/>`,
  };
}

// ─── 3) GOLD DIAMOND — prenses (kare) kesim, metalik altın ───────────────
function princess(p, pal) {
  const c = [100, 104];
  const o = [[30, 34], [170, 34], [170, 174], [30, 174]];
  const m = [[100, 34], [170, 104], [100, 174], [30, 104]];
  const t = [[72, 76], [128, 76], [128, 132], [72, 132]];
  let s = '';
  const quads = [
    [o[0], m[0], t[0], 1], [m[0], o[1], t[1], 0], [o[1], m[1], t[1], 3], [m[1], o[2], t[2], 4],
    [o[2], m[2], t[2], 5], [m[2], o[3], t[3], 6], [o[3], m[3], t[3], 3], [m[3], o[0], t[0], 2],
    [m[0], t[0], t[1], 2], [m[1], t[1], t[2], 5], [m[2], t[2], t[3], 6], [m[3], t[3], t[0], 1],
  ];
  for (const [a, b, d, k] of quads) s += poly([a, b, d], `url(#${p}f${k})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".55"`);
  for (let i = 0; i < 4; i++) s += poly([t[i], t[(i + 1) % 4], c], `url(#${p}f${[0, 3, 5, 2][i]})`, 'opacity=".95"');
  s += `<rect x="72" y="76" width="56" height="56" fill="url(#${p}table)" opacity=".6"/>`;
  // Metalik bantlar
  s += `<path d="M30 34 L170 174 M170 34 L30 174" stroke="#fff6c8" stroke-opacity=".45" stroke-width="1.4"/>`;
  s += poly([[30, 34], [70, 34], [30, 74]], '#fffbe6', 'opacity=".55"');
  s += `<rect x="30" y="34" width="140" height="140" fill="url(#${p}prism)" opacity=".18" style="mix-blend-mode:screen"/>`;
  return {
    defs: facetGrads(p, pal.f) + lin(`${p}table`, [[0, '#fffbe0'], [0.5, '#ffd34d'], [1, '#b8720f']], 0, 0, 1, 1)
      + lin(`${p}rim`, [[0, pal.neon[0]], [0.5, '#fff3b0'], [1, pal.neon[1]]], 0, 0, 1, 1),
    body: s,
    outline: `<rect x="30" y="34" width="140" height="140" rx="6" fill="none" stroke="url(#${p}rim)" stroke-width="4"/>`,
    sparkles: sparkle(46, 48, 14) + sparkle(152, 158, 9, '#fff', 0.8) + sparkle(128, 76, 6, '#fff', 0.9),
    sheenClip: '<rect x="30" y="34" width="140" height="140" rx="6"/>',
  };
}

// ─── 4) RUBY — oval yastık kesim, basamaklı yüzeyler ─────────────────────
function cushion(p, pal) {
  const cx = 100, cy = 104;
  const ring = (rx, ry, n = 12, rot = 0) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rot;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const R1 = ring(66, 78), R2 = ring(46, 56, 12, Math.PI / 12), R3 = ring(26, 32);
  let s = '';
  for (let i = 0; i < 12; i++) {
    const j = (i + 1) % 12;
    s += poly([R1[i], R1[j], R2[i]], `url(#${p}f${[1, 3, 4, 6, 5, 2][i % 6]})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".5"`);
    s += poly([R1[j], R2[j], R2[i]], `url(#${p}f${[4, 2, 6, 3, 1, 5][i % 6]})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".45"`);
    s += poly([R2[i], R2[j], R3[j]], `url(#${p}f${[2, 5, 3, 6, 4, 1][i % 6]})`, `stroke="${pal.edge}" stroke-width=".8" stroke-opacity=".45"`);
  }
  s += `<polygon points="${pts(R3)}" fill="url(#${p}table)" stroke="#ffd6dc" stroke-opacity=".6"/>`;
  s += `<ellipse cx="${cx}" cy="${cy + 10}" rx="44" ry="50" fill="url(#${p}inner)" style="mix-blend-mode:screen"/>`;
  s += `<path d="M58 70 Q78 40 112 36" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  return {
    defs: facetGrads(p, pal.f) + rad(`${p}table`, [[0, '#ffe0e6'], [0.6, '#ff3b5c'], [1, '#8a0022']], 0.4, 0.3, 0.8)
      + rad(`${p}inner`, [[0, '#ff6b86', 0.65], [1, '#ff1744', 0]]) + lin(`${p}rim`, [[0, pal.neon[0]], [1, pal.neon[1]]], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts(R1)}" fill="none" stroke="url(#${p}rim)" stroke-width="3.4" stroke-linejoin="round"/>`,
    sparkles: sparkle(60, 60, 12) + sparkle(142, 150, 7, '#fff', 0.8),
    sheenClip: `<polygon points="${pts(R1)}"/>`,
  };
}

// ─── 5) EMERALD — dikdörtgen basamak (zümrüt) kesim ──────────────────────
function emeraldCut(p, pal) {
  const oct = (x, y, w, h, c) => [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
  const L = [oct(38, 22, 124, 164, 28), oct(52, 38, 96, 132, 20), oct(66, 54, 68, 100, 13), oct(78, 68, 44, 72, 8)];
  let s = '';
  for (let l = 0; l < 3; l++) {
    const A = L[l], B = L[l + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const k = [[1, 3, 5, 6, 6, 4, 2, 0], [2, 4, 6, 5, 5, 3, 1, 1], [3, 5, 4, 6, 4, 2, 2, 0]][l][i];
      s += poly([A[i], A[j], B[j], B[i]], `url(#${p}f${k})`, `stroke="${pal.edge}" stroke-width="1" stroke-opacity=".55" stroke-linejoin="round"`);
    }
  }
  s += `<polygon points="${pts(L[3])}" fill="url(#${p}table)" stroke="#e6fff2" stroke-opacity=".6"/>`;
  s += `<path d="M84 74 L84 134" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M116 74 L116 134" stroke="#000" stroke-opacity=".15" stroke-width="2"/>`;
  s += `<polygon points="${pts(L[0])}" fill="url(#${p}prism)" opacity=".2" style="mix-blend-mode:screen"/>`;
  return {
    defs: facetGrads(p, pal.f) + lin(`${p}table`, [[0, '#d8ffe9'], [0.5, '#2ee089'], [1, '#05663c']], 0, 0, 1, 1)
      + lin(`${p}rim`, [[0, pal.neon[0]], [1, pal.neon[1]]], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts(L[0])}" fill="none" stroke="url(#${p}rim)" stroke-width="3.6" stroke-linejoin="round"/>`,
    sparkles: sparkle(58, 40, 12) + sparkle(146, 170, 8, '#fff', 0.8),
    sheenClip: `<polygon points="${pts(L[0])}"/>`,
  };
}

// ─── 6) CROWN — altın kraliyet tacı ──────────────────────────────────────
function crown(p) {
  const body = `
    <path d="M28 150 L20 66 L62 104 L100 38 L138 104 L180 66 L172 150 Z" fill="url(#${p}gold)" stroke="#5a3200" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 150 L20 66 L62 104 L100 38 L100 150 Z" fill="url(#${p}goldL)" opacity=".55"/>
    <path d="M36 140 L30 88 L62 118 L100 60 L138 118 L170 88 L164 140" fill="none" stroke="#fff6c8" stroke-opacity=".55" stroke-width="2"/>
    <rect x="24" y="146" width="152" height="30" rx="8" fill="url(#${p}band)" stroke="#5a3200" stroke-width="3"/>
    <rect x="30" y="150" width="140" height="6" rx="3" fill="#fff6c8" opacity=".55"/>
    ${[[20, 64], [100, 36], [180, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="url(#${p}pearl)" stroke="#5a3200" stroke-width="2"/>`).join('')}
    ${gem(`${p}`, 100, 161, 13, 'ruby')} ${gem(`${p}`, 60, 161, 9, 'sap')} ${gem(`${p}`, 140, 161, 9, 'sap')}
    ${gem(`${p}`, 100, 112, 15, 'sap')}`;
  return {
    defs: lin(`${p}gold`, [[0, '#fff3a8'], [0.35, '#ffcc33'], [0.7, '#d8890b'], [1, '#7a4300']])
      + lin(`${p}goldL`, [[0, '#ffffff'], [1, '#ffd34d', 0]], 0, 0, 1, 1)
      + lin(`${p}band`, [[0, '#ffe680'], [0.5, '#e49b12'], [1, '#8a4c00']])
      + rad(`${p}pearl`, [[0, '#ffffff'], [0.6, '#f3e5ff'], [1, '#b49ad8']], 0.35, 0.3, 0.7)
      + rad(`${p}ruby`, [[0, '#ffd0d8'], [0.4, '#ff2d55'], [1, '#6d0019']], 0.35, 0.3, 0.75)
      + rad(`${p}sap`, [[0, '#d8f4ff'], [0.4, '#2f9bff'], [1, '#0a2a7a']], 0.35, 0.3, 0.75),
    body,
    outline: '',
    sparkles: sparkle(46, 70, 10) + sparkle(160, 128, 7, '#fff', 0.8) + sparkle(100, 30, 8, '#fff', 0.9),
    sheenClip: '<path d="M28 150 L20 66 L62 104 L100 38 L138 104 L180 66 L172 150 Z"/><rect x="24" y="146" width="152" height="30" rx="8"/>',
  };
}
function gem(p, x, y, r, kind) {
  const d = [[x, y - r], [x + r, y], [x, y + r], [x - r, y]];
  return `${poly(d, `url(#${p}${kind})`, 'stroke="#3a1d00" stroke-width="1.6"')}<path d="M${x - r * 0.45} ${y - r * 0.2} L${x} ${y - r * 0.65}" stroke="#fff" stroke-width="1.6" stroke-opacity=".8"/>`;
}

// ─── 7) STAR — beş kollu 3B (eğimli) yıldız ──────────────────────────────
function star(p) {
  const cx = 100, cy = 106, R = 84, r = 36;
  let s = '';
  const P = (rr, i) => [cx + rr * Math.cos(-Math.PI / 2 + (i * Math.PI) / 5), cy + rr * Math.sin(-Math.PI / 2 + (i * Math.PI) / 5)];
  const ring = Array.from({ length: 10 }, (_, i) => P(i % 2 ? r : R, i));
  for (let i = 0; i < 10; i++) {
    const a = ring[i], b = ring[(i + 1) % 10];
    s += poly([a, b, [cx, cy]], i % 2 ? `url(#${p}dark)` : `url(#${p}light)`, 'stroke="#7a3f00" stroke-width="1.2" stroke-opacity=".6" stroke-linejoin="round"');
  }
  s += `<circle cx="${cx}" cy="${cy}" r="12" fill="url(#${p}core)"/>`;
  return {
    defs: lin(`${p}light`, [[0, '#fffbe0'], [0.5, '#ffd84a'], [1, '#ffae1a']], 0, 0, 1, 1)
      + lin(`${p}dark`, [[0, '#ffb52e'], [0.6, '#e2780a'], [1, '#9a4400']], 0, 0, 1, 1)
      + rad(`${p}core`, [[0, '#ffffff'], [1, '#ffd84a', 0]])
      + lin(`${p}rim`, [[0, '#fff3b0'], [1, '#ff8a00']], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts(ring)}" fill="none" stroke="url(#${p}rim)" stroke-width="3.2" stroke-linejoin="round"/>`,
    sparkles: sparkle(52, 50, 10) + sparkle(160, 160, 9, '#fff', 0.85),
    sheenClip: `<polygon points="${pts(ring)}"/>`,
  };
}

// ─── 8) MYSTERY GEM — dumanlı mor kristal, içinde parlayan rün ────────────
function mystery(p) {
  const hex = [[100, 18], [156, 58], [156, 150], [100, 190], [44, 150], [44, 58]];
  const c = [100, 104];
  let s = '';
  const shades = [`url(#${p}m0)`, `url(#${p}m1)`, `url(#${p}m2)`, `url(#${p}m3)`, `url(#${p}m2)`, `url(#${p}m1)`];
  for (let i = 0; i < 6; i++) s += poly([hex[i], hex[(i + 1) % 6], c], shades[i], 'stroke="#d9b8ff" stroke-width="1.1" stroke-opacity=".5"');
  s += `<ellipse cx="100" cy="106" rx="40" ry="56" fill="url(#${p}mist)" style="mix-blend-mode:screen"/>`;
  s += `<path d="M84 84 Q84 66 100 66 Q118 66 118 82 Q118 94 104 100 Q100 102 100 112 M100 126 L100 128" stroke="url(#${p}rune)" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  s += `<path d="M84 84 Q84 66 100 66 Q118 66 118 82 Q118 94 104 100 Q100 102 100 112 M100 126 L100 128" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"/>`;
  return {
    defs: lin(`${p}m0`, [[0, '#d7b4ff'], [1, '#6a2bd1']]) + lin(`${p}m1`, [[0, '#9b5cff'], [1, '#3a0f8a']])
      + lin(`${p}m2`, [[0, '#5a1fc0'], [1, '#1a0545']]) + lin(`${p}m3`, [[0, '#2c0a6b'], [1, '#0d0226']])
      + rad(`${p}mist`, [[0, '#ff7af5', 0.55], [0.6, '#8a4dff', 0.25], [1, '#000', 0]])
      + lin(`${p}rune`, [[0, '#ffb3ff'], [1, '#7a5cff']]) + lin(`${p}rim`, [[0, '#ff8af0'], [1, '#6c4bff']], 0, 0, 1, 1),
    body: s,
    outline: `<polygon points="${pts(hex)}" fill="none" stroke="url(#${p}rim)" stroke-width="3.4" stroke-linejoin="round"/>`,
    sparkles: sparkle(64, 46, 10, '#ffd6ff') + sparkle(140, 168, 7, '#fff', 0.8),
    sheenClip: `<polygon points="${pts(hex)}"/>`,
  };
}

// ─── 9) WILD — altın çerçeveli mor kalkan + WILD yazısı ──────────────────
function wild(p) {
  const shield = 'M100 14 L178 44 L170 122 Q160 168 100 194 Q40 168 30 122 L22 44 Z';
  const inner = 'M100 30 L162 54 L156 120 Q148 156 100 178 Q52 156 44 120 L38 54 Z';
  const body = `
    <path d="${shield}" fill="url(#${p}gold)" stroke="#5a3200" stroke-width="3"/>
    <path d="${inner}" fill="url(#${p}violet)"/>
    <path d="M100 30 L162 54 L156 120 Q148 156 100 178 Z" fill="#000" opacity=".22"/>
    <path d="M100 30 L38 54 L44 120 Q52 156 100 178 L100 30" fill="url(#${p}shine)" opacity=".5"/>
    <g transform="translate(100 72)">${poly([[0, -22], [20, 0], [0, 22], [-20, 0]], `url(#${p}gem)`, 'stroke="#fff" stroke-width="1.5" stroke-opacity=".7"')}
      ${poly([[0, -22], [20, 0], [0, 0]], '#fff', 'opacity=".35"')}</g>
    <g font-family="'Arial Black','Segoe UI Black',Impact,sans-serif" font-weight="900" font-size="44" text-anchor="middle" letter-spacing="1">
      <text x="100" y="140" fill="#3a1100" opacity=".55" transform="translate(0 4)">WILD</text>
      <text x="100" y="140" fill="url(#${p}text)" stroke="#5a2a00" stroke-width="2.2" paint-order="stroke">WILD</text>
    </g>`;
  return {
    defs: lin(`${p}gold`, [[0, '#fff3a8'], [0.4, '#ffc93a'], [0.75, '#c7780b'], [1, '#6d3a00']], 0, 0, 1, 1)
      + lin(`${p}violet`, [[0, '#b04dff'], [0.55, '#5b17c9'], [1, '#22055e']])
      + lin(`${p}shine`, [[0, '#ffffff', 0.7], [1, '#ffffff', 0]], 0, 0, 1, 1)
      + lin(`${p}gem`, [[0, '#e6fbff'], [0.5, '#46c8ff'], [1, '#1252c9']], 0, 0, 1, 1)
      + lin(`${p}text`, [[0, '#ffffff'], [0.35, '#ffe680'], [0.7, '#ffb31a'], [1, '#c76a00']])
      + lin(`${p}rim`, [[0, '#ff7af5'], [1, '#ffd24a']], 0, 0, 1, 1),
    body,
    outline: `<path d="${shield}" fill="none" stroke="url(#${p}rim)" stroke-width="3" stroke-opacity=".9"/>`,
    sparkles: sparkle(150, 40, 11) + sparkle(46, 150, 8, '#fff', 0.85),
    sheenClip: `<path d="${shield}"/>`,
  };
}

// ─── 10) BONUS — mor kristal sandık ──────────────────────────────────────
function chest(p, { open = 0 } = {}) {
  const lidY = -open * 34;
  const body = `
    <g>
      <path d="M26 104 L174 104 L166 182 L34 182 Z" fill="url(#${p}box)" stroke="#3a0f6b" stroke-width="3" stroke-linejoin="round"/>
      ${poly([[26, 104], [62, 104], [66, 182], [34, 182]], `url(#${p}fa)`, 'opacity=".9"')}
      ${poly([[138, 104], [174, 104], [166, 182], [134, 182]], `url(#${p}fb)`, 'opacity=".9"')}
      ${poly([[62, 104], [100, 104], [100, 182], [66, 182]], `url(#${p}fc)`, 'opacity=".55"')}
      <rect x="22" y="100" width="156" height="12" rx="4" fill="url(#${p}gold)" stroke="#5a3200" stroke-width="2"/>
      <rect x="40" y="104" width="14" height="78" fill="url(#${p}goldV)"/><rect x="146" y="104" width="14" height="78" fill="url(#${p}goldV)"/>
      <rect x="28" y="172" width="144" height="12" rx="4" fill="url(#${p}gold)" stroke="#5a3200" stroke-width="2"/>
      <path d="M86 112 h28 v26 q0 12 -14 16 q-14 -4 -14 -16 z" fill="url(#${p}gold)" stroke="#5a3200" stroke-width="2"/>
      <circle cx="100" cy="128" r="5" fill="#2a0a50"/><rect x="98" y="128" width="4" height="12" fill="#2a0a50"/>
    </g>
    <g class="lid" transform="translate(0 ${lidY})">
      <path d="M22 104 Q22 52 100 46 Q178 52 178 104 Z" fill="url(#${p}lid)" stroke="#3a0f6b" stroke-width="3"/>
      <path d="M40 98 Q44 64 100 58" stroke="#fff" stroke-opacity=".55" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M44 100 Q46 60 56 54 L66 54 Q58 66 58 100 Z" fill="url(#${p}goldV)"/>
      <path d="M156 100 Q154 60 144 54 L134 54 Q142 66 142 100 Z" fill="url(#${p}goldV)"/>
      ${poly([[100, 44], [118, 64], [100, 84], [82, 64]], `url(#${p}gem)`, 'stroke="#fff" stroke-width="1.6" stroke-opacity=".8"')}
      ${poly([[100, 44], [118, 64], [100, 64]], '#fff', 'opacity=".45"')}
    </g>
    <rect class="seam" x="30" y="${100 + lidY}" width="140" height="${Math.max(0, -lidY) + 4}" fill="url(#${p}seam)" opacity="${0.6 + open * 0.4}"/>`;
  return {
    defs: lin(`${p}box`, [[0, '#9d4dff'], [0.5, '#5a17c4'], [1, '#26075e']])
      + lin(`${p}lid`, [[0, '#d8a8ff'], [0.4, '#8a3df5'], [1, '#3a0d8a']])
      + lin(`${p}fa`, [[0, '#e3c4ff', 0.9], [1, '#7a2bdc', 0.6]], 0, 0, 1, 1)
      + lin(`${p}fb`, [[0, '#4c13a8'], [1, '#1d0447']], 0, 0, 1, 1)
      + lin(`${p}fc`, [[0, '#ffffff', 0.5], [1, '#ffffff', 0]], 0, 0, 1, 1)
      + lin(`${p}gold`, [[0, '#fff3a8'], [0.45, '#ffc93a'], [1, '#a45d00']])
      + lin(`${p}goldV`, [[0, '#ffe680'], [0.5, '#e09612'], [1, '#8a4c00']], 0, 0, 1, 0)
      + lin(`${p}gem`, [[0, '#e6fbff'], [0.5, '#46c8ff'], [1, '#1252c9']], 0, 0, 1, 1)
      + lin(`${p}seam`, [[0, '#ffffff'], [0.5, '#ffe9a8'], [1, '#ff9af5', 0]]),
    body,
    outline: '',
    sparkles: sparkle(32, 50, 10) + sparkle(170, 70, 8, '#fff', 0.9) + sparkle(100, 196, 7, '#ffd6ff', 0.8),
    sheenClip: '<path d="M26 104 L174 104 L166 182 L34 182 Z"/><path d="M22 104 Q22 52 100 46 Q178 52 178 104 Z"/>',
  };
}

// ─── Paletler ───────────────────────────────────────────────────────────────
const PAL = {
  blue: {
    f: [['#f2fdff', '#9be9ff'], ['#bdf3ff', '#36b6ff'], ['#7fdcff', '#1f86f0'], ['#e8fbff', '#58c4ff'],
      ['#4fbfff', '#1554c9'], ['#2a8dff', '#0a2a8a'], ['#1a63d6', '#071a5c'], ['#62d2ff', '#123d9e']],
    edge: '#e6fbff', neon: ['#7ff6ff', '#8a6bff'], glow: '#38c8ff',
  },
  purple: {
    f: [['#fbeaff', '#d79bff'], ['#e6b8ff', '#a24dff'], ['#c98aff', '#7a2df0'], ['#b06bff', '#5414c4'],
      ['#9a4dff', '#3f0d9e'], ['#7a2df0', '#2a0670'], ['#e2a8ff', '#8a3df5'], ['#5c1fc9', '#1f0452']],
    edge: '#f6e0ff', neon: ['#ff7af5', '#7a5cff'], glow: '#b05cff',
  },
  gold: {
    f: [['#fffbe0', '#ffd84a'], ['#fff1a8', '#f0b21a'], ['#ffe680', '#d98e0b'], ['#ffd34d', '#b86a00'],
      ['#f0b21a', '#8a4c00'], ['#d98e0b', '#6d3a00'], ['#c7780b', '#4f2a00']],
    edge: '#fff6c8', neon: ['#fff3b0', '#ff9a1a'], glow: '#ffc233',
  },
  ruby: {
    f: [['#ffe0e6', '#ff8aa0'], ['#ff8aa0', '#e0123c'], ['#ff5c7a', '#b0002a'], ['#ff3b5c', '#8a0022'],
      ['#e0123c', '#5c0016'], ['#c4002e', '#40000f'], ['#ff2d55', '#6d0019']],
    edge: '#ffd6dc', neon: ['#ff8aa0', '#ff2d55'], glow: '#ff2d55',
  },
  emerald: {
    f: [['#e0fff0', '#7dffbf'], ['#9dffd0', '#22d27c'], ['#5ff0a6', '#0fa35a'], ['#2ee089', '#0a7a43'],
      ['#17c06c', '#05592f'], ['#0fa35a', '#033d20'], ['#0a7a43', '#022b17']],
    edge: '#e6fff2', neon: ['#9dffd0', '#1fd8ff'], glow: '#2ee089',
  },
};

// ─── Sembol tanımları ───────────────────────────────────────────────────────
export const SYMBOL_ART = {
  blue:    { glow: PAL.blue.glow,    draw: (p) => brilliantSide(p, PAL.blue),    anim: 'sway' },
  purple:  { glow: PAL.purple.glow,  draw: (p) => brilliantTop(p, PAL.purple),   anim: 'spin' },
  gold:    { glow: PAL.gold.glow,    draw: (p) => princess(p, PAL.gold),         anim: 'sway' },
  ruby:    { glow: PAL.ruby.glow,    draw: (p) => cushion(p, PAL.ruby),          anim: 'pulse' },
  emerald: { glow: PAL.emerald.glow, draw: (p) => emeraldCut(p, PAL.emerald),    anim: 'sway' },
  crown:   { glow: '#ffc233',        draw: (p) => crown(p),                      anim: 'bob' },
  star:    { glow: '#ffb31a',        draw: (p) => star(p),                       anim: 'spin' },
  mystery: { glow: '#c45cff',        draw: (p) => mystery(p),                    anim: 'pulse' },
  wild:    { glow: '#ff7af5',        draw: (p) => wild(p),                       anim: 'bob' },
  bonus:   { glow: '#b05cff',        draw: (p, o) => chest(p, o),                anim: 'bob' },
};

/**
 * Bir sembolün SVG metnini üretir.
 * @param {string} id sembol kimliği
 * @param {'normal'|'blur'|'win'|'glow'} variant
 * @param {{ open?: number, size?: number }} opts (BONUS sandığında kapak açıklığı 0..1)
 */
export function symbolSVG(id, variant = 'normal', opts = {}) {
  const art = SYMBOL_ART[id];
  if (!art) throw new Error(`Bilinmeyen sembol: ${id}`);
  const p = `${id}-${variant}-`;
  const a = art.draw(p, opts);
  const halo = variant === 'normal' ? 0.55 : variant === 'blur' ? 0.25 : 1;
  const size = opts.size ?? 200;
  const blurF = variant === 'blur'
    ? `<filter id="${p}mb" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="0 10"/></filter>` : '';
  const winF = variant === 'win' || variant === 'glow'
    ? `<filter id="${p}bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feColorMatrix in="b" type="matrix" values="1.6 0 0 0 .14  0 1.6 0 0 .14  0 0 1.6 0 .14  0 0 0 1 0" result="bb"/><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : '';
  const content = `
    <ellipse cx="100" cy="186" rx="62" ry="10" fill="url(#${p}shadow)"/>
    <g filter="${variant === 'win' || variant === 'glow' ? `url(#${p}bloom)` : ''}">
      ${a.body}
      ${a.outline}
      <g clip-path="url(#${p}clip)"><rect class="sheen" x="-200" y="0" width="400" height="200" fill="url(#${p}sheen)" opacity="${variant === 'normal' ? 0.35 : 0.7}"/></g>
    </g>
    ${variant === 'blur' ? '' : a.sparkles}`;
  return `<svg xmlns="${NS}" viewBox="0 0 200 200" width="${size}" height="${size}">
  <defs>${baseDefs(p, art.glow)}${a.defs}<clipPath id="${p}clip">${a.sheenClip}</clipPath>${blurF}${winF}</defs>
  <circle cx="100" cy="104" r="${variant === 'normal' ? 92 : 100}" fill="url(#${p}halo)" opacity="${halo}"/>
  ${variant === 'blur' ? `<g filter="url(#${p}mb)" opacity=".92">${content}</g>` : content}
</svg>`;
}

/** Bütün semboller × görünümler için Blob URL önbelleği (tarayıcı). */
const urlCache = new Map();
export function symbolURL(id, variant = 'normal') {
  const key = `${id}:${variant}`;
  let url = urlCache.get(key);
  if (!url) {
    const blob = new Blob([symbolSVG(id, variant)], { type: 'image/svg+xml' });
    url = URL.createObjectURL(blob);
    urlCache.set(key, url);
  }
  return url;
}

/** Görselleri önceden çözümler (ilk dönüşte takılma olmasın). */
export async function preloadSymbols(ids, variants = ['normal', 'blur', 'win']) {
  const jobs = [];
  for (const id of ids) for (const v of variants) {
    const img = new Image();
    img.src = symbolURL(id, v);
    jobs.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  }
  await Promise.all(jobs);
}

export const SYMBOL_ANIM = Object.fromEntries(Object.entries(SYMBOL_ART).map(([k, v]) => [k, v.anim]));
export const SYMBOL_GLOW = Object.fromEntries(Object.entries(SYMBOL_ART).map(([k, v]) => [k, v.glow]));
