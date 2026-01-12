// lib/parlayArbMath.ts
// Parlay Arb math: mutually exclusive outcome buckets

import type { SlipInput, SlipComputed } from '@/lib/arbMath'
import { computeSlip, round2 } from '@/lib/arbMath'

/* =======================
   Types
======================= */

export type ParlayGroup = {
  id: string

  // User-facing label (e.g. "Team Favs", "Team Mix 1")
  label: string

  // Optional header info (display only)
  headerBook?: string
  headerOddsAmerican?: number

  // Description like "Parlay CHI & LAC"
  parlayDesc: string

  // Optional freeform note
  note?: string

  // One or more stake lines for this outcome
  slips: SlipInput[]
}

export type ParlayGroupComputed = {
  slips: SlipComputed[]
  totalPayout: number
  totalCashAtRisk: number
  totalNetPayout: number
}

export type ParlayArbComputed = {
  groups: ParlayGroupComputed[]

  /**
   * Net win if bucket i is the realized outcome:
   * netWins[i] = groups[i].totalNetPayout
   *              − sum(other groups' totalCashAtRisk)
   */
  netWins: number[]
}

/* =======================
   Core Computation
======================= */

export function computeParlayGroup(
  group: ParlayGroup,
): ParlayGroupComputed {
  const slips = group.slips.map(computeSlip)

  const totalPayout = round2(
    slips.reduce((s, x) => s + x.payout, 0),
  )

  const totalCashAtRisk = round2(
    slips.reduce((s, x) => s + x.cashAtRisk, 0),
  )

  const totalNetPayout = round2(
    slips.reduce((s, x) => s + x.netPayout, 0),
  )

  return {
    slips,
    totalPayout,
    totalCashAtRisk,
    totalNetPayout,
  }
}

/**
 * Compute Parlay Arb across N outcome buckets.
 *
 * Exactly one bucket is assumed to hit.
 */
export function computeParlayArb(
  groups: ParlayGroup[],
): ParlayArbComputed {
  const computedGroups = groups.map(computeParlayGroup)

  const netWins = computedGroups.map((g, i) => {
    const otherRisk = computedGroups.reduce(
      (sum, x, j) => (j === i ? sum : sum + x.totalCashAtRisk),
      0,
    )
    return round2(g.totalNetPayout - otherRisk)
  })

  return {
    groups: computedGroups,
    netWins,
  }
}
