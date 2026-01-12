/**
 * lib/arbMath.ts
 * Core math utilities for Simple Arb, Multi-Stake Arb (2-leg), and Slip-level promos.
 */

/* =======================
   Types
======================= */

export type Side = 'dog' | 'fav'

export type PromoType =
  | 'none'
  | 'profit_boost'
  | 'odds_boost'
  | 'bonus_bet'
  | 'insured'

export type Promo = {
  type: PromoType
  boostPct?: number // % boost for profit / odds boost
  bbValue?: number  // face value of Bonus Bet (for tracking only)
  note?: string     // free-text user note
}

export type SlipInput = {
  id: string
  book: string               // DK, FD, MGM, PX, etc.
  oddsAmerican: number       // +112, -130, etc.
  stake: number              // cash stake entered by user
  promo?: Promo
  payoutOverride?: number | null // optional manual override
  note?: string
}

export type LegInput = {
  side: Side
  team: string
  market: string // ML, spread, total
  event: string  // e.g. WAS-PHI
  note?: string
  slips: SlipInput[]
}

export type SlipComputed = {
  decimalOddsEffective: number
  baseProfit: number
  promoProfit: number
  payout: number
  cashAtRisk: number
  netPayout: number
}

export type LegComputed = {
  slips: SlipComputed[]
  totalPayout: number
  totalCashAtRisk: number
  totalNetPayout: number
}

export type ArbComputed = {
  legs: [LegComputed, LegComputed]
  netWinIfLeg0Wins: number
  netWinIfLeg1Wins: number
}

/* =======================
   Helpers
======================= */

export function americanToDecimal(oddsAmerican: number): number {
  if (oddsAmerican > 0) return 1 + oddsAmerican / 100
  return 1 + 100 / Math.abs(oddsAmerican)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function normalizePromo(promo?: Promo): Promo {
  return {
    type: promo?.type ?? 'none',
    boostPct: promo?.boostPct ?? 0,
    bbValue: promo?.bbValue ?? 0,
    note: promo?.note ?? '',
  }
}

/* =======================
   Core Math
======================= */

export function computeSlip(slip: SlipInput): SlipComputed {
  const promo = normalizePromo(slip.promo)
  // If no promo / no boost set, treat boost as 0
  const boostPct = promo.boostPct ?? 0

  const decBase = americanToDecimal(slip.oddsAmerican)
  const baseProfit = slip.stake * (decBase - 1)

  let decEffective = decBase
  let promoProfit = baseProfit

  // Profit Boost
  if (promo.type === 'profit_boost') {
    promoProfit = baseProfit * (1 + boostPct / 100)
  }

  // Odds Boost
  if (promo.type === 'odds_boost') {
    const boostedProfitPerDollar =
      (decBase - 1) * (1 + boostPct / 100)
    decEffective = 1 + boostedProfitPerDollar
    promoProfit = slip.stake * (decEffective - 1)
  }

  const isBonusBet = promo.type === 'bonus_bet'
  const isInsured = promo.type === 'insured'

  // Default payout logic
  const payoutAuto = isBonusBet
    ? promoProfit              // stake not returned
    : slip.stake + promoProfit

  const payout =
    slip.payoutOverride != null
      ? slip.payoutOverride
      : payoutAuto

  const cashAtRisk =
    isBonusBet || isInsured ? 0 : slip.stake

  const netPayout = payout - cashAtRisk

  return {
    decimalOddsEffective: round2(decEffective),
    baseProfit: round2(baseProfit),
    promoProfit: round2(promoProfit),
    payout: round2(payout),
    cashAtRisk: round2(cashAtRisk),
    netPayout: round2(netPayout),
  }
}

export function computeLeg(leg: LegInput): LegComputed {
  const slips = leg.slips.map(computeSlip)

  const totalPayout = round2(
    slips.reduce((s, x) => s + x.payout, 0)
  )

  const totalCashAtRisk = round2(
    slips.reduce((s, x) => s + x.cashAtRisk, 0)
  )

  const totalNetPayout = round2(
    slips.reduce((s, x) => s + x.netPayout, 0)
  )

  return {
    slips,
    totalPayout,
    totalCashAtRisk,
    totalNetPayout,
  }
}

/**
 * Arb logic (2-leg only)
 *
 * If Leg 0 wins:
 *   Net Win = Leg0.totalNetPayout − Leg1.totalCashAtRisk
 *
 * If Leg 1 wins:
 *   Net Win = Leg1.totalNetPayout − Leg0.totalCashAtRisk
 */
export function computeArb(
  legs: [LegInput, LegInput]
): ArbComputed {
  const c0 = computeLeg(legs[0])
  const c1 = computeLeg(legs[1])

  const netWinIfLeg0Wins = round2(
    c0.totalNetPayout - c1.totalCashAtRisk
  )

  const netWinIfLeg1Wins = round2(
    c1.totalNetPayout - c0.totalCashAtRisk
  )

  return {
    legs: [c0, c1],
    netWinIfLeg0Wins,
    netWinIfLeg1Wins,
  }
}
