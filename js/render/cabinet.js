// SLOT MAKİNESİ KASASI — altın + neon mor, siyah metal gövde (SVG).
// Kasa, ekran boyutuna göre HER YENİDEN BOYUTLANMADA tam piksel ölçüsünde
// yeniden çizilir; böylece her ekranda keskin kalır.
// Ayrıca: DIAMOND SLOT logosu (SVG) ve yan ışık sütunları (ampuller).

const r2 = (n) => Math.round(n * 10) / 10;

/**
 * Makine yerleşimini hesaplar.
 * @param {number} availW kullanılabilir genişlik (px)
 * @param {number} availH kullanılabilir yükseklik (px)
 */
export function computeLayout(availW, availH, reels = 5, rows = 3) {
  // Oranlar makine genişliğine (W) göre.
  const ratio = (W) => {
    const side = Math.max(14, W * 0.055);       // yan çerçeve
    const gap = Math.max(3, W * 0.012);         // makara arası
    const cell = (W - side * 2 - gap * (reels - 1)) / reels;
    const marquee = Math.max(64, W * 0.2);      // üst logo alanı
    const top = Math.max(10, W * 0.03);         // pencere üstü
    const bottom = Math.max(18, W * 0.06);      // alt kaide
    const winH = cell * rows;
    const H = marquee + top + winH + bottom;
    return { W, side, gap, cell, marquee, top, bottom, winH, H };
  };
  let W = Math.min(availW, 620);
  let L = ratio(W);
  if (L.H > availH) {
    // yüksekliğe sığdır
    W = Math.max(240, W * (availH / L.H));
    L = ratio(W);
  }
  return {
    ...L,
    winX: L.side,
    winY: L.marquee + L.top,
    winW: L.cell * reels + L.gap * (reels - 1),
  };
}

/**
 * Kasa üzerindeki ampullerin konumları. Ampuller SVG'nin içinde DEĞİL,
 * ayrı DOM katmanında çizilir: SVG her karede yeniden boyanmaz (performans).
 */
export function bulbSpots(L) {
  const { W, winX, winY, winW, winH, marquee } = L;
  const spots = [];
  const nb = Math.max(5, Math.round(winH / (W * 0.075)));
  const r = Math.max(2.4, W * 0.009);
  for (let i = 0; i < nb; i++) {
    const y = winY + (winH * (i + 0.5)) / nb;
    spots.push({ x: winX * 0.42, y, r, i, kind: 'side' });
    spots.push({ x: W - winX * 0.42, y, r, i: nb - i, kind: 'side' });
  }
  const nt = Math.max(9, Math.round(W / 34));
  const rt = Math.max(2.2, W * 0.008);
  for (let i = 0; i < nt; i++) {
    const t = i / (nt - 1);
    const x = W * 0.12 + t * W * 0.76;
    const y = marquee * 0.12 + Math.sin(t * Math.PI) * -marquee * 0.02 + marquee * 0.02;
    spots.push({ x, y, r: rt, i, kind: 'top' });
  }
  return spots;
}

