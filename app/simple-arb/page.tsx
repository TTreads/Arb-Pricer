// app/simple-arb/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { LegInput, PromoType, Side, SlipInput } from '@/lib/arbMath'
import { computeArb, round2 } from '@/lib/arbMath'
import { computeBBEfficiencyFromArb } from '@/lib/bbEfficiency'

type SlipUI = {
  id: string
  book: string
  oddsAmerican: string // <- string for smooth typing
  stake: string        // <- string for smooth typing
  promo: {
    type: PromoType
    boostPct: string   // <- string for smooth typing
    bbValue: string    // <- string for smooth typing
    note: string
  }
  payoutOverride: string // <- string for smooth typing
  note: string
}

type LegUI = {
  side: Side
  team: string
  market: string
  event: string
  note: string
  slip: SlipUI // Simple arb = exactly 1 slip per leg
}

type DraftUI = {
  dog: LegUI
  fav: LegUI
}

const LS_KEY = 'simple-arb-draft-v4'

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit Boost (+% profit)',
  odds_boost: 'Odds Boost (+% odds)',
  bonus_bet: 'Bonus Bet / Free Bet (stake not returned)',
  insured: 'Insured / Risk-Free (treat losing stake as refunded)',
}

function newSlipUI(): SlipUI {
  return {
    id: crypto.randomUUID(),
    book: '',
    oddsAmerican: '100',
    stake: '0',
    promo: { type: 'none', boostPct: '0', bbValue: '0', note: '' },
    payoutOverride: '',
    note: '',
  }
}

function newLegUI(side: Side): LegUI {
  return {
    side,
    team: '',
    market: '',
    event: '',
    note: '',
    slip: newSlipUI(),
  }
}

/* ---------- parsing ---------- */

