import type { SlipInput, SlipComputed } from '@/lib/arbMath';
import { computeSlip, round2 } from '@/lib/arbMath';

export type ParlayGroup = {
  id: string;
  label: string;
  headerBook?: string;
  headerOddsAmerican?: number;
  parlayDesc: string;
  note?: string;
  slips: SlipInput[];
};

export type ParlayGroupComputed = {
  slips: SlipComputed[];
  totalPayout: number;
  totalCashAtRisk: number;
  totalNetPayout: number;
};

export type ParlayArbComputed = {
  groups: ParlayGroupComputed[];
  netWins: number[];
};

export function computeParlayGroup(group: ParlayGroup): ParlayGroupComputed {
  const slips = group.slips.map(computeSlip);

  const totalPayout = round2(slips.reduce((s, x) => s + x.payout, 0));
  const totalCashAtRisk = round2(slips.reduce((s, x) => s + x.cashAtRisk, 0));
  const totalNetPayout = round2(slips.reduce((s, x) => s + x.netPayout, 0));

  return { slips, totalPayout, totalCashAtRisk, totalNetPayout };
}

export function computeParlayArb(groups: ParlayGroup[]): ParlayArbComputed {
  const computedGroups = groups.map(computeParlayGroup);

  const netWins = computedGroups.map((g, i) => {
    const otherRisk = computedGroups.reduce((sum, x, j) => (j === i ? sum : sum + x.totalCashAtRisk), 0);
    return round2(g.totalNetPayout - otherRisk);
  });

  return { groups: computedGroups, netWins };
}
