// lib/marketEventMismatch.ts

export type MarketEventComparable = {
  market?: string | null
  event?: string | null
}

/**
 * Normalize strings for comparison:
 * - trim
 * - lower-case
 */
function norm(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Returns true if BOTH sides have values and markets differ
 */
export function marketMismatch(
  a: MarketEventComparable,
  b: MarketEventComparable,
): boolean {
  const ma = norm(a.market)
  const mb = norm(b.market)

  if (!ma || !mb) return false
  return ma !== mb
}

/**
 * Returns true if BOTH sides have values and events differ
 */
export function eventMismatch(
  a: MarketEventComparable,
  b: MarketEventComparable,
): boolean {
  const ea = norm(a.event)
  const eb = norm(b.event)

  if (!ea || !eb) return false
  return ea !== eb
}

/**
 * Convenience helper:
 * true if either market OR event mismatches
 */
export function marketOrEventMismatch(
  a: MarketEventComparable,
  b: MarketEventComparable,
): {
  marketMismatch: boolean
  eventMismatch: boolean
  anyMismatch: boolean
} {
  const m = marketMismatch(a, b)
  const e = eventMismatch(a, b)

  return {
    marketMismatch: m,
    eventMismatch: e,
    anyMismatch: m || e,
  }
}
