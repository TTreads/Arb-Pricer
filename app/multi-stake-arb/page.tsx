// app/multi-stake-arb/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { LegInput, PromoType, Side, SlipInput } from '@/lib/arbMath'
import { computeArb, round2 } from '@/lib/arbMath'
import { computeBBEfficiencyFromArb } from '@/lib/bbEfficiency'

/* =======================
   UI Types (string inputs)
======================= */

type SlipUI = {
  id: string
  book: string
  oddsAmerican: string
  stake: string
  promo: {
    type: PromoType
    boostPct: string
    bbValue: string
    note: string
  }
  payoutOverride: string
  note: string
}

type LegUI = {
  side: Side
  team: string
  market: string
  event: string
  note: string
  slips: SlipUI[]
}

type DraftUI = {
  dog: LegUI
  fav: LegUI
}

const LS_KEY = 'multi-stake-arb-draft-v2'

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit Boost (+% profit)',
  odds_boost: 'Odds Boost (+% odds)',
  bonus_bet: 'Bonus Bet / Free Bet (stake not returned)',
  insured: 'Insured / Risk-Free (treat losing stake as refunded)',
}

/* =======================
   Builders
======================= */

function newSlipUI(partial?: Partial<SlipUI>): SlipUI {
  const base: SlipUI = {
    id: crypto.randomUUID(),
    book: '',
    oddsAmerican: '100',
    stake: '0',
    promo: { type: 'none', boostPct: '0', bbValue: '0', note: '' },
    payoutOverride: '',
    note: '',
  }

  return {
    ...base,
    ...partial,
    promo: {
      ...base.promo,
      ...(partial?.promo ?? {}),
    },
  }
}

function newLegUI(side: Side): LegUI {
  return {
    side,
    team: '',
    market: 'ML',
    event: '',
    note: '',
    slips: [newSlipUI()],
  }
}

/* =======================
   Parsing to math types
======================= */

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
    slips: leg.slips.map(toSlipInput),
  }
}

/* =======================
   Page
======================= */

