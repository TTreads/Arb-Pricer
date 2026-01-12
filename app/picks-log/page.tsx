// app/picks-log/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { listDayLogsSortedDesc, type DayLog } from '@/lib/picksLog'

function formatDayLabel(dayKey: string): string {
  // dayKey is YYYY-MM-DD, display as "11 JAN 2026"
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)

  const dd = String(dt.getDate()).padStart(2, '0')
  const mon = dt.toLocaleString(undefined, { month: 'short' }).toUpperCase()
  const yyyy = dt.getFullYear()

  return `${dd} ${mon} ${yyyy}`
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export default function PicksLogPage() {
  const [mounted, setMounted] = useState(false)
  const [days, setDays] = useState<DayLog[]>([])

  useEffect(() => {
    setDays(listDayLogsSortedDesc())
    setMounted(true)
  }, [])

  const totals = useMemo(() => {
    const totalPicks = days.reduce((s, d) => s + (d.picks?.length ?? 0), 0)
    const totalStaked = round2(
      days.reduce((s, d) => s + (d.picks ?? []).reduce((s2, p) => s2 + (p.amount ?? 0), 0), 0)
    )
    return { totalPicks, totalStaked }
  }, [days])

  if (!mounted) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, opacity: 0.7 }}>
        Loading picks log…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Picks Log</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Total picks: <b>{totals.totalPicks}</b> · Total staked: <b>${totals.totalStaked.toFixed(2)}</b>
        </div>
      </div>

      {days.length === 0 ? (
        <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12, padding: 14, opacity: 0.75 }}>
          No picks logged yet.
        </div>
      ) : (
        <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12 }}>
          {days.map((day, idx) => {
            const picks = day.picks ?? []
            const dayTotal = round2(picks.reduce((s, p) => s + (p.amount ?? 0), 0))

            return (
              <div key={day.dayKey} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{formatDayLabel(day.dayKey)}</div>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    Picks: <b>{picks.length}</b> · Total: <b>${dayTotal.toFixed(2)}</b>
                  </div>
                </div>

                {picks.length === 0 ? (
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>No picks for this day.</div>
                ) : (
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {picks.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          border: '1px solid #eee',
                          borderRadius: 12,
                          padding: 12,
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 10,
                          alignItems: 'start',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>{p.pick}</div>
                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                            {p.market} · {p.oddsAmerican > 0 ? `+${p.oddsAmerican}` : p.oddsAmerican} ·{' '}
                            {p.pctOfBankroll.toFixed(2)}%
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                            Submitted: {new Date(p.submittedAt).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900 }}>${p.amount.toFixed(2)}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>To Win: ${p.toWin.toFixed(2)}</div>
                          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                            Bankroll: ${p.bankrollAtSubmit.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ✅ thin horizontal line between days */}
                {idx < days.length - 1 ? <div style={hl} /> : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const hl: React.CSSProperties = {
  marginTop: 14,
  borderTop: '1px solid #eee',
}

/* Additional Updates */
