// app/books/[book]/BookPage.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

/* =======================
   LS Keys
======================= */
const BOOKS_KEY = 'sportsbook-names-v1'
const LEDGER_KEY = 'sportsbook-ledger-v1'

/* =======================
   Types
======================= */
type SportsbookLS = { id: string; name: string; balance: number }
type SportsbookNamesLS = { cashroll: number; books: SportsbookLS[]; updatedAt: string }

type TrackKind = 'system' | 'non_system'
type NonSystemType = 'arb' | 'hedge' | 'manual' | 'other'

type PickKind = 'fav' | 'dog' | 'parlay'
type MarketKind = 'moneyline' | 'spread' | 'total' | 'prop' | 'parlay' | 'other'

type PromoType = 'none' | 'profit_boost' | 'odds_boost' | 'bonus_bet'
type ResultKind = 'open' | 'win' | 'loss'

type LedgerAction = 'deposit' | 'withdraw' | 'bonus_plus' | 'bonus_minus' | 'stake'

type ParlayLeg = {
  id: string
  event: string
  selection: string
  market: MarketKind
  oddsAmerican: number
}

type LedgerEntry = {
  id: string
  bookId: string

  /**
   * postedDate = when the balance changes
   * eventDate  = reference date of the event/pick
   */
  postedDate: string // YYYY-MM-DD
  eventDate: string // YYYY-MM-DD

  createdAt: string
  note: string

  // stake-only significance
  track: TrackKind
  nonSystemType?: NonSystemType

  // cashflow buckets
  deposit: number
  withdraw: number
  bonusPlus: number
  bonusMinus: number

  // stake cashflow + math
  stakeTotal: number // total bet size (cash + BB)
  bonusBetUsed: number // portion applied from bonus bet
  cashUsed: number // = stakeTotal - bonusBetUsed (never < 0)
  winnings: number // profit only (NOT including stake return)
  payout: number // stakeTotal + winnings (display value)
  cashReturn: number // cash that actually returns to bankroll when WIN = cashUsed + winnings

  result?: ResultKind // open/win/loss

  // meta (singles)
  pickKind?: PickKind
  market?: MarketKind
  event?: string
  selection?: string
  oddsAmerican?: number

  // meta (parlay)
  parlayLegs?: ParlayLeg[]
  parlayOddsAmerican?: number // slip-level total odds

  // promo
  promoType?: PromoType
  promoBoostPct?: number
}

type LedgerStore = { entries: LedgerEntry[]; updatedAt: string }

/* =======================
   Constants
======================= */
const MARKET_OPTIONS: { value: MarketKind; label: string }[] = [
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'spread', label: 'Spread' },
  { value: 'total', label: 'Total' },
  { value: 'prop', label: 'Prop' },
  { value: 'parlay', label: 'Parlay' },
  { value: 'other', label: 'Other' },
]

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit boost',
  odds_boost: 'Odds boost',
  bonus_bet: 'Bonus bet (BB)',
}

function promoNeedsBoost(t: PromoType): boolean {
  return t === 'profit_boost' || t === 'odds_boost'
}
function promoIsBB(t: PromoType): boolean {
  return t === 'bonus_bet'
}

/* =======================
   Helpers
======================= */
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function fmtMoney(n: number): string {
  return `$${round2(n).toFixed(2)}`
}

function parseNum(raw: string, fallback = 0): number {
  const s = (raw || '').trim()
  if (s === '' || s === '-' || s === '+') return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || '').trim())
}

