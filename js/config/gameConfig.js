// DIAMOND SLOT — TEK AYAR DOSYASI
// ---------------------------------------------------------------------------
// Oyunun bütün ayarları burada toplanır: semboller, makara yapısı, ödeme
// tablosu, animasyon süreleri, demo kredi, bahis seviyeleri, ses ve efekt
// yoğunluğu. Başka dosyalarda sabit sayı tutulmaz; hepsi buradan okunur.
//
// BAKİYE: Uygulama içinde oyun GERÇEK KRİSTAL (`profiles.crystals`) ile
// oynanır; sonuç ve bakiye SUNUCUDA hesaplanır (`diamond_spin`,
// supabase_faz88_diamond_slot.sql). `?demo=1` ile açılan sayfa yalnız
// tarayıcıda tutulan DEMO KREDİ kullanır; demo kredi kristale dönüşmez.
//
// SUNUCU İLE AYNI OLMALI: SYMBOLS (ödeme + ağırlık), PAYLINES, BONUS_*,
// CREDITS.betLevels, MAX_WIN_X. SQL dosyası `tools/gen-sql.mjs` ile BU
// dosyadan üretilir; elle değiştirme.

export const GAME_ID = 'diamond-slot';
export const GAME_VERSION = '1.0.0';

/** Makara düzeni: 5 sütun × 3 satır = 15 görünür sembol. */
export const REELS = 5;
export const ROWS = 3;

/**
 * Semboller. `pays` = 3/4/5 eşleşmede ödeme, ÇİZGİ BAHSİNİN katı
 * (çizgi bahsi = toplam bahis / çizgi sayısı).
 * `weights` = her makara şeridinde sembolün kaç kez geçtiği (5 makara).
 */
export const SYMBOLS = [
  { id: 'blue',    name: 'Blue Diamond',   tier: 'premium', pays: { 3: 60, 4: 300, 5: 2000 }, weights: [3, 3, 3, 3, 3] },
  { id: 'purple',  name: 'Purple Diamond', tier: 'premium', pays: { 3: 50, 4: 200, 5: 1000 }, weights: [4, 4, 4, 4, 4] },
  { id: 'gold',    name: 'Gold Diamond',   tier: 'premium', pays: { 3: 40, 4: 150, 5: 750 }, weights: [4, 4, 4, 4, 4] },
  { id: 'ruby',    name: 'Ruby',           tier: 'gem',     pays: { 3: 25, 4: 80,  5: 300 }, weights: [5, 5, 5, 5, 5] },
  { id: 'emerald', name: 'Emerald',        tier: 'gem',     pays: { 3: 20, 4: 60,  5: 250 }, weights: [6, 6, 6, 6, 6] },
  { id: 'crown',   name: 'Crown',          tier: 'royal',   pays: { 3: 15, 4: 40,  5: 150 }, weights: [7, 7, 7, 7, 7] },
  { id: 'star',    name: 'Star',           tier: 'royal',   pays: { 3: 9,  4: 30,  5: 100 }, weights: [8, 8, 8, 8, 8] },
  { id: 'mystery', name: 'Mystery Gem',    tier: 'royal',   pays: { 3: 7,  4: 25,  5: 80  }, weights: [9, 9, 9, 9, 9] },
  // WILD: BONUS dışındaki her sembolün yerine geçer; yalnız 2-3-4. makarada.
  { id: 'wild',    name: 'Wild',           tier: 'special', pays: { 3: 80, 4: 400, 5: 4000 }, weights: [0, 2, 2, 2, 0], wild: true },
  // BONUS: herhangi bir yerde 3+ → Kristal Sandık bonus turu.
  { id: 'bonus',   name: 'Bonus',          tier: 'special', pays: {},                          weights: [2, 2, 2, 2, 2], scatter: true },
];

export const WILD_ID = 'wild';
export const BONUS_ID = 'bonus';

/** Bonus turunu açan en az BONUS sembolü sayısı (ekranın herhangi bir yerinde). */
export const BONUS_TRIGGER = 3;

/**
 * Bonus sandığı ödülleri. `mult` = toplam bahsin katı (kristal).
 * Bonus sembolü sayısı arttıkça (4, 5) ödül çarpanı da artar.
 */
export const BONUS_REWARDS = [
  { id: 'c5',   mult: 5,   weight: 30 },
  { id: 'c8',   mult: 8,   weight: 25 },
  { id: 'c12',  mult: 12,  weight: 19 },
  { id: 'c20',  mult: 20,  weight: 13 },
  { id: 'c35',  mult: 35,  weight: 8 },
  { id: 'c60',  mult: 60,  weight: 4 },
  { id: 'c100', mult: 100, weight: 1 },
];
export const BONUS_COUNT_BOOST = { 3: 1, 4: 2, 5: 4 };

/** 20 ödeme çizgisi (her değer: o makaradaki satır, 0 = üst). */
export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
];

/** Kazanç sınıfları (toplam bahsin katı). */
export const WIN_TIERS = {
  big: 15,    // ≥ 15× → DIAMOND WIN! ekranı
  mega: 50,   // ≥ 50× → daha uzun ve yoğun DIAMOND WIN
};

/** Tek çevirmede en yüksek kazanç: bahis × MAX_WIN_X. */
export const MAX_WIN_X = 5000;

/** Bahis (kristal) + demo kredi. */
export const CREDITS = {
  betLevels: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
  defaultBet: 500,
  /** Yalnız `?demo=1`: tarayıcıdaki demo kredi başlangıcı / yenileme tutarı. */
  demoStart: 100000,
};

/** Otomatik dönüş seçenekleri. */
export const AUTO_SPIN_OPTIONS = [10, 25, 50, 100];

/** Animasyon süreleri (ms). Reduced Motion açıksa `reducedMotionScale` ile kısalır. */
export const TIMING = {
  spinUpMs: 160,            // ilk geri tepme + hızlanma
  minSpinMs: 620,           // ilk makaranın en az dönme süresi
  reelStaggerMs: 210,       // makaralar arası duruş farkı
  anticipationExtraMs: 900, // 2 BONUS geldiyse kalan makaralar daha uzun döner
  stopEaseMs: 420,          // yavaşlama + mekanik geri yaylanma
  maxSpeedCellsPerSec: 26,  // tam hızda saniyede geçen sembol
  smallWinMs: 1500,
  bigWinMs: 4600,
  megaWinMs: 6200,
  autoSpinGapMs: 350,
  reducedMotionScale: 0.45,
};

/** Ses. Sesler tarayıcıda üretilir (dosya gerekmez). */
export const SOUND = {
  musicDefault: true,
  sfxDefault: true,
  musicVolume: 0.16,
  sfxVolume: 0.55,
};

/** Görsel efekt yoğunluğu: 'high' | 'medium' | 'low' (cihaza göre otomatik). */
export const FX = {
  intensity: 'auto',
  particles: { high: 70, medium: 42, low: 18 },
  shards: { high: 90, medium: 55, low: 24 },
  maxDpr: 2,
};

/** Kayıt. */
export const STORAGE = {
  prefix: 'retra-diamond-slot:v1:',
  historySize: 10,
};

export const CONFIG = {
  GAME_ID, GAME_VERSION, REELS, ROWS, SYMBOLS, WILD_ID, BONUS_ID, BONUS_TRIGGER,
  BONUS_REWARDS, BONUS_COUNT_BOOST, PAYLINES, WIN_TIERS, MAX_WIN_X, CREDITS, AUTO_SPIN_OPTIONS,
  TIMING, SOUND, FX, STORAGE,
};
export default CONFIG;
