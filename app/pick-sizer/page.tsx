// app/pick-sizer/page.tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  addPickToDayLog,
  getTodayDayKey,
  loadDayLogs,
  loadTodaysPicks,
  removePickFromDayLog,
  type LoggedPick,
  type DayLog,
} from '@/lib/picksLog'

type PlayType = 'pre' | 'live' | 'non_sys_pre' | 'non_sys_live'

const PLAYTYPE_OPTIONS: { value: PlayType; label: string }[] = [
  { value: 'pre', label: 'Pre-Match' },
  { value: 'live', label: 'Live' },
  { value: 'non_sys_pre', label: 'Non-Sys Pre-Match' },
  { value: 'non_sys_live', label: 'Non-Sys Live' },
]

type RowUI = {
  id: string
  pick: string
  market: MarketValue
  oddsAmerican: string
  pctOfBankroll: string
  playType: PlayType
  // ✅ amount is auto-calculated, but can be overridden in UI
  amountOverride: string // '' = no override
  status: 'draft' | 'submitted'
  submittedAt?: string // ISO
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

// ✅ added PlayType column + wider actions column
const GRID_COLS =
  '44px minmax(22ch, 2.4fr) minmax(12ch, 1.2fr) minmax(10ch, 1.1fr) minmax(7ch, 0.8fr) minmax(10ch, 0.9fr) minmax(9ch, 0.9fr) minmax(9ch, 0.9fr) 220px'

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
    playType: 'pre',
    amountOverride: '',
    status: 'draft',
    submittedAt: undefined,
    ...partial,
  }
}

function formatDayLabel(dayKey: string): string {
  // dayKey is YYYY-MM-DD, display as "11 JAN 2026"
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)

  const dd = String(dt.getDate()).padStart(2, '0')
  const mon = dt.toLocaleString(undefined, { month: 'short' }).toUpperCase()
  const yyyy = dt.getFullYear()

  return `${dd} ${mon} ${yyyy}`
}

