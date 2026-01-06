import type { LegInput } from '@/lib/arbMath';
import type { ParlayGroup } from '@/lib/parlayArbMath';
import { computeArb, round2 } from '@/lib/arbMath';
import { computeParlayArb } from '@/lib/parlayArbMath';

export type BBEfficiencyResult = {
  totalBB: number;
  netWins: number[];
  efficiencies: number[];
  minEfficiency: number;
};

function sumBBFromSlips(slips: { promo?: { type?: string; bbValue?: number } }[]): number {
  return slips.reduce((sum, s) => {
    if (s.promo?.type === 'bonus_bet' && s.promo.bbValue) return sum + s.promo.bbValue;
    return sum;
  }, 0);
}

export function computeBBEfficiencyFromArb(legs: [LegInput, LegInput]): BBEfficiencyResult | null {
  const arb = computeArb(legs);
  const allSlips = [...legs[0].slips, ...legs[1].slips];

  const totalBB = round2(sumBBFromSlips(allSlips));
  if (totalBB <= 0) return null;

  const netWins = [arb.netWinIfLeg0Wins, arb.netWinIfLeg1Wins];
  const efficiencies = netWins.map((nw) => round2(nw / totalBB));

  return { totalBB, netWins, efficiencies, minEfficiency: Math.min(...efficiencies) };
}

export function computeBBEfficiencyFromParlay(groups: ParlayGroup[]): BBEfficiencyResult | null {
  const parlay = computeParlayArb(groups);
  const allSlips = groups.flatMap((g) => g.slips);

  const totalBB = round2(sumBBFromSlips(allSlips));
  if (totalBB <= 0) return null;

  const efficiencies = parlay.netWins.map((nw) => round2(nw / totalBB));

  return { totalBB, netWins: parlay.netWins, efficiencies, minEfficiency: Math.min(...efficiencies) };
}
