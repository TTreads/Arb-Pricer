'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { PromoType } from '@/lib/arbMath'
import { round2 } from '@/lib/arbMath'
import type { ParlayGroup } from '@/lib/parlayArbMath'
import { computeParlayArb } from '@/lib/parlayArbMath'
import { computeBBEfficiencyFromParlay } from '@/lib/bbEfficiency'

/* =======================
   Constants
======================= */

const LS_KEY = 'parlay-arb-draft-v4'

const PROMO_LABELS: Record<PromoType, string> = {
  none: 'None',
  profit_boost: 'Profit Boost (+% profit)',
  odds_boost: 'Odds Boost (+% odds)',
  bonus_bet: 'Bonus Bet / Free Bet (stake not returned)',
  insured: 'Insured / Risk-Free (treat losing stake as refunded)',
}

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

type ParlayGroupUI = {
  id: string
  label: string
  market: string
  event: string
  headerBook?: string
  headerOddsAmerican?: number
  parlayDesc: string
  note?: string
  slips: SlipUI[]
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


function newGroupUI(partial?: Partial<ParlayGroupUI>): ParlayGroupUI {
  return {
    id: crypto.randomUUID(),
    label: 'Team Mix',
    market: '',
    event: '',
    headerBook: '',
    headerOddsAmerican: 0,
    parlayDesc: '',
    note: '',
    slips: [newSlipUI()],
    ...partial,
  }
}


/* =======================
   Parsing
======================= */

function parseNum(raw: string, fallback = 0): number {
  const s = raw.trim()
  if (s === '' || s === '-' || s === '+') return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function toParlayGroups(groupsUI: ParlayGroupUI[]): ParlayGroup[] {
  return groupsUI.map((g) => {
    return {
      id: g.id,
      label: g.label,
      market: g.market,
      event: g.event,
      headerBook: g.headerBook,
      headerOddsAmerican: g.headerOddsAmerican,
      parlayDesc: g.parlayDesc,
      note: g.note,
      slips: g.slips.map((s) => {
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
      }),
    }
  })
}


/* =======================
   Page
======================= */

export default function ParlayArbPage() {
  const [groupsUI, setGroupsUI] = useState<ParlayGroupUI[]>([
    newGroupUI({ label: 'Team Favs' }),
    newGroupUI({ label: 'Team Dogs' }),
    newGroupUI({ label: 'Team Mix 1' }),
    newGroupUI({ label: 'Team Mix 2' }),
  ])


  /* ---------- persistence ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setGroupsUI(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(groupsUI))
    } catch {}
  }, [groupsUI])

  /* ---------- computed ---------- */

  const groups: ParlayGroup[] = useMemo(() => toParlayGroups(groupsUI), [groupsUI])
  const computed = useMemo(() => computeParlayArb(groups), [groups])
  const bb = useMemo(() => computeBBEfficiencyFromParlay(groups), [groups])

  /* ---------- helpers ---------- */

  function updateGroup(id: string, patch: Partial<ParlayGroupUI>) {
    setGroupsUI((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  function updateSlip(groupId: string, slipId: string, patch: Partial<SlipUI>) {
    setGroupsUI((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          slips: g.slips.map((s) =>
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
          ),
        }
      }),
    )
  }

  function addSlip(groupId: string) {
    setGroupsUI((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, slips: [...g.slips, newSlipUI()] } : g)),
    )
  }

  function removeSlip(groupId: string, slipId: string) {
    setGroupsUI((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const slips = g.slips.filter((s) => s.id !== slipId)
        return { ...g, slips: slips.length ? slips : [newSlipUI()] }
      }),
    )
  }

  function addGroup() {
    setGroupsUI((prev) => [...prev, newGroupUI({ label: `Team Mix ${prev.length - 1}` })])
  }

  function removeGroup(id: string) {
    setGroupsUI((prev) => prev.filter((g) => g.id !== id))
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'system-ui, -apple-system' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Parlay Arb</h1>
        <button onClick={addGroup} style={btn}>
          + Add Bucket
        </button>
      </div>

      {/* ---------- RESULTS SUMMARY ---------- */}
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 14,
          marginTop: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>Results</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
              Net win per bucket = bucket Net Payout − cash at risk on all other buckets.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Badge label='Min' value={`$${round2(Math.min(...computed.netWins)).toFixed(2)}`} />
            <Badge label='Max' value={`$${round2(Math.max(...computed.netWins)).toFixed(2)}`} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          {computed.netWins.map((v, i) => (
            <OutcomeCard
              key={groupsUI[i]?.id ?? i}
              label={groupsUI[i]?.label ?? `Bucket ${i + 1}`}
              title='Net win if this bucket hits'
              value={v}
            />
          ))}
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
              {bb.netWins.map((nv, i) => (
                <MiniCard
                  key={i}
                  label={groupsUI[i]?.label ?? `Bucket ${i + 1}`}
                  value={`$${nv.toFixed(2)} → ${bb.efficiencies[i].toFixed(2)}x`}
                />
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 13 }}>
              <b>MIN BB EFF:</b> {bb.minEfficiency.toFixed(2)}x
            </div>
          </div>
        ) : null}
      </div>

      {/* ---------- GROUPS ---------- */}
      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {groupsUI.map((g, gi) => {
          const cg = computed.groups[gi]
          const netWin = computed.netWins[gi]

          return (
            <div key={g.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 900 }}>{g.label}</div>
                <button onClick={() => removeGroup(g.id)} style={btnDanger}>
                  Remove Bucket
                </button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label='Market'>
                    <input
                      value={g.market}
                      onChange={(e) => updateGroup(g.id, { market: e.target.value })}
                      placeholder='Parlay / SGP / ML / etc'
                      style={inputStyle}
                    />
                  </Field>

                  <Field label='Event'>
                    <input
                      value={g.event}
                      onChange={(e) => updateGroup(g.id, { event: e.target.value })}
                      placeholder='CHI-LAC'
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Field label='Bucket label'>
                  <input
                    value={g.label}
                    onChange={(e) => updateGroup(g.id, { label: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: 10 }}>
                <Field label='Parlay description'>
                  <input
                    value={g.parlayDesc}
                    onChange={(e) => updateGroup(g.id, { parlayDesc: e.target.value })}
                    placeholder='Parlay CHI & LAC'
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: 10 }}>
                <b>Net Win if this bucket hits:</b>{' '}
                <span style={{ fontSize: 18, fontWeight: 900 }}>${round2(netWin).toFixed(2)}</span>
              </div>

              <div style={{ marginBottom: 10 }}>
                <button onClick={() => addSlip(g.id)} style={btnSmall}>
                  + Add Stake
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {g.slips.map((s, si) => {
                  const promoType = s.promo.type
                  const needsBoost = promoType === 'profit_boost' || promoType === 'odds_boost'
                  const isBB = promoType === 'bonus_bet'
                  const slipComputed = cg?.slips?.[si]

                  return (
                    <div
                      key={s.id}
                      style={{
                        border: '1px solid #eee',
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>Stake {si + 1}</div>
                        <button onClick={() => removeSlip(g.id, s.id)} style={btnDanger}>
                          Remove
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                        <Field label='Book'>
                          <input
                            value={s.book}
                            onChange={(e) => updateSlip(g.id, s.id, { book: e.target.value })}
                            style={inputStyle}
                          />
                        </Field>

                        <Field label='Odds (American)'>
                          <input
                            value={s.oddsAmerican}
                            onChange={(e) => updateSlip(g.id, s.id, { oddsAmerican: e.target.value })}
                            placeholder='+236'
                            style={inputStyle}
                          />
                        </Field>

                        <Field label='Stake'>
                          <input
                            value={s.stake}
                            onChange={(e) => updateSlip(g.id, s.id, { stake: e.target.value })}
                            placeholder='18'
                            style={inputStyle}
                          />
                        </Field>

                        <Field label='Promo type'>
                          <select
                            value={promoType}
                            onChange={(e) => {
                              const next = e.target.value as PromoType
                              updateSlip(g.id, s.id, {
                                promo: {
                                  ...s.promo,
                                  type: next,
                                  boostPct: next === 'profit_boost' || next === 'odds_boost' ? s.promo.boostPct : '0',
                                  bbValue: next === 'bonus_bet' ? s.promo.bbValue : '0',
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
                              value={s.promo.boostPct}
                              onChange={(e) =>
                                updateSlip(g.id, s.id, { promo: { ...s.promo, boostPct: e.target.value } })
                              }
                              placeholder='10'
                              style={{ ...inputStyle, opacity: needsBoost ? 1 : 0.5 }}
                            />
                          </Field>

                          <Field label='BB value ($)'>
                            <input
                              disabled={!isBB}
                              value={s.promo.bbValue}
                              onChange={(e) =>
                                updateSlip(g.id, s.id, { promo: { ...s.promo, bbValue: e.target.value } })
                              }
                              placeholder='20'
                              style={{ ...inputStyle, opacity: isBB ? 1 : 0.5 }}
                            />
                          </Field>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        <Field label='Promo note (optional)'>
                          <input
                            value={s.promo.note}
                            onChange={(e) => updateSlip(g.id, s.id, { promo: { ...s.promo, note: e.target.value } })}
                            placeholder='notes...'
                            style={inputStyle}
                          />
                        </Field>

                        <Field label='Payout override (optional)'>
                          <input
                            value={s.payoutOverride}
                            onChange={(e) => updateSlip(g.id, s.id, { payoutOverride: e.target.value })}
                            placeholder='Leave blank to auto-calc'
                            style={inputStyle}
                          />
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
                })}
              </div>

              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
                Total Net (bucket): <b>${cg?.totalNetPayout?.toFixed(2) ?? '0.00'}</b> · Total Risk:{' '}
                <b>${cg?.totalCashAtRisk?.toFixed(2) ?? '0.00'}</b>
              </div>
            </div>
          )
        })}
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
