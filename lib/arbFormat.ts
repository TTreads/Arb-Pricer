import type { ArbComputed } from '@/lib/arbMath';
import type { ParlayArbComputed } from '@/lib/parlayArbMath';

export function fmtMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

export function fmtX(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(2)}x`;
}

export function get2LegOutcomeCards(computed: ArbComputed) {
  return [
    { title: 'Net win if Left wins', value: computed.netWinIfLeg0Wins },
    { title: 'Net win if Right wins', value: computed.netWinIfLeg1Wins },
  ];
}

export function getParlayOutcomeCards(computed: ParlayArbComputed) {
  return computed.netWins.map((v, i) => ({ title: `Net win if Bucket ${i + 1} hits`, value: v }));
}

export function minNumber(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((m, x) => (x < m ? x : m), arr[0]);
}

export function maxNumber(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((m, x) => (x > m ? x : m), arr[0]);
}