function safeLoadBooks(): SportsbookNamesLS {
  try {
    const raw = localStorage.getItem(BOOKS_KEY)
    if (!raw) return { cashroll: 0, books: [], updatedAt: new Date().toISOString() }
    const parsed = JSON.parse(raw) as Partial<SportsbookNamesLS>
    return {
      cashroll: Number(parsed.cashroll) || 0,
      books: Array.isArray(parsed.books) ? (parsed.books as SportsbookLS[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { cashroll: 0, books: [], updatedAt: new Date().toISOString() }
  }
}

function safeLoadLedger(): LedgerStore {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return { entries: [], updatedAt: new Date().toISOString() }
    const parsed = JSON.parse(raw) as Partial<LedgerStore>
    return {
      entries: Array.isArray(parsed.entries) ? (parsed.entries as any[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { entries: [], updatedAt: new Date().toISOString() }
  }
}

function safeSaveLedger(store: LedgerStore) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(store))
}

function normalizeBookSlug(s: string): string {
  return (s || '').toLowerCase().trim()
}

function resolveBookBySlug(books: SportsbookNamesLS, slugRaw: string): SportsbookLS | null {
  const slug = normalizeBookSlug(slugRaw)
  if (!slug) return null

  const aliasToName: Record<string, string> = {
    fd: 'fanduel',
    dk: 'draftkings',
    mgm: 'betmgm',
    czr: 'caesars',
    hr: 'hardrock',
    pb: 'pointsbet',
    br: 'betrivers',
    espn: 'espnbet',
    b365: 'bet365',
  }
  const slug2 = aliasToName[slug] ?? slug

  const byId = books.books.find((b) => normalizeBookSlug(b.id) === slug || normalizeBookSlug(b.id) === slug2)
  if (byId) return byId

  const byNameExact = books.books.find((b) => normalizeBookSlug(b.name) === slug || normalizeBookSlug(b.name) === slug2)
  if (byNameExact) return byNameExact

  const byNameContains = books.books.find((b) => normalizeBookSlug(b.name).includes(slug2))
  if (byNameContains) return byNameContains

  return null
}

/* =======================
   Odds math (profit)
======================= */
function americanProfit(stake: number, oddsAmerican: number): number {
  const s = Math.max(0, stake)
  const o = oddsAmerican
  if (!Number.isFinite(o) || o === 0) return 0
  if (o > 0) return (s * o) / 100
  return (s * 100) / Math.abs(o)
}

function getEffectiveOdds(e: PickKind, singleOdds: number, parlayOdds: number): number {
  return e === 'parlay' ? parlayOdds : singleOdds
}

/**
 * Central calculator used by:
 * - live preview in Log Stake
 * - storing initial computed values
 * - recalculating on WIN
 */
function calcStakeMath(args: {
  pickKind: PickKind
  stakeTotal: number
  bonusBetUsed: number
  oddsAmerican: number
  promoType: PromoType
  promoBoostPct: number
}): {
  stakeTotal: number
  bonusBetUsed: number
  cashUsed: number
  winnings: number
  payout: number
  cashReturn: number
} {
  const stakeTotal = round2(Math.max(0, args.stakeTotal))
  const bonusBetUsed = round2(Math.max(0, Math.min(args.bonusBetUsed, stakeTotal)))
  const cashUsed = round2(Math.max(0, stakeTotal - bonusBetUsed))

  let profit = americanProfit(stakeTotal, args.oddsAmerican)

  // Apply boost types
  if (promoNeedsBoost(args.promoType)) {
    const boostPct = Math.max(0, args.promoBoostPct || 0)
    profit = profit * (1 + boostPct / 100)
  }

  const winnings = round2(profit)

  // Display payout = stakeTotal + winnings (your spreadsheet-style definition)
  const payout = round2(stakeTotal + winnings)

  // Actual bankroll cash return on WIN:
  // you get back CASH USED + winnings (bonus bet stake itself is not cash that returns)
  const cashReturn = round2(cashUsed + winnings)

  return { stakeTotal, bonusBetUsed, cashUsed, winnings, payout, cashReturn }
}

/* =======================
   Migration / normalize
======================= */
function normalizeEntryAny(x: any): LedgerEntry | null {
  if (!x || typeof x !== 'object') return null

  const id = typeof x.id === 'string' ? x.id : crypto.randomUUID()
  const bookId = typeof x.bookId === 'string' ? x.bookId : ''
  if (!bookId) return null

  const oldDate = typeof x.date === 'string' ? x.date : ''
  const postedDateRaw = typeof x.postedDate === 'string' ? x.postedDate : oldDate
  const eventDateRaw =
    typeof x.eventDate === 'string'
      ? x.eventDate
      : typeof x.stakeDate === 'string'
        ? x.stakeDate
        : oldDate

  const postedDate = isISODate(postedDateRaw) ? postedDateRaw : todayISODate()
  const eventDate = isISODate(eventDateRaw) ? eventDateRaw : postedDate

  const createdAt = typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString()
  const note = typeof x.note === 'string' ? x.note : ''

  const deposit = round2(Number(x.deposit) || 0)
  const withdraw = round2(Number(x.withdraw) || 0)
  const bonusPlus = round2(Number(x.bonusPlus) || 0)
  const bonusMinus = round2(Number(x.bonusMinus) || 0)

  const result: ResultKind =
    x.result === 'win' || x.result === 'loss' || x.result === 'open'
      ? x.result
      : 'open'

  const track: TrackKind = x.track === 'system' || x.track === 'non_system' ? x.track : 'system'
  const nonSystemType: NonSystemType | undefined =
    x.nonSystemType === 'arb' || x.nonSystemType === 'hedge' || x.nonSystemType === 'manual' || x.nonSystemType === 'other'
      ? x.nonSystemType
      : undefined

  const pickKind: PickKind | undefined =
    x.pickKind === 'fav' || x.pickKind === 'dog' || x.pickKind === 'parlay' ? x.pickKind : undefined

  const market: MarketKind | undefined =
    x.market === 'moneyline' || x.market === 'spread' || x.market === 'total' || x.market === 'prop' || x.market === 'parlay' || x.market === 'other'
      ? x.market
      : undefined

  const event = typeof x.event === 'string' ? x.event : undefined
  const selection = typeof x.selection === 'string' ? x.selection : undefined
  const oddsAmerican = Number.isFinite(Number(x.oddsAmerican)) ? Number(x.oddsAmerican) : undefined

  const parlayOddsAmerican = Number.isFinite(Number(x.parlayOddsAmerican)) ? Number(x.parlayOddsAmerican) : undefined
  const parlayLegs: ParlayLeg[] | undefined = Array.isArray(x.parlayLegs)
    ? (x.parlayLegs as any[])
      .map((l) => {
        if (!l || typeof l !== 'object') return null
        return {
          id: typeof l.id === 'string' ? l.id : crypto.randomUUID(),
          event: typeof l.event === 'string' ? l.event : '',
          selection: typeof l.selection === 'string' ? l.selection : '',
          market:
            l.market === 'moneyline' || l.market === 'spread' || l.market === 'total' || l.market === 'prop' || l.market === 'parlay' || l.market === 'other'
              ? l.market
              : 'other',
          oddsAmerican: Number.isFinite(Number(l.oddsAmerican)) ? Number(l.oddsAmerican) : 0,
        } satisfies ParlayLeg
      })
      .filter(Boolean) as ParlayLeg[]
    : undefined

  const promoType: PromoType =
    x.promoType === 'none' || x.promoType === 'profit_boost' || x.promoType === 'odds_boost' || x.promoType === 'bonus_bet'
      ? x.promoType
      : 'none'
  const promoBoostPct = round2(Number(x.promoBoostPct) || 0)

  // Old schema fallback
  // - previously `stake` existed and `win` sometimes stored as return
  const stakeTotal = round2(Number(x.stakeTotal) || Number(x.stake) || 0)
  const bonusBetUsed = round2(Number(x.bonusBetUsed) || 0)

  const effOdds =
    (pickKind === 'parlay' ? Number(parlayOddsAmerican) : Number(oddsAmerican)) || 0

  const computed = calcStakeMath({
    pickKind: pickKind ?? 'fav',
    stakeTotal,
    bonusBetUsed,
    oddsAmerican: effOdds,
    promoType,
    promoBoostPct,
  })

  // If older entries had a "win" field used as cash return, keep it when present and settled win.
  const legacyCashReturn = round2(Number(x.cashReturn) || Number(x.win) || 0)
  const cashReturn =
    result === 'win' && legacyCashReturn > 0 ? legacyCashReturn : computed.cashReturn

  // For open/loss: cashReturn should be 0 in our system.
  const finalCashReturn = result === 'win' ? cashReturn : 0

  // Winnings/payout:
  // If win and we only have legacy cashReturn, derive winnings as (cashReturn - cashUsed) at minimum.
  const derivedWinnings =
    result === 'win' && legacyCashReturn > 0 ? round2(Math.max(0, legacyCashReturn - computed.cashUsed)) : computed.winnings
  const derivedPayout = round2(computed.stakeTotal + derivedWinnings)

  const out: LedgerEntry = {
    id,
    bookId,
    postedDate,
    eventDate,
    createdAt,
    note,

    track,
    nonSystemType,

    deposit,
    withdraw,
    bonusPlus,
    bonusMinus,

    stakeTotal: computed.stakeTotal,
    bonusBetUsed: computed.bonusBetUsed,
    cashUsed: computed.cashUsed,
    winnings: result === 'win' ? derivedWinnings : computed.winnings, // keep potential calc for open too
    payout: derivedPayout,
    cashReturn: finalCashReturn,

    result,

    pickKind,
    market,
    event,
    selection,
    oddsAmerican,
    parlayLegs,
    parlayOddsAmerican,

    promoType,
    promoBoostPct,
  }

  return out
}

function entryDelta(e: LedgerEntry): number {
  // Balance delta uses CASH USED and CASH RETURN (true bankroll).
  // Display payout is separate.
  return (
    (e.deposit ?? 0) -
    (e.withdraw ?? 0) +
    (e.bonusPlus ?? 0) -
    (e.bonusMinus ?? 0) -
    (e.cashUsed ?? 0) +
    (e.cashReturn ?? 0)
  )
}

function makeEntryBase(bookId: string, postedDate: string, eventDate: string, note: string): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    bookId,
    postedDate,
    eventDate,
    createdAt: new Date().toISOString(),
    note: note ?? '',
    track: 'system',

    deposit: 0,
    withdraw: 0,
    bonusPlus: 0,
    bonusMinus: 0,

    stakeTotal: 0,
    bonusBetUsed: 0,
    cashUsed: 0,
    winnings: 0,
    payout: 0,
    cashReturn: 0,

    result: 'open',

    promoType: 'none',
    promoBoostPct: 0,
  }
}

/* =======================
   UI components
======================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

/* =======================
   Component
======================= */
export default function BookPage() {
  const params = useParams()
  const bookSlug = typeof params?.book === 'string' ? params.book : ''

  const [bookId, setBookId] = useState<string | null>(null)
  const [bookName, setBookName] = useState<string>('Sportsbook')
  const [startingBalance, setStartingBalance] = useState<number>(0)

  const [entries, setEntries] = useState<LedgerEntry[]>([])

  // stake-only tracking
  const [trackDraft, setTrackDraft] = useState<TrackKind>('system')
  const [nonSystemTypeDraft, setNonSystemTypeDraft] = useState<NonSystemType>('arb')

  const [mode, setMode] = useState<LedgerAction | null>(null)

  // dates
  const [postedDateDraft, setPostedDateDraft] = useState<string>(todayISODate())
  const [eventDateDraft, setEventDateDraft] = useState<string>(todayISODate())

  // general drafts
  const [amtDraft, setAmtDraft] = useState<string>('')
  const [noteDraft, setNoteDraft] = useState<string>('')

  // stake drafts
  const [pickKindDraft, setPickKindDraft] = useState<PickKind>('fav')
  const [marketDraft, setMarketDraft] = useState<MarketKind>('moneyline')

  const [eventDraft, setEventDraft] = useState<string>('') // BOS-LA
  const [selectionDraft, setSelectionDraft] = useState<string>('') // BOS

  const [oddsAmericanDraft, setOddsAmericanDraft] = useState<string>('') // single odds
  const [stakeTotalDraft, setStakeTotalDraft] = useState<string>('') // total stake
  const [bonusBetUsedDraft, setBonusBetUsedDraft] = useState<string>('0') // portion from BB

  // parlay drafts
  const [parlayOddsAmericanDraft, setParlayOddsAmericanDraft] = useState<string>('') // slip total odds
  const [parlayLegsDraft, setParlayLegsDraft] = useState<ParlayLeg[]>([
    { id: crypto.randomUUID(), event: '', selection: '', market: 'moneyline', oddsAmerican: 0 },
  ])

  // promo drafts
  const [promoTypeDraft, setPromoTypeDraft] = useState<PromoType>('none')
  const [promoBoostPctDraft, setPromoBoostPctDraft] = useState<string>('0')

  useEffect(() => {
    const books = safeLoadBooks()
    const match = resolveBookBySlug(books, bookSlug)

    if (!match) {
      // eslint-disable-next-line
      setBookId(null)
      setBookName('Unknown Sportsbook')
      setStartingBalance(0)
      setEntries([])
      return
    }

    setBookId(match.id)
    setBookName(match.name)
    setStartingBalance(Number.isFinite(match.balance) ? match.balance : 0)

    const ledger = safeLoadLedger()
    const normalizedAll = ledger.entries.map((x: any) => normalizeEntryAny(x)).filter(Boolean) as LedgerEntry[]
    setEntries(normalizedAll.filter((e) => e.bookId === match.id))
  }, [bookSlug])

  useEffect(() => {
    if (!bookId) return
    try {
      const store = safeLoadLedger()
      const normalizedAll = store.entries.map((x: any) => normalizeEntryAny(x)).filter(Boolean) as LedgerEntry[]
      const keepOthers = normalizedAll.filter((e) => e.bookId !== bookId)
      safeSaveLedger({ entries: [...keepOthers, ...entries], updatedAt: new Date().toISOString() })
    } catch { }
  }, [entries, bookId])

  const balance = useMemo(() => {
    const net = entries.reduce((s, e) => s + entryDelta(e), 0)
    return round2((Number.isFinite(startingBalance) ? startingBalance : 0) + net)
  }, [entries, startingBalance])

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.postedDate !== b.postedDate) return a.postedDate < b.postedDate ? 1 : -1
      return a.createdAt < b.createdAt ? 1 : -1
    })
  }, [entries])

  function resetDatesToToday() {
    const t = todayISODate()
    setPostedDateDraft(t)
    setEventDateDraft(t)
  }

  function resetGeneralDrafts() {
    setAmtDraft('')
    setNoteDraft('')
  }

  function resetStakeDrafts() {
    setTrackDraft('system')
    setNonSystemTypeDraft('arb')

    setPickKindDraft('fav')
    setMarketDraft('moneyline')
    setEventDraft('')
    setSelectionDraft('')
    setOddsAmericanDraft('')

    setStakeTotalDraft('')
    setBonusBetUsedDraft('0')

    setParlayOddsAmericanDraft('')
    setParlayLegsDraft([{ id: crypto.randomUUID(), event: '', selection: '', market: 'moneyline', oddsAmerican: 0 }])

    setPromoTypeDraft('none')
    setPromoBoostPctDraft('0')

    setNoteDraft('')
  }

  function begin(action: LedgerAction) {
    setMode(action)
    resetDatesToToday()
    if (action === 'stake') resetStakeDrafts()
    else resetGeneralDrafts()
  }

  function cancel() {
    setMode(null)
    resetGeneralDrafts()
  }

  function confirmGeneral() {
    if (!bookId || !mode) return

    const amt = Math.abs(parseNum(amtDraft, 0))
    if (amt <= 0) return

    const posted = isISODate(postedDateDraft) ? postedDateDraft : todayISODate()
    const eventD = isISODate(eventDateDraft) ? eventDateDraft : posted

    const base = makeEntryBase(bookId, posted, eventD, noteDraft.trim())

    let next: LedgerEntry = { ...base }

    switch (mode) {
      case 'deposit':
        next = { ...base, deposit: round2(amt) }
        break
      case 'withdraw':
        next = { ...base, withdraw: round2(amt) }
        break
      case 'bonus_plus':
        next = { ...base, bonusPlus: round2(amt) }
        break
      case 'bonus_minus':
        next = { ...base, bonusMinus: round2(amt) }
        break
      default:
        return
    }

    setEntries((prev) => [next, ...prev])
    cancel()
  }

  function updateLeg(id: string, patch: Partial<ParlayLeg>) {
    setParlayLegsDraft((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function addLeg() {
    setParlayLegsDraft((prev) => [
      ...prev,
      { id: crypto.randomUUID(), event: '', selection: '', market: 'moneyline', oddsAmerican: 0 },
    ])
  }

  function removeLeg(id: string) {
    setParlayLegsDraft((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))
  }

  // LIVE CALC for Log Stake
  const isParlayDraft = pickKindDraft === 'parlay'
  const effectiveOddsDraft = useMemo(() => {
    const singleOdds = parseNum(oddsAmericanDraft, 0)
    const parlayOdds = parseNum(parlayOddsAmericanDraft, 0)
    return getEffectiveOdds(pickKindDraft, singleOdds, parlayOdds)
  }, [pickKindDraft, oddsAmericanDraft, parlayOddsAmericanDraft])

  const liveCalc = useMemo(() => {
    const stakeTotal = Math.abs(parseNum(stakeTotalDraft, 0))
    const bbUsed = Math.abs(parseNum(bonusBetUsedDraft, 0))
    const promoBoostPct = Math.max(0, parseNum(promoBoostPctDraft, 0))

    return calcStakeMath({
      pickKind: pickKindDraft,
      stakeTotal,
      bonusBetUsed: bbUsed,
      oddsAmerican: effectiveOddsDraft,
      promoType: promoTypeDraft,
      promoBoostPct,
    })
  }, [stakeTotalDraft, bonusBetUsedDraft, pickKindDraft, effectiveOddsDraft, promoTypeDraft, promoBoostPctDraft])

  function confirmStake() {
    if (!bookId) return

    const posted = isISODate(postedDateDraft) ? postedDateDraft : todayISODate()
    const eventD = isISODate(eventDateDraft) ? eventDateDraft : posted

    // basic validations
    if (!Number.isFinite(effectiveOddsDraft) || effectiveOddsDraft === 0) return
    if (liveCalc.stakeTotal <= 0) return

    if (pickKindDraft === 'parlay') {
      const legs = parlayLegsDraft.map((l) => ({
        ...l,
        event: (l.event || '').trim(),
        selection: (l.selection || '').trim(),
        oddsAmerican: round2(Number(l.oddsAmerican) || 0),
      }))

      if (legs.length < 2) return
      if (legs.some((l) => !l.selection)) return

      const base = makeEntryBase(bookId, posted, eventD, noteDraft.trim())

      const next: LedgerEntry = {
        ...base,
        track: trackDraft,
        nonSystemType: trackDraft === 'non_system' ? nonSystemTypeDraft : undefined,

        pickKind: 'parlay',
        market: 'parlay',
        parlayLegs: legs,
        parlayOddsAmerican: round2(effectiveOddsDraft),

        promoType: promoTypeDraft,
        promoBoostPct: round2(Math.max(0, parseNum(promoBoostPctDraft, 0))),

        stakeTotal: liveCalc.stakeTotal,
        bonusBetUsed: liveCalc.bonusBetUsed,
        cashUsed: liveCalc.cashUsed,

        // store potential calc immediately for live display in table
        winnings: liveCalc.winnings,
        payout: liveCalc.payout,

        // only filled when settled WIN
        cashReturn: 0,
        result: 'open',
      }

      setEntries((prev) => [next, ...prev])
      cancel()
      return
    }

    // singles need selection
    if (!selectionDraft.trim()) return

    const base = makeEntryBase(bookId, posted, eventD, noteDraft.trim())

    const next: LedgerEntry = {
      ...base,
      track: trackDraft,
      nonSystemType: trackDraft === 'non_system' ? nonSystemTypeDraft : undefined,

      pickKind: pickKindDraft,
      market: marketDraft,
      event: eventDraft.trim(),
      selection: selectionDraft.trim(),
      oddsAmerican: round2(effectiveOddsDraft),

      promoType: promoTypeDraft,
      promoBoostPct: round2(Math.max(0, parseNum(promoBoostPctDraft, 0))),

      stakeTotal: liveCalc.stakeTotal,
      bonusBetUsed: liveCalc.bonusBetUsed,
      cashUsed: liveCalc.cashUsed,

      winnings: liveCalc.winnings,
      payout: liveCalc.payout,

      cashReturn: 0,
      result: 'open',
    }

    setEntries((prev) => [next, ...prev])
    cancel()
  }

  function removeEntry(id: string) {
    const ok = window.confirm('Remove this entry?')
    if (!ok) return
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function setResult(id: string, next: ResultKind) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e

        const isStakeEntry = (e.stakeTotal ?? 0) > 0
        if (!isStakeEntry) return e

        const curr = (e.result ?? 'open') as ResultKind
        if (curr !== 'open' && curr !== next) {
          const ok = window.confirm(`Change result from ${curr.toUpperCase()} to ${next.toUpperCase()}?`)
          if (!ok) return e
        }

        if (next === 'open') {
          return { ...e, result: 'open', cashReturn: 0 }
        }

        if (next === 'loss') {
          // Loss: cashUsed stays deducted, cashReturn remains 0.
          return { ...e, result: 'loss', cashReturn: 0 }
        }

        // WIN:
        const odds =
          e.pickKind === 'parlay' ? Number(e.parlayOddsAmerican || 0) : Number(e.oddsAmerican || 0)

        const computed = calcStakeMath({
          pickKind: e.pickKind ?? 'fav',
          stakeTotal: Number(e.stakeTotal || 0),
          bonusBetUsed: Number(e.bonusBetUsed || 0),
          oddsAmerican: odds,
          promoType: e.promoType ?? 'none',
          promoBoostPct: Number(e.promoBoostPct || 0),
        })

        // cashReturn is what hits bankroll (cashUsed + winnings)
        return {
          ...e,
          result: 'win',
          winnings: computed.winnings,
          payout: computed.payout,
          cashReturn: computed.cashReturn,
        }
      })
    )
  }

  if (!bookSlug) {
    return (
      <div style={page}>
        <h1 style={{ margin: 0 }}>Sportsbook</h1>
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          Slug is empty. You should be at <b>/books/fd</b>.
        </div>
      </div>
    )
  }

  if (!bookId) {
    return (
      <div style={page}>
        <h1 style={{ margin: 0 }}>Sportsbook</h1>
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          No sportsbook matched URL: <b>/books/{bookSlug}</b>
        </div>
      </div>
    )
  }

  const isStakeMode = mode === 'stake'
  const needsBoostDraft = promoNeedsBoost(promoTypeDraft)

  return (
    <div style={page}>
      <h1 style={{ margin: 0 }}>{bookName}</h1>

      <div style={{ marginTop: 12, border: '1px solid #ddd', borderRadius: 12, padding: 12, background: '#fbfbfb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Balance</div>
            <div style={{ marginTop: 2, fontSize: 34, fontWeight: 900 }}>{fmtMoney(balance)}</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Starting balance: <b>{fmtMoney(startingBalance)}</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={() => begin('stake')} style={btnPrimary}>
            Log stake
          </button>

          <div style={{ width: 1, background: '#eee', margin: '0 6px' }} />

          <button onClick={() => begin('withdraw')} style={btn}>
            Withdraw
          </button>
          <button onClick={() => begin('deposit')} style={btn}>
            Deposit
          </button>
          <button onClick={() => begin('bonus_plus')} style={btn}>
            Bonus +
          </button>
          <button onClick={() => begin('bonus_minus')} style={btn}>
            Bonus -
          </button>
        </div>

        {mode ? (
          <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
            {isStakeMode ? (
              <div style={{ display: 'grid', gridTemplateColumns: '170px 170px 200px 200px 1fr auto auto', gap: 10 }}>
                <Field label='Posted date'>
                  <input type='date' value={postedDateDraft} onChange={(e) => setPostedDateDraft(e.target.value)} style={inputStyle} />
                </Field>

                <Field label='Event date'>
                  <input type='date' value={eventDateDraft} onChange={(e) => setEventDateDraft(e.target.value)} style={inputStyle} />
                </Field>

                <Field label='Track'>
                  <select value={trackDraft} onChange={(e) => setTrackDraft(e.target.value as TrackKind)} style={inputStyle}>
                    <option value='system'>System (Trader)</option>
                    <option value='non_system'>Non-system</option>
                  </select>
                </Field>

                <Field label='Non-system type'>
                  {trackDraft === 'non_system' ? (
                    <select value={nonSystemTypeDraft} onChange={(e) => setNonSystemTypeDraft(e.target.value as NonSystemType)} style={inputStyle}>
                      <option value='arb'>Arb</option>
                      <option value='hedge'>Hedge</option>
                      <option value='manual'>Manual</option>
                      <option value='other'>Other</option>
                    </select>
                  ) : (
                    <input value='—' disabled style={{ ...inputStyle, opacity: 0.6 }} />
                  )}
                </Field>

                <Field label='Note'>
                  <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder='Optional' style={inputStyle} />
                </Field>

                <button onClick={confirmStake} style={{ ...btn, alignSelf: 'end', height: 42 }}>
                  Confirm
                </button>
                <button onClick={cancel} style={{ ...btn, alignSelf: 'end', height: 42 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '200px 220px 1fr auto auto', gap: 10 }}>
                <Field label='Date'>
                  <input type='date' value={postedDateDraft} onChange={(e) => setPostedDateDraft(e.target.value)} style={inputStyle} />
                </Field>

                <Field label='Amount'>
                  <input value={amtDraft} onChange={(e) => setAmtDraft(e.target.value)} placeholder='0.00' style={inputStyle} autoFocus />
                </Field>

                <Field label='Note'>
                  <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder='Bank / Venmo / etc' style={inputStyle} />
                </Field>

                <button onClick={confirmGeneral} style={{ ...btn, alignSelf: 'end', height: 42 }}>
                  Confirm
                </button>
                <button onClick={cancel} style={{ ...btn, alignSelf: 'end', height: 42 }}>
                  Cancel
                </button>
              </div>
            )}

            {isStakeMode ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <Field label='Pick'>
                    <select value={pickKindDraft} onChange={(e) => setPickKindDraft(e.target.value as PickKind)} style={inputStyle}>
                      <option value='fav'>Fav</option>
                      <option value='dog'>Dog</option>
                      <option value='parlay'>Parlay</option>
                    </select>
                  </Field>

                  <Field label='Market'>
                    <select
                      value={isParlayDraft ? 'parlay' : marketDraft}
                      onChange={(e) => setMarketDraft(e.target.value as MarketKind)}
                      style={{ ...inputStyle, opacity: isParlayDraft ? 0.6 : 1 }}
                      disabled={isParlayDraft}
                    >
                      {MARKET_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {!isParlayDraft ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <Field label='Event'>
                        <input value={eventDraft} onChange={(e) => setEventDraft(e.target.value)} placeholder='BOS-LA' style={inputStyle} />
                      </Field>

                      <Field label='Selection'>
                        <input value={selectionDraft} onChange={(e) => setSelectionDraft(e.target.value)} placeholder='BOS (or Over 5.5)' style={inputStyle} />
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <Field label='Odds (American)'>
                        <input value={oddsAmericanDraft} onChange={(e) => setOddsAmericanDraft(e.target.value)} placeholder='-110' style={inputStyle} />
                      </Field>

                      <Field label='Stake (total)'>
                        <input value={stakeTotalDraft} onChange={(e) => setStakeTotalDraft(e.target.value)} placeholder='30' style={inputStyle} />
                      </Field>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <Field label='Total odds (American)'>
                        <input value={parlayOddsAmericanDraft} onChange={(e) => setParlayOddsAmericanDraft(e.target.value)} placeholder='+420' style={inputStyle} />
                      </Field>

                      <Field label='Stake (total)'>
                        <input value={stakeTotalDraft} onChange={(e) => setStakeTotalDraft(e.target.value)} placeholder='30' style={inputStyle} />
                      </Field>
                    </div>

                    <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>Parlay legs</div>
                        <button onClick={addLeg} style={btnSmall}>
                          + Add leg
                        </button>
                      </div>

                      <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                        {parlayLegsDraft.map((leg, idx) => (
                          <div key={leg.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 900, opacity: 0.75 }}>Leg {idx + 1}</div>
                              <button onClick={() => removeLeg(leg.id)} style={btnSmallMuted} disabled={parlayLegsDraft.length <= 1}>
                                Remove
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                              <Field label='Event'>
                                <input value={leg.event} onChange={(e) => updateLeg(leg.id, { event: e.target.value })} placeholder='BOS-LA' style={inputStyle} />
                              </Field>

                              <Field label='Selection'>
                                <input value={leg.selection} onChange={(e) => updateLeg(leg.id, { selection: e.target.value })} placeholder='BOS (or Over 5.5)' style={inputStyle} />
                              </Field>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                              <Field label='Market'>
                                <select value={leg.market} onChange={(e) => updateLeg(leg.id, { market: e.target.value as MarketKind })} style={inputStyle}>
                                  {MARKET_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </Field>

                              <Field label='Odds (American)'>
                                <input
                                  value={String(leg.oddsAmerican || '')}
                                  onChange={(e) => updateLeg(leg.id, { oddsAmerican: parseNum(e.target.value, 0) })}
                                  placeholder='-110'
                                  style={inputStyle}
                                />
                              </Field>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <Field label='Bonus bet used (reduces cash used)'>
                    <input
                      value={bonusBetUsedDraft}
                      onChange={(e) => setBonusBetUsedDraft(e.target.value)}
                      placeholder='0'
                      style={inputStyle}
                    />
                  </Field>

                  <Field label='Promo'>
                    <select value={promoTypeDraft} onChange={(e) => setPromoTypeDraft(e.target.value as PromoType)} style={inputStyle}>
                      {Object.entries(PROMO_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {needsBoostDraft ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                    <Field label='Boost %'>
                      <input value={promoBoostPctDraft} onChange={(e) => setPromoBoostPctDraft(e.target.value)} placeholder='30' style={inputStyle} />
                    </Field>
                    <div />
                  </div>
                ) : null}

                {/* LIVE PREVIEW */}
                <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fafafa' }}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Live calc</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                    <div>
                      <div style={miniLabel}>Cash used</div>
                      <div style={miniValue}>{fmtMoney(liveCalc.cashUsed)}</div>
                    </div>
                    <div>
                      <div style={miniLabel}>Winnings (profit)</div>
                      <div style={miniValue}>{fmtMoney(liveCalc.winnings)}</div>
                    </div>
                    <div>
                      <div style={miniLabel}>Payout (stake + winnings)</div>
                      <div style={miniValue}>{fmtMoney(liveCalc.payout)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
        <div style={thead}>
          <div style={{ flex: 0.7 }}>Posted</div>
          <div style={{ flex: 0.7 }}>Event date</div>
          <div style={{ flex: 0.75 }}>Track</div>
          <div style={{ flex: 1.2 }}>Note / Meta</div>

          <div style={{ flex: 0.7, textAlign: 'right' }}>Deposit</div>
          <div style={{ flex: 0.7, textAlign: 'right' }}>Withdraw</div>
          <div style={{ flex: 0.7, textAlign: 'right' }}>Bonus +</div>
          <div style={{ flex: 0.7, textAlign: 'right' }}>Bonus -</div>

          <div style={{ flex: 0.75, textAlign: 'right' }}>Cash used</div>
          <div style={{ flex: 0.75, textAlign: 'right' }}>BB used</div>
          <div style={{ flex: 0.75, textAlign: 'right' }}>Winnings</div>
          <div style={{ flex: 0.75, textAlign: 'right' }}>Payout</div>

          <div style={{ flex: 0.75, textAlign: 'right' }}>Net</div>
          <div style={{ width: 220 }} />
        </div>

        {sorted.length ? (
          sorted.map((e) => {
            const net = entryDelta(e)
            const isStakeEntry = (e.stakeTotal ?? 0) > 0
            const currResult = (e.result ?? 'open') as ResultKind
            const isLoss = isStakeEntry && currResult === 'loss'
            const isWin = isStakeEntry && currResult === 'win'
            const isOpen = isStakeEntry && currResult === 'open'

            const rowStyle: React.CSSProperties = {
              ...trow,
              background: isLoss ? '#fff5f5' : 'white',
            }

            const netColor = isLoss ? '#7a271a' : net < 0 ? '#b42318' : '#111'

            const badgeBg = e.track === 'system' ? '#ecfdf3' : '#eff6ff'
            const badgeBorder = e.track === 'system' ? '#abefc6' : '#b2ddff'
            const badgeText = e.track === 'system' ? '#067647' : '#175cd3'
            const badgeLabel = e.track === 'system' ? 'SYS' : `NS • ${e.nonSystemType ?? 'other'}`

            const statusLabel = isOpen ? 'OPEN' : isWin ? 'WIN' : 'LOSS'
            const statusBg = isOpen ? '#f2f4f7' : isWin ? '#ecfdf3' : '#fff1f3'
            const statusBorder = isOpen ? '#e4e7ec' : isWin ? '#abefc6' : '#fecdd6'
            const statusText = isOpen ? '#344054' : isWin ? '#067647' : '#b42318'

            // meta line
            const metaParts: string[] = []
            if (isStakeEntry) {
              if (e.pickKind === 'parlay') {
                metaParts.push(`PARLAY (${(e.parlayLegs || []).length} legs)`)
                if (Number.isFinite(e.parlayOddsAmerican)) metaParts.push(`${e.parlayOddsAmerican! > 0 ? '+' : ''}${e.parlayOddsAmerican}`)
                const legs = (e.parlayLegs || []).slice(0, 3)
                if (legs.length) {
                  metaParts.push(
                    legs
                      .map((l) => `${(l.event || '').trim()}:${(l.selection || '').trim()}`)
                      .filter(Boolean)
                      .join(' · ')
                  )
                  if ((e.parlayLegs || []).length > 3) metaParts.push('…')
                }
              } else {
                if (e.event) metaParts.push(e.event)
                if (e.selection) metaParts.push(`PICK: ${e.selection}`)
                if (e.market) metaParts.push(e.market)
                if (Number.isFinite(e.oddsAmerican)) metaParts.push(`${e.oddsAmerican! > 0 ? '+' : ''}${e.oddsAmerican}`)
              }
              if (e.promoType && e.promoType !== 'none') {
                metaParts.push(PROMO_LABELS[e.promoType])
                if (promoNeedsBoost(e.promoType)) metaParts.push(`${round2(e.promoBoostPct ?? 0)}%`)
              }
            }
            const metaLine = metaParts.join(' · ')

            return (
              <div key={e.id} style={rowStyle}>
                <div style={{ flex: 0.7, fontWeight: 900 }}>{e.postedDate}</div>
                <div style={{ flex: 0.7, fontWeight: 900 }}>{e.eventDate}</div>

                <div style={{ flex: 0.75 }}>
                  {isStakeEntry ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={badge(badgeBorder, badgeBg, badgeText)}>{badgeLabel}</span>
                      <span style={badge(statusBorder, statusBg, statusText)}>{statusLabel}</span>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6, fontWeight: 800, fontSize: 12 }}>—</span>
                  )}
                </div>

                <div style={{ flex: 1.2, fontSize: 13, opacity: 0.92 }}>
                  <div>{e.note || '—'}</div>
                  {metaLine ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{metaLine}</div> : null}
                </div>

                <MoneyCell value={e.deposit} />
                <MoneyCell value={e.withdraw} negative />
                <MoneyCell value={e.bonusPlus} />
                <MoneyCell value={e.bonusMinus} negative />

                <MoneyCell value={e.cashUsed} negative mutedLoss={isLoss} />
                <MoneyCell value={e.bonusBetUsed} />
                <MoneyCell value={e.winnings} mutedWin={isWin} />
                <MoneyCell value={e.payout} mutedWin={isWin} />

                <div style={{ flex: 0.75, textAlign: 'right', fontWeight: 900, color: netColor }}>{fmtMoney(net)}</div>

                <div style={{ width: 220, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {isStakeEntry ? (
                    <>
                      <button onClick={() => setResult(e.id, 'win')} style={{ ...btnSmall, opacity: isWin ? 0.6 : 1 }}>
                        Win
                      </button>
                      <button onClick={() => setResult(e.id, 'loss')} style={{ ...btnSmallDanger, opacity: isLoss ? 0.6 : 1 }}>
                        Loss
                      </button>
                      <button onClick={() => setResult(e.id, 'open')} style={btnSmallMuted}>
                        Reopen
                      </button>
                    </>
                  ) : null}

                  <button onClick={() => removeEntry(e.id)} style={btnDanger}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: 14, fontSize: 13, opacity: 0.75 }}>No entries yet.</div>
        )}
      </div>
    </div>
  )
}

/* =======================
   UI helpers
======================= */
function MoneyCell({
  value,
  negative,
  mutedLoss,
  mutedWin,
}: {
  value: number
  negative?: boolean
  mutedLoss?: boolean
  mutedWin?: boolean
}) {
  const v = Number.isFinite(value) ? value : 0
  const show = v > 0 ? fmtMoney(v) : '—'

  let color = negative && v > 0 ? '#b42318' : '#111'
  if (mutedLoss && negative && v > 0) color = '#7a271a'
  if (mutedWin && v > 0) color = '#067647'

  return <div style={{ flex: 0.75, textAlign: 'right', fontWeight: 900, color }}>{show}</div>
}

function badge(border: string, bg: string, text: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color: text,
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: 'nowrap',
  }
}

/* =======================
   Styles
======================= */
const page: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: 20,
  fontFamily: 'system-ui, -apple-system',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  fontWeight: 900,
  marginBottom: 6,
}

const miniLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  fontWeight: 900,
}

const miniValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  marginTop: 2,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 16,
  background: 'white',
}

const btn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #abefc6',
  background: '#ecfdf3',
  cursor: 'pointer',
  fontWeight: 900,
}

const btnSmall: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 900,
}

const btnSmallMuted: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #e4e7ec',
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 900,
  color: '#344054',
}

const btnSmallDanger: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #fecdd6',
  background: 'white',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 900,
  color: '#b42318',
}

const btnDanger: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #f1c3c3',
  background: 'white',
  cursor: 'pointer',
  fontSize: 13,
}

const thead: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '10px 12px',
  background: '#f7f7f7',
  borderBottom: '1px solid #ddd',
  fontWeight: 900,
  alignItems: 'center',
}

const trow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
  alignItems: 'center',
}