export default function MultiStakeArbPage() {
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
      if (parsed?.dog?.slips && parsed?.fav?.slips) setDraftUI(parsed)
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

  /* ---------- updates ---------- */

  function updateLeg(legKey: 'dog' | 'fav', patch: Partial<LegUI>) {
    setDraftUI((prev) => ({
      ...prev,
      [legKey]: {
        ...prev[legKey],
        ...patch,
      },
    }))
  }

  function updateSlip(legKey: 'dog' | 'fav', slipId: string, patch: Partial<SlipUI>) {
    setDraftUI((prev) => {
      const leg = prev[legKey]
      const slips = leg.slips.map((s) =>
        s.id === slipId
          ? {
              ...s,
              ...patch,
              promo: {
                ...s.promo,
                ...(patch.promo ?? {}),
              },
            }
          : s,
      )
      return { ...prev, [legKey]: { ...leg, slips } }
    })
  }

  function addSlip(legKey: 'dog' | 'fav') {
    setDraftUI((prev) => {
      const leg = prev[legKey]
      return { ...prev, [legKey]: { ...leg, slips: [...leg.slips, newSlipUI()] } }
    })
  }

  function removeSlip(legKey: 'dog' | 'fav', slipId: string) {
    setDraftUI((prev) => {
      const leg = prev[legKey]
      const slips = leg.slips.filter((s) => s.id !== slipId)
      return { ...prev, [legKey]: { ...leg, slips: slips.length ? slips : [newSlipUI()] } }
    })
  }

  function reset() {
    setDraftUI({ dog: newLegUI('dog'), fav: newLegUI('fav') })
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'system-ui, -apple-system' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Multi-Stake Arb (2-leg)</h1>
        <button onClick={reset} style={btn}>
          Reset
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <LegPanel
          title='Dog Side'
          leg={draftUI.dog}
          computedLeg={computed.legs[0]}
          onLegChange={(p) => updateLeg('dog', p)}
          onAddSlip={() => addSlip('dog')}
          onRemoveSlip={(id) => removeSlip('dog', id)}
          onSlipChange={(id, p) => updateSlip('dog', id, p)}
        />

        <LegPanel
          title='Fav Side'
          leg={draftUI.fav}
          computedLeg={computed.legs[1]}
          onLegChange={(p) => updateLeg('fav', p)}
          onAddSlip={() => addSlip('fav')}
          onRemoveSlip={(id) => removeSlip('fav', id)}
          onSlipChange={(id, p) => updateSlip('fav', id, p)}
        />
      </div>

      {/* ---------- RESULTS ---------- */}
      <div style={{ marginTop: 18, border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
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
          <OutcomeCard label='Dog' title='Net win if Dog wins' value={computed.netWinIfLeg0Wins} />
          <OutcomeCard label='Fav' title='Net win if Fav wins' value={computed.netWinIfLeg1Wins} />
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
  )
}

/* =======================
   Components
======================= */

function LegPanel({
  title,
  leg,
  computedLeg,
  onLegChange,
  onAddSlip,
  onRemoveSlip,
  onSlipChange,
}: {
  title: string
  leg: LegUI
  computedLeg: any
  onLegChange: (patch: Partial<LegUI>) => void
  onAddSlip: () => void
  onRemoveSlip: (slipId: string) => void
  onSlipChange: (slipId: string, patch: Partial<SlipUI>) => void
}) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label='Team'>
          <input value={leg.team} onChange={(e) => onLegChange({ team: e.target.value })} style={inputStyle} />
        </Field>
        <Field label='Market'>
          <input value={leg.market} onChange={(e) => onLegChange({ market: e.target.value })} style={inputStyle} />
        </Field>
        <Field label='Event'>
          <input value={leg.event} onChange={(e) => onLegChange({ event: e.target.value })} style={inputStyle} />
        </Field>
        <Field label='Leg note (optional)'>
          <input value={leg.note} onChange={(e) => onLegChange({ note: e.target.value })} style={inputStyle} />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <div style={{ fontWeight: 900 }}>Stakes</div>
        <button onClick={onAddSlip} style={btnSmall}>
          + Add Stake
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {leg.slips.map((s, idx) => (
          <SlipRow
            key={s.id}
            index={idx}
            slip={s}
            slipComputed={computedLeg?.slips?.[idx]}
            onChange={(p) => onSlipChange(s.id, p)}
            onRemove={() => onRemoveSlip(s.id)}
          />
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
        Total Net (side): <b>${(computedLeg?.totalNetPayout ?? 0).toFixed(2)}</b> · Total Risk:{' '}
        <b>${(computedLeg?.totalCashAtRisk ?? 0).toFixed(2)}</b>
      </div>
    </div>
  )
}

function SlipRow({
  index,
  slip,
  slipComputed,
  onChange,
  onRemove,
}: {
  index: number
  slip: SlipUI
  slipComputed: any
  onChange: (patch: Partial<SlipUI>) => void
  onRemove: () => void
}) {
  const promoType = slip.promo.type
  const needsBoost = promoType === 'profit_boost' || promoType === 'odds_boost'
  const isBB = promoType === 'bonus_bet'

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900 }}>Stake {index + 1}</div>
        <button onClick={onRemove} style={btnDanger}>
          Remove
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <Field label='Book'>
          <input value={slip.book} onChange={(e) => onChange({ book: e.target.value })} style={inputStyle} />
        </Field>

        <Field label='Odds (American)'>
          <input value={slip.oddsAmerican} onChange={(e) => onChange({ oddsAmerican: e.target.value })} style={inputStyle} />
        </Field>

        <Field label='Stake'>
          <input value={slip.stake} onChange={(e) => onChange({ stake: e.target.value })} style={inputStyle} />
        </Field>

        <Field label='Promo type'>
          <select
            value={promoType}
            onChange={(e) => {
              const next = e.target.value as PromoType
              onChange({
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
              onChange={(e) => onChange({ promo: { ...slip.promo, boostPct: e.target.value } })}
              style={{ ...inputStyle, opacity: needsBoost ? 1 : 0.5 }}
            />
          </Field>

          <Field label='BB value ($)'>
            <input
              disabled={!isBB}
              value={slip.promo.bbValue}
              onChange={(e) => onChange({ promo: { ...slip.promo, bbValue: e.target.value } })}
              style={{ ...inputStyle, opacity: isBB ? 1 : 0.5 }}
            />
          </Field>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <Field label='Promo note (optional)'>
          <input value={slip.promo.note} onChange={(e) => onChange({ promo: { ...slip.promo, note: e.target.value } })} style={inputStyle} />
        </Field>

        <Field label='Payout override (optional)'>
          <input
            value={slip.payoutOverride}
            onChange={(e) => onChange({ payoutOverride: e.target.value })}
            placeholder='Leave blank to auto-calc'
            style={inputStyle}
          />
          {/* ✅ Net Payout under payout override */}
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            Net Payout (this stake): <b>${(slipComputed?.netPayout ?? 0).toFixed(2)}</b>
          </div>
        </Field>
      </div>

      <div style={{ marginTop: 10, padding: 10, border: '1px solid #f0f0f0', borderRadius: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <MiniStat label='Eff. Dec Odds' value={slipComputed ? String(slipComputed.decimalOddsEffective) : '—'} />
          <MiniStat label='Payout' value={slipComputed ? `$${slipComputed.payout}` : '—'} />
          <MiniStat label='Net Payout' value={slipComputed ? `$${slipComputed.netPayout}` : '—'} />
          <MiniStat label='Cash At Risk' value={slipComputed ? `$${slipComputed.cashAtRisk}` : '—'} />
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 8 }}>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900 }}>{value}</div>
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
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
}

const btnSmall: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
  fontSize: 13,
}

const btnDanger: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #f1c3c3',
  background: 'white',
  cursor: 'pointer',
  fontSize: 13,
}
