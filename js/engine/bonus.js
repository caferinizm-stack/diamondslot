// BONUS MODÜLÜ — Kristal Sandık (ödül çekilişi)
//
// Ödül, çevirme anında (animasyondan önce) motor tarafından çekilir; bonus
// ekranı yalnız bu önceden belirlenmiş ödülü canlandırır.

import CONFIG from '../config/gameConfig.js';
import { weightedPick } from './rng.js';

/**
 * @returns {{ id:string, mult:number, amount:number }}
 */
export function drawBonusReward(rng, bet, bonusCount, config = CONFIG) {
  const pick = weightedPick(rng, config.BONUS_REWARDS);
  const boost = config.BONUS_COUNT_BOOST[Math.min(5, bonusCount)] ?? 1;
  const mult = pick.mult * boost;
  return { id: pick.id, mult, amount: Math.round(bet * mult) };
}
