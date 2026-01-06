'use client'

import React, { useEffect, useMemo, useState } from 'react'

type RowUI = {
  id: string
  pick: string
  oddsAmerican: string // string for smooth typing
  pctOfBankroll: string // string, e.g. "2.20"
}

const LS_KEY = 'picksizer-draft-v1'

function parseNum(raw: string, fallback = 0): number {
  const s = raw.trim()
  if (s === '' || s === '-' || s === '+') return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function americanToWin(stake: number, oddsAmerican: number): number {
  if (!Number.isFinite(stake) || stake < 0) return 0
  if (!Number.isFinite(oddsAmerican) || oddsAmerican === 0) return 0
  if (oddsAmerican > 0) return stake * (oddsAmerican / 100)
  return stake * (100 / Math.abs(oddsAmerican))
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function newRow(partial?: Partial<RowUI>): RowUI {
  return {
    id: crypto.randomUUID(),
    pick: '',
    oddsAmerican: '',
    pctOfBankroll: '',
    ...partial,
  }
}

export default function PickSizerPage() {
  const [bankroll, setBankroll] = useState<string>('')

  const [rows, setRows] = useState<RowUI[]>([
    newRow({ pick: '', oddsAmerican: '', pctOfBankroll: '' }),
  ])

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { bankroll: string; rows: RowUI[] }
      if (parsed?.rows?.length) setRows(parsed.rows)
      if (typeof parsed?.bankroll === 'string') setBankroll(parsed.bankroll)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ bankroll, rows }))
    } catch {}
  }, [bankroll, rows])

  /* ---------- computed ---------- */
  const computed = useMemo(() => {
    const b = parseNum(bankroll, 0)

    return rows.map((r) => {
      const odds = parseNum(r.oddsAmerican, 0)
      const pct = parseNum(r.pctOfBankroll, 0) // e.g. 2.2 means 2.2%
      const amount = b > 0 ? b * (pct / 100) : 0
      const toWin = americanToWin(amount, odds)

      return {
        ...r,
        amount: round2(amount),
        toWin: round2(toWin),
      }
    })
  }, [bankroll, rows])

  const totalAmount = useMemo(() => round2(computed.reduce((sum, r) => sum + r.amount, 0)), [computed])

  /* ---------- actions ---------- */
  function updateRow(id: string, patch: Partial<RowUI>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function reset() {
    setBankroll('')
    setRows([newRow(), newRow()])
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'system-ui, -apple-system' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Pick Sizer</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={addRow} style={btn}>
            + Add Pick
          </button>
          <button onClick={reset} style={btn}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Your bankroll</div>
            <input
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              placeholder='2500'
              style={inputStyle}
            />
          </div>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Enter each pick’s <b>% of bankroll</b>. We’ll calculate your <b>Amount</b> and <b>To Win</b>.
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Total staked (all picks): <b>${totalAmount.toFixed(2)}</b>
        </div>
      </div>

      <div style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
        <div style={thead}>
          <div style={{ width: 60 }}>#</div>
          <div style={{ flex: 1 }}>Pick</div>
          <div style={{ width: 140 }}>Line</div>
          <div style={{ width: 160 }}>% of Bankroll</div>
          <div style={{ width: 160 }}>Amount</div>
          <div style={{ width: 160 }}>To Win</div>
          <div style={{ width: 90 }} />
        </div>

        {computed.map((r, idx) => (
          <div key={r.id} style={trow}>
            <div style={{ width: 60, fontWeight: 800 }}>{idx + 1}</div>

            <div style={{ flex: 1 }}>
              <input
                value={r.pick}
                onChange={(e) => updateRow(r.id, { pick: e.target.value })}
                placeholder='Vegas Golden Knights ML (NHL – 8PM EST)'
                style={inputStyle}
              />
            </div>

            <div style={{ width: 140 }}>
              <input
                value={r.oddsAmerican}
                onChange={(e) => updateRow(r.id, { oddsAmerican: e.target.value })}
                placeholder='+103'
                style={inputStyle}
              />
            </div>

            <div style={{ width: 160 }}>
              <input
                value={r.pctOfBankroll}
                onChange={(e) => updateRow(r.id, { pctOfBankroll: e.target.value })}
                placeholder='2.20'
                style={inputStyle}
              />
            </div>

            <div style={{ width: 160, fontWeight: 900 }}>${r.amount.toFixed(2)}</div>
            <div style={{ width: 160, fontWeight: 900 }}>${r.toWin.toFixed(2)}</div>

            <div style={{ width: 90, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => removeRow(r.id)} style={btnDanger}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Notes: To Win is computed from American odds. Amount = bankroll × (%/100).
      </div>
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
