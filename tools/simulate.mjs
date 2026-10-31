// RTP simülasyonu: node tools/simulate.mjs [tur] [bahis]
import { spin } from '../js/engine/slotEngine.js';
import { seededRandom } from '../js/engine/rng.js';
const N = Number(process.argv[2] || 500000), bet = Number(process.argv[3] || 1000);
const rng = seededRandom(7);
let paid = 0, line = 0, bonusPaid = 0, hits = 0, bonuses = 0, big = 0, mega = 0, max = 0;
for (let i = 0; i < N; i++) {
  const r = spin(rng, bet);
  paid += r.totalWin; line += r.lineTotal;
  if (r.totalWin > 0) hits++;
  if (r.bonus) { bonuses++; bonusPaid += r.bonus.reward.amount; }
  if (r.tier === 'big') big++; if (r.tier === 'mega') mega++;
  max = Math.max(max, r.totalWin / bet);
}
const pct = (x) => (100 * x).toFixed(2) + '%';
console.log(`tur ${N} · RTP ${pct(paid / (N * bet))} (çizgi ${pct(line / (N * bet))}, bonus ${pct(bonusPaid / (N * bet))})`);
console.log(`kazanma sıklığı ${pct(hits / N)} · bonus 1/${(N / Math.max(1, bonuses)).toFixed(0)} · büyük 1/${(N / Math.max(1, big)).toFixed(0)} · mega 1/${(N / Math.max(1, mega)).toFixed(0)} · en yüksek ${max.toFixed(1)}x`);