function parseNum(raw: string, fallback = 0): number {
  const s = raw.trim()
  if (s === '' || s === '-' || s === '+') return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function toSlipInput(s: SlipUI): SlipInput {
  const promoType = s.promo?.type ?? 'none'

  return {
    id: s.id,
    book: s.book,
    oddsAmerican: parseNum(s.oddsAmerican, 0),
    stake: parseNum(s.stake, 0),
    promo: {
      type: promoType,
      boostPct:
        promoType === 'profit_boost' || promoType === 'odds_boost'
          ? parseNum(s.promo.boostPct, 0)
          : 0,
      bbValue: promoType === 'bonus_bet' ? parseNum(s.promo.bbValue, 0) : 0,
      note: s.promo.note ?? '',
    },
    payoutOverride: s.payoutOverride.trim() === '' ? null : parseNum(s.payoutOverride, 0),
    note: s.note ?? '',
  }
}

function toLegInput(leg: LegUI): LegInput {
  return {
    side: leg.side,
    team: leg.team,
    market: leg.market,
    event: leg.event,
    note: leg.note,
    slips: [toSlipInput(leg.slip)],
  }
}

export default function SimpleArbPage() {
  const [draftUI, setDraftUI] = useState<DraftUI>({
    dog: newLegUI('dog'),
    fav: newLegUI('fav'),
  })

  /* ---------- persistence ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as DraftUI
      if (parsed?.dog?.slip && parsed?.fav?.slip) setDraftUI(parsed)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draftUI))
    } catch {}
  }, [draftUI])

  /* ---------- computed ---------- */

  const legs: [LegInput, LegInput] = useMemo(() => {
    return [toLegInput(draftUI.dog), toLegInput(draftUI.fav)]
  }, [draftUI])

  const computed = useMemo(() => computeArb(legs), [legs])
  const bb = useMemo(() => computeBBEfficiencyFromArb(legs), [legs])

  /* ---------- update helpers ---------- */

  function updateLeg(legKey: 'dog' | 'fav', patch: Partial<LegUI>) {
    setDraftUI((prev) => ({
      ...prev,
      [legKey]: {
        ...prev[legKey],
        ...patch,
      },
    }))
  }

  function updateSlip(legKey: 'dog' | 'fav', patch: Partial<SlipUI>) {
    setDraftUI((prev) => ({
      ...prev,
      [legKey]: {
        ...prev[legKey],
        slip: {
          ...prev[legKey].slip,
          ...patch,
          promo: {
            ...prev[legKey].slip.promo,
            ...(patch.promo ?? {}),
          },
        },
      },
    }))
  }

  function reset() {
    setDraftUI({ dog: newLegUI('dog'), fav: newLegUI('fav') })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, fontFamily: 'system-ui, -apple-system' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Simple Arb (2-leg)</h1>
        <button onClick={reset} style={btn}>
          Reset
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <SimpleLegCard
          title='Dog Side'
          leg={draftUI.dog}
          computedSlip={computed.legs[0].slips[0]}
          onLegChange={(p) => updateLeg('dog', p)}
          onSlipChange={(p) => updateSlip('dog', p)}
        />

        <SimpleLegCard
          title='Fav Side'
          leg={draftUI.fav}
          computedSlip={computed.legs[1].slips[0]}
          onLegChange={(p) => updateLeg('fav', p)}
          onSlipChange={(p) => updateSlip('fav', p)}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Arb Results</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                Net Win if a side wins = winning side net payout minus cash at risk on the other side.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Badge label='Min' value={`$${round2(Math.min(computed.netWinIfLeg0Wins, computed.netWinIfLeg1Wins)).toFixed(2)}`} />
              <Badge label='Max' value={`$${round2(Math.max(computed.netWinIfLeg0Wins, computed.netWinIfLeg1Wins)).toFixed(2)}`} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <OutcomeCard label='Dog' title='Net win if Left wins' value={computed.netWinIfLeg0Wins} />
            <OutcomeCard label='Fav' title='Net win if Right wins' value={computed.netWinIfLeg1Wins} />
          </div>

          {bb ? (
            <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 900 }}>Bonus Bet Summary</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  Total BB Used: <b>${bb.totalBB.toFixed(2)}</b>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <MiniCard label='Dog wins' value={`$${bb.netWins[0].toFixed(2)} → ${bb.efficiencies[0].toFixed(2)}x`} />
                <MiniCard label='Fav wins' value={`$${bb.netWins[1].toFixed(2)} → ${bb.efficiencies[1].toFixed(2)}x`} />
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                <b>MIN BB EFF:</b> {bb.minEfficiency.toFixed(2)}x
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* =======================
   Components
======================= */

function SimpleLegCard({
  title,
  leg,
  computedSlip,
  onLegChange,
  onSlipChange,
}: {
  title: string
  leg: LegUI
  computedSlip: any
  onLegChange: (patch: Partial<LegUI>) => void
  onSlipChange: (patch: Partial<SlipUI>) => void
}) {
  const slip = leg.slip
  const promoType = slip.promo.type
  const needsBoost = promoType === 'profit_boost' || promoType === 'odds_boost'
  const isBB = promoType === 'bonus_bet'

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>One stake line on this side.</div>

      {/* ✅ LEG META */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label='Market'>
          <input
            value={leg.market}
            onChange={(e) => onLegChange({ market: e.target.value })}
            placeholder='ML / Spread / Total'
            style={inputStyle}
          />
        </Field>

        <Field label='Event'>
          <input
            value={leg.event}
            onChange={(e) => onLegChange({ event: e.target.value })}
            placeholder='WAS-PHI'
            style={inputStyle}
          />
        </Field>
      </div>

      {/* SLIP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label='Book'>
          <input value={slip.book} onChange={(e) => onSlipChange({ book: e.target.value })} style={inputStyle} />
        </Field>

        <Field label='Odds (American)'>
          <input
            value={slip.oddsAmerican}
            onChange={(e) => onSlipChange({ oddsAmerican: e.target.value })}
            placeholder='-110'
            style={inputStyle}
          />
        </Field>

        <Field label='Stake'>
          <input
            value={slip.stake}
            onChange={(e) => onSlipChange({ stake: e.target.value })}
            placeholder='10'
            style={inputStyle}
          />
        </Field>

        <div />
      </div>

      <div style={{ marginTop: 10 }}>
        <Field label='Promo'>
          <select
            value={promoType}
            onChange={(e) => {
              const next = e.target.value as PromoType
              onSlipChange({
                promo: {
                  ...slip.promo,
                  type: next,
                  boostPct: next === 'profit_boost' || next === 'odds_boost' ? slip.promo.boostPct : '0',
                  bbValue: next === 'bonus_bet' ? slip.promo.bbValue : '0',
                },
              })
            }}
            style={inputStyle}
          >
            {Object.entries(PROMO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {(needsBoost || isBB) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <Field label='Boost %'>
            <input
              disabled={!needsBoost}
              value={slip.promo.boostPct}
              onChange={(e) => onSlipChange({ promo: { ...slip.promo, boostPct: e.target.value } })}
              placeholder='30'
              style={{ ...inputStyle, opacity: needsBoost ? 1 : 0.5 }}
            />
          </Field>

          <Field label='BB value ($)'>
            <input
              disabled={!isBB}
              value={slip.promo.bbValue}
              onChange={(e) => onSlipChange({ promo: { ...slip.promo, bbValue: e.target.value } })}
              placeholder='20'
              style={{ ...inputStyle, opacity: isBB ? 1 : 0.5 }}
            />
          </Field>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Field label='Payout Override (optional)'>
          <input
            value={slip.payoutOverride}
            onChange={(e) => onSlipChange({ payoutOverride: e.target.value })}
            placeholder='Leave blank to auto-calc'
            style={inputStyle}
          />
        </Field>

        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
          Net Payout (this leg): <b>${(computedSlip?.netPayout ?? 0).toFixed(2)}</b>
        </div>
      </div>
    </div>
  )
}


/* =======================
   UI bits
======================= */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function OutcomeCard({ label, title, value }: { label: string; title: string; value: number }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05 }}>${round2(value).toFixed(2)}</div>
      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{title}</div>
    </div>
  )
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: '8px 10px', minWidth: 90 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900 }}>{value}</div>
    </div>
  )
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontWeight: 900 }}>{value}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 16,
}

const btn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
}
