'use client'

import React, { useEffect, useMemo, useState } from 'react'

type RowUI = {
  id: string
  pick: string
  market: MarketValue
  oddsAmerican: string
  pctOfBankroll: string
}

/* =======================
   Constants
======================= */

const LS_KEY = 'picksizer-draft-v1'
const BANKROLL_KEY = 'BankrollSize'

type BankrollSizeLS = {
  bankroll: number
  updatedAt: string // ISO
}

const MARKET_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'ML', label: 'ML' },
  { value: 'SPREAD:+OVER', label: 'SPREAD:(+)OVER' },
  { value: 'SPREAD:-UNDER', label: 'SPREAD:(-)UNDER' },
  { value: 'TOTAL:+OVER', label: 'TOTAL:(+)OVER' },
  { value: 'TOTAL:-UNDER', label: 'TOTAL:(-)UNDER' },
] as const

type MarketValue = (typeof MARKET_OPTIONS)[number]['value']

// ✅ NEW: grid column template (relative sizing + minimums)
// - Pick gets min 22 characters (22ch) and grows the most
// - Everything else has sane minimums but stays relative via fr units
const GRID_COLS =
  '44px minmax(22ch, 2.4fr) minmax(12ch, 1.2fr) minmax(7ch, 0.8fr) minmax(10ch, 0.9fr) minmax(9ch, 0.9fr) minmax(9ch, 0.9fr) 84px'

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
    market: '',
    oddsAmerican: '',
    pctOfBankroll: '',
    ...partial,
  }
}

export default function PickSizerPage() {
  const [bankrollLocked, setBankrollLocked] = useState<number>(0)
  const [bankrollDraft, setBankrollDraft] = useState<string>('')
  const [isOverride, setIsOverride] = useState<boolean>(false)

  const [rows, setRows] = useState<RowUI[]>([newRow()])

  /* ---------- persistence ---------- */
  useEffect(() => {
    const bs = loadBankrollSize()
    if (bs) {
      setBankrollLocked(bs.bankroll)
      setBankrollDraft(String(bs.bankroll))
    } else {
      setBankrollLocked(0)
      setBankrollDraft('0')
    }

    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { rows: RowUI[] }
      if (parsed?.rows?.length) setRows(parsed.rows)
    } catch { }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ rows }))
    } catch { }
  }, [rows])

  function loadBankrollSize(): BankrollSizeLS | null {
    try {
      const raw = localStorage.getItem(BANKROLL_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<BankrollSizeLS>
      const bankroll = Number(parsed.bankroll)
      if (!Number.isFinite(bankroll) || bankroll <= 0) return null
      return {
        bankroll,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  function saveBankrollSize(bankroll: number) {
    const payload: BankrollSizeLS = { bankroll, updatedAt: new Date().toISOString() }
    localStorage.setItem(BANKROLL_KEY, JSON.stringify(payload))
  }

  /* ---------- computed ---------- */
  const computed = useMemo(() => {
    const b = bankrollLocked
    return rows.map((r) => {
      const odds = parseNum(r.oddsAmerican, 0)
      const pct = parseNum(r.pctOfBankroll, 0)
      const amount = b > 0 ? b * (pct / 100) : 0
      const toWin = americanToWin(amount, odds)
      return { ...r, amount: round2(amount), toWin: round2(toWin) }
    })
  }, [bankrollLocked, rows])

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
    setRows([newRow(), newRow()])
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
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

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={isOverride ? bankrollDraft : String(bankrollLocked)}
                onChange={(e) => setBankrollDraft(e.target.value)}
                style={{ ...inputStyle, opacity: isOverride ? 1 : 0.85 }}
                disabled={!isOverride}
              />

              <BankrollOverrideButton
                bankrollLocked={bankrollLocked}
                bankrollDraft={bankrollDraft}
                isOverride={isOverride}
                onOverride={() => {
                  setIsOverride(true)
                  setBankrollDraft(String(bankrollLocked))
                }}
                onSave={() => {
                  const next = parseNum(bankrollDraft, 0)
                  if (next > 0) {
                    saveBankrollSize(next)
                    setBankrollLocked(next)
                    setIsOverride(false)
                  }
                }}
                onCancel={() => {
                  setIsOverride(false)
                  setBankrollDraft(String(bankrollLocked))
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Enter each pick&apos;s <b>% of bankroll</b>. We&apos;ll calculate your <b>Amount</b> and <b>To Win</b>.
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          Total staked (all picks): <b>${totalAmount.toFixed(2)}</b>
        </div>
      </div>

      {/* ✅ NEW: allow horizontal scroll only if needed */}
      <div
        style={{
          marginTop: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
          overflowX: 'auto',
        }}
      >
        {/* ✅ NEW: grid header (no fixed widths) */}
        <div style={thead}>
          <div>#</div>
          <div>Pick</div>
          <div>Market</div>
          <div>Line</div>
          <div>% of Bankroll</div>
          <div>Amount</div>
          <div>To Win</div>
          <div />
        </div>

        {/* ✅ NEW: grid rows (no fixed widths) */}
        {computed.map((r, idx) => (
          <div key={r.id} style={trow}>
            <div style={{ fontWeight: 800 }}>{idx + 1}</div>

            <input
              value={r.pick}
              onChange={(e) => updateRow(r.id, { pick: e.target.value })}
              placeholder='Vegas Golden Knights ML (NHL — 8PM EST)'
              style={inputStyle}
            />

            <select
              value={r.market ?? ''}
              onChange={(e) => updateRow(r.id, { market: e.target.value as MarketValue })}
              style={inputStyle}
            >
              {MARKET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              value={r.oddsAmerican}
              onChange={(e) => updateRow(r.id, { oddsAmerican: e.target.value })}
              placeholder='+103'
              style={inputStyle}
            />

            <input
              value={r.pctOfBankroll}
              onChange={(e) => updateRow(r.id, { pctOfBankroll: e.target.value })}
              placeholder='2.20'
              style={inputStyle}
            />

            <div style={{ fontWeight: 900 }}>${r.amount.toFixed(2)}</div>
            <div style={{ fontWeight: 900 }}>${r.toWin.toFixed(2)}</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

function BankrollOverrideButton({
  bankrollLocked,
  bankrollDraft,
  isOverride,
  onOverride,
  onSave,
  onCancel,
}: {
  bankrollLocked: number
  bankrollDraft: string
  isOverride: boolean
  onOverride: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const changed = isOverride && parseNum(bankrollDraft, bankrollLocked) !== bankrollLocked

  if (!isOverride) {
    return (
      <button onClick={onOverride} style={btn}>
        Override
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={changed ? onSave : onCancel} style={btn}>
        {changed ? 'Save' : 'Cancel'}
      </button>
    </div>
  )
}

/* =======================
   Styles
======================= */

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 16,
}

// ✅ NEW: grid-based header/rows using GRID_COLS (relative)
const thead: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 10,
  padding: '10px 12px',
  background: '#f7f7f7',
  borderBottom: '1px solid #ddd',
  fontWeight: 900,
  alignItems: 'center',
  minWidth: 920, // optional guardrail: forces scroll on very small screens
}

const trow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
  alignItems: 'center',
  minWidth: 920, // match header
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
