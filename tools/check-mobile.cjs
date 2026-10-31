// Tarayıcı kalite kontrolü (Playwright):
//   python3 -m http.server 8844   (diamond_slot_web klasöründe)
//   node tools/check-mobile.cjs [http://127.0.0.1:8844]
// Her ekran boyutunda: yatay taşma yok, makine ve SPIN butonu görünür,
// 15 sembolün hepsi pencerenin içinde, dönüş sırasında kare hızı ölçülür,
// çevirme durum geçişleri tamamlanır.
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8844';
const SIZES = [
  ['Android küçük', 320, 568], ['Android 360', 360, 640], ['Uygulama paneli', 360, 520],
  ['iPhone SE', 375, 667], ['iPhone 14', 390, 844], ['Pixel 7', 412, 915],
  ['Tablet', 768, 1024], ['Masaüstü', 1366, 768],
];

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const [name, w, h] of SIZES) {
    const mobile = w < 700;
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/?demo=1&seed=5`);
    await page.waitForSelector('#loader', { state: 'detached', timeout: 10000 });

    const m = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const win = r('reel-window');
      const cells = [...document.querySelectorAll('.reel')].flatMap((reel) => {
        const rr = reel.getBoundingClientRect();
        return [0, 1, 2].map((row) => ({ top: rr.top + row * rr.width, bottom: rr.top + (row + 1) * rr.width, left: rr.left, right: rr.right }));
      });
      const inWin = cells.filter((c) => c.left >= win.left - 1 && c.right <= win.right + 1 && c.top >= win.top - 1 && c.bottom <= win.bottom + 1).length;
      const spin = r('btn-spin');
      const machine = r('machine');
      return {
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight,
        machineIn: machine.left >= -1 && machine.right <= innerWidth + 1 && machine.top >= -1 && machine.bottom <= innerHeight + 1,
        spinIn: spin.bottom <= innerHeight + 1 && spin.top >= 0,
        spinSize: Math.round(spin.width),
        reels: document.querySelectorAll('.reel').length,
        cellsVisible: inWin,
      };
    });

    // dönüş sırasında kare hızı
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      document.getElementById('btn-spin').click();
      const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); };
      requestAnimationFrame(f);
    }));
    await page.waitForFunction(() => document.getElementById('app').dataset.state === 'idle', null, { timeout: 15000 });
    const log = await page.evaluate(() => window.__diamond.sm.log.join(' '));

    const ok = !m.overflowX && !m.overflowY && m.machineIn && m.spinIn && m.spinSize >= 72 && m.reels === 5 && m.cellsVisible === 15 && !errors.length && log.includes('presenting>idle');
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'HATA'} ${name.padEnd(16)} ${w}x${h}  makara=${m.reels} görünür=${m.cellsVisible}/15 spin=${m.spinSize}px fps≈${fps} taşma=${m.overflowX || m.overflowY} ${errors.join(' | ')}`);
    await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/ds_${w}x${h}.png` });
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