export default function PickSizerPage() {
  const [bankrollLocked, setBankrollLocked] = useState<number>(0)
  const [bankrollDraft, setBankrollDraft] = useState<string>('')
  const [isOverride, setIsOverride] = useState<boolean>(false)

  const [rows, setRows] = useState<RowUI[]>([newRow()])

  // ✅ day-grouped logs
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>({})

  // ✅ hydration-safe rendering
  const [mounted, setMounted] = useState<boolean>(false)

  // ✅ per-row "edit amount" toggle
  const [editingAmountIds, setEditingAmountIds] = useState<Record<string, boolean>>({})

  function loadBankrollSize(): BankrollSizeLS | null {
    try {
      const raw = localStorage.getItem(BANKROLL_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<BankrollSizeLS>
      const bankroll = Number(parsed.bankroll)
      if (!Number.isFinite(bankroll) || bankroll <= 0) return null
      return {
        bankroll,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  function saveBankrollSize(bankroll: number) {
    const payload: BankrollSizeLS = {
      bankroll,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(BANKROLL_KEY, JSON.stringify(payload))
  }

  /* ---------- persistence ---------- */
  useEffect(() => {
    const bs = loadBankrollSize()
    if (bs) {
      // eslint-disable-next-line
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
      if (parsed?.rows?.length) {
        setRows(
          parsed.rows.map((r) => ({
            ...newRow(),
            ...r,
            playType: (r as any).playType ?? 'pre',
            amountOverride: (r as any).amountOverride ?? '',
            status: (r as any).status ?? 'draft',
            submittedAt: (r as any).submittedAt,
          }))
        )
      }
    } catch { }

    try {
      setDayLogs(loadDayLogs())
    } catch { }

    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ rows }))
    } catch { }
  }, [rows])

  /* ---------- computed ---------- */
  const computed = useMemo(() => {
    const b = bankrollLocked
    return rows.map((r) => {
      const odds = parseNum(r.oddsAmerican, 0)
      const pct = parseNum(r.pctOfBankroll, 0)

      const autoAmount = b > 0 ? b * (pct / 100) : 0
      const overrideAmount = parseNum(r.amountOverride, NaN)
      const amount = Number.isFinite(overrideAmount) && overrideAmount > 0 ? overrideAmount : autoAmount

      const toWin = americanToWin(amount, odds)

      return {
        ...r,
        autoAmount: round2(autoAmount),
        amount: round2(amount),
        toWin: round2(toWin),
      }
    })
  }, [bankrollLocked, rows])

  const totalAmount = useMemo(
    () => round2(computed.reduce((sum, r) => sum + r.amount, 0)),
    [computed]
  )

  // ✅ Today's picks
  const todayKey = useMemo(() => getTodayDayKey(), [])
  const todaysLogged = useMemo(
    () => dayLogs?.[todayKey]?.picks ?? loadTodaysPicks(),
    [dayLogs, todayKey]
  )
  const todaysTotal = useMemo(
    () => round2(todaysLogged.reduce((s, x) => s + x.amount, 0)),
    [todaysLogged]
  )

  /* ---------- actions ---------- */
  function updateRow(id: string, patch: Partial<RowUI>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function reset() {
    setRows([newRow(), newRow()])
  }

  function toggleEditAmount(rowId: string) {
    setEditingAmountIds((prev) => ({ ...prev, [rowId]: !prev[rowId] }))
    // if turning OFF edit mode, keep whatever override is there; user can clear it with "Auto"
  }

  function setAutoAmount(rowId: string) {
    updateRow(rowId, { amountOverride: '' })
    setEditingAmountIds((prev) => ({ ...prev, [rowId]: false }))
  }

  function submitPick(rowId: string) {
    const row = computed.find((r) => r.id === rowId)
    if (!row) return

    const pickText = row.pick.trim()
    const market = row.market
    const odds = parseNum(row.oddsAmerican, 0)
    const pct = parseNum(row.pctOfBankroll, 0)
    const playType = row.playType

    if (!pickText || !market || odds === 0 || pct <= 0 || bankrollLocked <= 0) return

    const submittedAt = new Date().toISOString()

    const item: LoggedPick = {
      id: row.id,
      pick: pickText,
      market,
      oddsAmerican: odds,
      pctOfBankroll: pct,
      amount: row.amount, // ✅ uses override if provided, otherwise auto
      toWin: row.toWin,
      bankrollAtSubmit: bankrollLocked,
      submittedAt,
      // ✅ NEW: play type / bucket
      playType,
    } as any

    addPickToDayLog(item)
    setDayLogs(loadDayLogs())

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, status: 'submitted', submittedAt } : r
      )
    )

    // close edit amount after submit
    setEditingAmountIds((prev) => ({ ...prev, [rowId]: false }))
  }

  function unsubmitPick(rowId: string) {
    const dk = getTodayDayKey()
    removePickFromDayLog(dk, rowId)
    setDayLogs(loadDayLogs())

    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, status: 'draft', submittedAt: undefined } : r
      )
    )
  }

  function removeRow(rowId: string) {
    const dk = getTodayDayKey()
    removePickFromDayLog(dk, rowId)
    setDayLogs(loadDayLogs())
    setRows((prev) => prev.filter((r) => r.id !== rowId))
    setEditingAmountIds((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
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

      <div
        style={{
          marginTop: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
          overflowX: 'auto',
        }}
      >
        <div style={thead}>
          <div>#</div>
          <div>Pick</div>
          <div>Market</div>
          <div>Type</div>
          <div>Line</div>
          <div>% of Bankroll</div>
          <div>Amount</div>
          <div>To Win</div>
          <div />
        </div>

        {computed.map((r, idx) => {
          const isSubmitted = r.status === 'submitted'
          const isEditingAmount = !!editingAmountIds[r.id]

          return (
            <div key={r.id} style={trow}>
              <div style={{ fontWeight: 800 }}>{idx + 1}</div>

              <input
                value={r.pick}
                onChange={(e) => updateRow(r.id, { pick: e.target.value })}
                placeholder='Vegas Golden Knights ML (NHL — 8PM EST)'
                style={{ ...inputStyle, opacity: isSubmitted ? 0.65 : 1 }}
                disabled={isSubmitted}
              />

              <select
                value={r.market ?? ''}
                onChange={(e) =>
                  updateRow(r.id, { market: e.target.value as MarketValue })
                }
                style={{ ...inputStyle, opacity: isSubmitted ? 0.65 : 1 }}
                disabled={isSubmitted}
              >
                {MARKET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={r.playType}
                onChange={(e) => updateRow(r.id, { playType: e.target.value as PlayType })}
                style={{ ...inputStyle, opacity: isSubmitted ? 0.65 : 1 }}
                disabled={isSubmitted}
              >
                {PLAYTYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                value={r.oddsAmerican}
                onChange={(e) => updateRow(r.id, { oddsAmerican: e.target.value })}
                placeholder='+103'
                style={{ ...inputStyle, opacity: isSubmitted ? 0.65 : 1 }}
                disabled={isSubmitted}
              />

              <input
                value={r.pctOfBankroll}
                onChange={(e) =>
                  updateRow(r.id, { pctOfBankroll: e.target.value })
                }
                placeholder='2.20'
                style={{ ...inputStyle, opacity: isSubmitted ? 0.65 : 1 }}
                disabled={isSubmitted}
              />

              {/* Amount: auto display always; editable via toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 900 }}>${r.amount.toFixed(2)}</div>

                {!isSubmitted && isEditingAmount ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={r.amountOverride}
                      onChange={(e) => updateRow(r.id, { amountOverride: e.target.value })}
                      placeholder={String(r.autoAmount.toFixed(2))}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 14 }}
                    />
                    <button onClick={() => setAutoAmount(r.id)} style={btnTiny}>
                      Auto
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    Auto: ${r.autoAmount.toFixed(2)}
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 900 }}>${r.toWin.toFixed(2)}</div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                {!isSubmitted ? (
                  <>
                    <button onClick={() => toggleEditAmount(r.id)} style={btnMutedSmall}>
                      {isEditingAmount ? 'Done' : 'Edit Amount'}
                    </button>
                    <button onClick={() => submitPick(r.id)} style={btnPrimary}>
                      Submitted
                    </button>
                  </>
                ) : (
                  <button onClick={() => unsubmitPick(r.id)} style={btnMuted}>
                    Submitted ✓
                  </button>
                )}

                <button onClick={() => removeRow(r.id)} style={btnDanger}>
                  Remove
                </button>
              </div>

              {isSubmitted && r.submittedAt ? (
                <div
                  style={{
                    gridColumn: '2 / -1',
                    fontSize: 12,
                    opacity: 0.65,
                    marginTop: 2,
                  }}
                >
                  Submitted: {new Date(r.submittedAt).toLocaleString()}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Notes: To Win is computed from American odds. Amount = bankroll × (%/100) unless overridden.
      </div>

      {/* Today’s Logged Picks */}
      {mounted ? (
        <div style={{ marginTop: 18, border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {formatDayLabel(todayKey)} — Logged Picks
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Total staked today: <b>${todaysTotal.toFixed(2)}</b> · Picks: <b>{todaysLogged.length}</b>
            </div>
          </div>

          {todaysLogged.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
              No picks logged yet today.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              {todaysLogged.map((p: any) => (
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
                      {p.market}
                      {p.playType ? ` · ${labelPlayType(p.playType as PlayType)}` : ''}
                      {' · '}
                      {p.oddsAmerican > 0 ? `+${p.oddsAmerican}` : p.oddsAmerican} · {p.pctOfBankroll.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                      Submitted: {new Date(p.submittedAt).toLocaleTimeString()}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900 }}>${p.amount.toFixed(2)}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>To Win: ${p.toWin.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 18, border: '1px solid #ddd', borderRadius: 12, padding: 14, opacity: 0.6 }}>
          Loading today&apos;s picks…
        </div>
      )}
    </div>
  )
}

function labelPlayType(pt: PlayType): string {
  const hit = PLAYTYPE_OPTIONS.find((x) => x.value === pt)
  return hit ? hit.label : pt
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
  const changed =
    isOverride && parseNum(bankrollDraft, bankrollLocked) !== bankrollLocked

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

const thead: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 10,
  padding: '10px 12px',
  background: '#f7f7f7',
  borderBottom: '1px solid #ddd',
  fontWeight: 900,
  alignItems: 'center',
  minWidth: 1080,
}

const trow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
  alignItems: 'center',
  minWidth: 1080,
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
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
  fontWeight: 900,
}

const btnMuted: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fafafa',
  cursor: 'pointer',
  fontWeight: 900,
  opacity: 0.85,
}

const btnMutedSmall: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fafafa',
  cursor: 'pointer',
  fontWeight: 900,
  opacity: 0.9,
}

const btnTiny: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
  fontWeight: 900,
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