/** Kasa SVG'si. */
export function cabinetSVG(L) {
  const { W, H, winX, winY, winW, winH, marquee } = L;
  const R = Math.max(14, W * 0.05);
  const rivet = (x, y) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(W * 0.011)}" fill="url(#cab-rivet)" stroke="#3a2200" stroke-width=".8"/>`;
  const archH = marquee * 0.86;
  const arch = `M${R} ${archH} Q${R} ${marquee * 0.06} ${W * 0.5} ${marquee * 0.02} Q${W - R} ${marquee * 0.06} ${W - R} ${archH} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="cabinet-svg" width="${W}" height="${H}" viewBox="0 0 ${r2(W)} ${r2(H)}">
<defs>
  <linearGradient id="cab-body" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a0f52"/><stop offset=".45" stop-color="#12052a"/><stop offset="1" stop-color="#05010e"/>
  </linearGradient>
  <linearGradient id="cab-metal" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3b1b70"/><stop offset=".5" stop-color="#170838"/><stop offset=".52" stop-color="#0b0320"/><stop offset="1" stop-color="#1f0b45"/>
  </linearGradient>
  <linearGradient id="cab-gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff4b0"/><stop offset=".22" stop-color="#ffc93a"/><stop offset=".48" stop-color="#9a5a00"/>
    <stop offset=".62" stop-color="#ffe17a"/><stop offset=".82" stop-color="#c47a08"/><stop offset="1" stop-color="#5e3300"/>
  </linearGradient>
  <linearGradient id="cab-gold-v" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#d48c0c"/><stop offset="1" stop-color="#6d3c00"/>
  </linearGradient>
  <radialGradient id="cab-rivet" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#e5a21a"/><stop offset="1" stop-color="#6d3c00"/></radialGradient>
  <linearGradient id="cab-window" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d0322"/><stop offset=".5" stop-color="#1c0844"/><stop offset="1" stop-color="#0d0322"/>
  </linearGradient>
</defs>

<!-- gövde -->
<g>
  <path d="${arch}" fill="url(#cab-metal)" stroke="url(#cab-gold)" stroke-width="${r2(W * 0.012)}"/>
  <rect x="${r2(W * 0.012)}" y="${r2(marquee * 0.7)}" width="${r2(W - W * 0.024)}" height="${r2(H - marquee * 0.7 - W * 0.006)}" rx="${r2(R)}" fill="url(#cab-body)" stroke="url(#cab-gold)" stroke-width="${r2(W * 0.014)}"/>
</g>
<rect x="${r2(W * 0.03)}" y="${r2(marquee * 0.76)}" width="${r2(W - W * 0.06)}" height="${r2(H - marquee * 0.76 - W * 0.022)}" rx="${r2(R * 0.8)}" fill="none" stroke="#ffe17a" stroke-opacity=".35" stroke-width="1"/>

<!-- üst kemer neon -->
<path class="neon" d="M${r2(R * 1.5)} ${r2(archH - 4)} Q${r2(R * 1.5)} ${r2(marquee * 0.16)} ${r2(W * 0.5)} ${r2(marquee * 0.12)} Q${r2(W - R * 1.5)} ${r2(marquee * 0.16)} ${r2(W - R * 1.5)} ${r2(archH - 4)}"
  fill="none" stroke="#c45cff" stroke-width="${r2(W * 0.008)}" stroke-linecap="round"/>

<!-- makara penceresi: altın çerçeve + neon iç kenar -->
<rect x="${r2(winX - W * 0.026)}" y="${r2(winY - W * 0.026)}" width="${r2(winW + W * 0.052)}" height="${r2(winH + W * 0.052)}" rx="${r2(W * 0.03)}" fill="url(#cab-gold)" stroke="#4a2800" stroke-width="1.2"/>
<rect x="${r2(winX - W * 0.012)}" y="${r2(winY - W * 0.012)}" width="${r2(winW + W * 0.024)}" height="${r2(winH + W * 0.024)}" rx="${r2(W * 0.02)}" fill="#07021a" stroke="#5e3300" stroke-width="1"/>
<rect x="${r2(winX)}" y="${r2(winY)}" width="${r2(winW)}" height="${r2(winH)}" rx="${r2(W * 0.012)}" fill="url(#cab-window)"/>
<rect class="neon" x="${r2(winX - W * 0.006)}" y="${r2(winY - W * 0.006)}" width="${r2(winW + W * 0.012)}" height="${r2(winH + W * 0.012)}" rx="${r2(W * 0.016)}" fill="none" stroke="#b44dff" stroke-width="${r2(Math.max(1.6, W * 0.005))}"/>

<!-- yan ışık sütunları -->
<rect x="${r2(winX * 0.2)}" y="${r2(winY)}" width="${r2(winX * 0.44)}" height="${r2(winH)}" rx="${r2(winX * 0.22)}" fill="#0a0220" stroke="url(#cab-gold-v)" stroke-width="1.4"/>
<rect x="${r2(W - winX * 0.64)}" y="${r2(winY)}" width="${r2(winX * 0.44)}" height="${r2(winH)}" rx="${r2(winX * 0.22)}" fill="#0a0220" stroke="url(#cab-gold-v)" stroke-width="1.4"/>

<!-- alt kaide -->
<path d="M${r2(W * 0.08)} ${r2(H - L.bottom * 0.75)} H${r2(W * 0.92)}" stroke="url(#cab-gold)" stroke-width="${r2(Math.max(2, W * 0.008))}" stroke-linecap="round"/>
<path class="neon" d="M${r2(W * 0.2)} ${r2(H - L.bottom * 0.42)} H${r2(W * 0.8)}" stroke="#7ff6ff" stroke-width="${r2(Math.max(1.4, W * 0.004))}" stroke-linecap="round" opacity=".8"/>
${rivet(W * 0.05, marquee * 0.82)}${rivet(W * 0.95, marquee * 0.82)}${rivet(W * 0.05, H - L.bottom * 0.6)}${rivet(W * 0.95, H - L.bottom * 0.6)}
</svg>`;
}

