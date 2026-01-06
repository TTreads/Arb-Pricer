// lib/pickSizing.ts

export type BankrollPickInput = {
  oddsAmerican: number
  pctOfBankroll: number // e.g. 2.2 for 2.20%
}

export type BankrollPickOutput = {
  amount: number
  toWin: number
}

export function americanToWin(stake: number, oddsAmerican: number): number {
  if (!Number.isFinite(stake) || stake < 0) return 0
  if (!Number.isFinite(oddsAmerican) || oddsAmerican === 0) return 0

  if (oddsAmerican > 0) return stake * (oddsAmerican / 100)
  return stake * (100 / Math.abs(oddsAmerican))
}

export function bankrollSizePick(
  bankroll: number,
  input: BankrollPickInput,
): BankrollPickOutput {
  const b = Number.isFinite(bankroll) && bankroll > 0 ? bankroll : 0
  const pct = Number.isFinite(input.pctOfBankroll) ? input.pctOfBankroll : 0

  const amount = b * (pct / 100)
  const toWin = americanToWin(amount, input.oddsAmerican)

  return { amount, toWin }
}

export function bankrollSizePicks(
  bankroll: number,
  picks: BankrollPickInput[],
): BankrollPickOutput[] {
  return picks.map((p) => bankrollSizePick(bankroll, p))
}

/**
 * Optional rounding helper:
 * step = 0.01 (cents), 0.5, 1, 5, etc.
 */
export function roundToStep(value: number, step = 0.01): number {
  if (!Number.isFinite(value)) return 0
  if (!Number.isFinite(step) || step <= 0) return value
  return Math.round(value / step) * step
}
