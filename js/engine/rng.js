// Rastgele sayı kaynağı arayüzü.
//
// Motor yalnız `next()` (0 ≤ x < 1) kullanır; böylece testlerde tohumlu
// (tekrarlanabilir) kaynak, oyunda kriptografik kaynak verilebilir.
//
//   interface RandomSource { next(): number }

/** Tarayıcının kriptografik üretecini kullanır (oyun). */
export function cryptoRandom() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Güvenli rastgele sayı üreteci bulunamadı');
  }
  const buf = new Uint32Array(64);
  let i = buf.length;
  return {
    next() {
      if (i >= buf.length) { c.getRandomValues(buf); i = 0; }
      return buf[i++] / 4294967296;
    },
  };
}

/** Tohumlu, tekrarlanabilir üreteç (mulberry32) — testler ve şerit kurulumu. */
export function seededRandom(seed = 1) {
  let a = (seed >>> 0) || 1;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Sırayla verilen değerleri döndüren üreteç (testlerde belirli sonuç zorlamak için). */
export function sequenceRandom(values) {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}

/** 0 ≤ n < max tamsayı. */
export function randInt(rng, max) {
  return Math.min(max - 1, Math.floor(rng.next() * max));
}

/** Ağırlıklı seçim: items[i].weight. */
export function weightedPick(rng, items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = rng.next() * total;
  for (const it of items) {
    r -= it.weight;
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