/** DIAMOND SLOT logosu (SVG).
 *
 * İçindeki parlama/parıltı animasyonları DOM katmanına taşındı: logo SVG'si
 * sabittir (her karede yeniden boyanmaz), hareket `.mq-shine` / `.mq-spark`
 * ile yapılır.
 */
export function logoSVG(width = 300) {
  const h = width * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="logo-svg" viewBox="0 0 300 90" width="${width}" height="${h}">
<defs>
  <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#fff0a0"/><stop offset=".55" stop-color="#ffb81f"/><stop offset=".56" stop-color="#d97a00"/><stop offset="1" stop-color="#ffe17a"/>
  </linearGradient>
  <linearGradient id="lg-violet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7af5"/><stop offset=".5" stop-color="#b44dff"/><stop offset="1" stop-color="#5ad8ff"/></linearGradient>
  <linearGradient id="lg-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eafcff"/><stop offset=".5" stop-color="#46c8ff"/><stop offset="1" stop-color="#2a3bd8"/></linearGradient>
  <linearGradient id="lg-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="lg-clip"><text x="150" y="50" text-anchor="middle" font-family="'Arial Black','Segoe UI Black',Impact,sans-serif" font-weight="900" font-size="40" letter-spacing="1.5">DIAMOND</text></clipPath>
</defs>
<g font-family="'Arial Black','Segoe UI Black',Impact,sans-serif" font-weight="900" text-anchor="middle">
  <text x="150" y="50" font-size="40" letter-spacing="1.5" fill="none" stroke="url(#lg-violet)" stroke-width="6.5" opacity=".75">DIAMOND</text>
  <text x="150" y="53" font-size="40" letter-spacing="1.5" fill="#2a0a00" opacity=".6">DIAMOND</text>
  <text x="150" y="50" font-size="40" letter-spacing="1.5" fill="url(#lg-gold)" stroke="#5a2a00" stroke-width="1.6" paint-order="stroke">DIAMOND</text>
  <rect x="98" y="60" width="104" height="22" rx="11" fill="#1a0640" stroke="url(#lg-violet)" stroke-width="2"/>
  <text x="150" y="77" font-size="16" letter-spacing="8" fill="#e8d4ff">SLOT</text>
</g>
<g transform="translate(150 10)">
  <polygon points="-12,0 12,0 18,6 0,22 -18,6" fill="url(#lg-gem)" stroke="#fff" stroke-width="1" stroke-opacity=".8" transform="translate(0 -6) scale(.7)"/>
</g>
<g fill="#fff">
  <path d="M28 46 l2 -7 l2 7 l7 2 l-7 2 l-2 7 l-2 -7 l-7 -2z" opacity=".75"/>
  <path d="M272 34 l1.5 -5 l1.5 5 l5 1.5 l-5 1.5 l-1.5 5 l-1.5 -5 l-5 -1.5z" opacity=".75"/>
</g>
</svg>`;
}
