'use client'

import React, { useEffect, useMemo, useState } from 'react'

/* =======================
   Constants / LS schema
======================= */

const BANKROLL_KEY = 'BankrollSize'
const BOOKS_KEY = 'sportsbook-names-v1'

type BankrollSizeLS = {
  bankroll: number
  updatedAt: string // ISO
}

type SportsbookLS = { id: string; name: string; balance: number }

type SportsbookNamesLS = {
  cashroll: number
  books: SportsbookLS[]
  updatedAt: string // ISO
}

/* =======================
   Helpers
======================= */

function parseNum(raw: string, fallback = 0): number {
  const s = raw.trim()
  if (s === '' || s === '-' || s === '+') return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function fmtMoney(n: number): string {
  return `$${round2(n).toFixed(2)}`
}

function loadBooksLS(): SportsbookNamesLS {
  // LS notes:
  // BOOKS_KEY stores: { cashroll, books:[{id,name,balance}], updatedAt }
  try {
    const raw = localStorage.getItem(BOOKS_KEY)
    if (!raw) return { cashroll: 0, books: [], updatedAt: new Date().toISOString() }

    const parsed = JSON.parse(raw) as Partial<SportsbookNamesLS>
    const cashroll = Number(parsed.cashroll)
    const books = Array.isArray(parsed.books) ? parsed.books : []

    const normalized: SportsbookLS[] = books
      .map((b: any) => ({
        id: typeof b?.id === 'string' ? b.id : crypto.randomUUID(),
        name: typeof b?.name === 'string' ? b.name : '',
        balance: Number.isFinite(Number(b?.balance)) ? Number(b.balance) : 0,
      }))
      .filter((b) => b.name.trim().length > 0)

    return {
      cashroll: Number.isFinite(cashroll) ? cashroll : 0,
      books: normalized,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { cashroll: 0, books: [], updatedAt: new Date().toISOString() }
  }
}

function saveBooksLS(payload: SportsbookNamesLS) {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(payload))
}

function saveBankrollSize(total: number) {
  const payload: BankrollSizeLS = { bankroll: total, updatedAt: new Date().toISOString() }
  localStorage.setItem(BANKROLL_KEY, JSON.stringify(payload))
}

/* =======================
   Page
======================= */

export default function BankrollPage() {
  const [cashroll, setCashroll] = useState<number>(0)
  const [books, setBooks] = useState<SportsbookLS[]>([])

  // Cashroll deposit/withdraw flow
  const [cashMode, setCashMode] = useState<'none' | 'deposit' | 'withdraw'>('none')
  const [cashAmtDraft, setCashAmtDraft] = useState<string>('')

  // Add sportsbook state
  const [isAddingBook, setIsAddingBook] = useState(false)
  const [nameDraft, setNameDraft] = useState<string>('')
  const [balDraft, setBalDraft] = useState<string>('0')

  // Individual sportsbook cash flow
  const [bookCashId, setBookCashId] = useState<string | null>(null)
  const [bookCashMode, setBookCashMode] = useState<'none' | 'deposit' | 'withdraw'>('none')
  const [bookCashAmtDraft, setBookCashAmtDraft] = useState<string>('')

  /* ---------- load ---------- */
  useEffect(() => {
    const ls = loadBooksLS()
    setCashroll(ls.cashroll ?? 0)
    setBooks(ls.books ?? [])
  }, [])

  /* ---------- computed totals ---------- */
  const totalBankroll = useMemo(() => {
    const sumBooks = books.reduce((s, b) => s + (Number.isFinite(b.balance) ? b.balance : 0), 0)
    return round2(Math.max(0, cashroll) + Math.max(0, sumBooks))
  }, [cashroll, books])

  /* ---------- persist + keep BankrollSize synced ---------- */
  useEffect(() => {
    try {
      const payload: SportsbookNamesLS = {
        cashroll: round2(Math.max(0, cashroll)),
        books: books
          .map((b) => ({
            id: b.id,
            name: b.name.trim(),
            balance: round2(Number.isFinite(b.balance) ? Math.max(0, b.balance) : 0),
          }))
          .filter((b) => b.name.length > 0),
        updatedAt: new Date().toISOString(),
      }
      saveBooksLS(payload)
      saveBankrollSize(totalBankroll)
    } catch { }
  }, [cashroll, books, totalBankroll])

  /* ---------- cash actions (Cashroll) ---------- */

  function startCash(mode: 'deposit' | 'withdraw') {
    setCashMode(mode)
    setCashAmtDraft('')
  }

  function cancelCash() {
    setCashMode('none')
    setCashAmtDraft('')
  }

  function confirmCash() {
    const amtAbs = Math.abs(parseNum(cashAmtDraft, 0))
    if (amtAbs <= 0) return

    setCashroll((prev) => {
      const cur = Number.isFinite(prev) ? prev : 0
      if (cashMode === 'deposit') return round2(cur + amtAbs)
      if (cashMode === 'withdraw') return round2(Math.max(0, cur - amtAbs))
      return cur
    })

    cancelCash()
  }

  const cashActionColor =
    cashMode === 'deposit' ? '#111' : cashMode === 'withdraw' ? '#b42318' : '#111'

  /* ---------- sportsbook cash actions ---------- */

  function startBookCash(id: string, mode: 'deposit' | 'withdraw') {
    setBookCashId(id)
    setBookCashMode(mode)
    setBookCashAmtDraft('')
  }

  function cancelBookCash() {
    setBookCashId(null)
    setBookCashMode('none')
    setBookCashAmtDraft('')
  }

  function confirmBookCash() {
    if (!bookCashId) return
    const amtAbs = Math.abs(parseNum(bookCashAmtDraft, 0))
    if (amtAbs <= 0) return

    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== bookCashId) return b
        const cur = Number.isFinite(b.balance) ? b.balance : 0
        let next = cur
        if (bookCashMode === 'deposit') next = round2(cur + amtAbs)
        if (bookCashMode === 'withdraw') next = round2(Math.max(0, cur - amtAbs))
        return { ...b, balance: next }
      })
    )

    cancelBookCash()
  }

  const bookCashActionColor =
    bookCashMode === 'deposit' ? '#111' : bookCashMode === 'withdraw' ? '#b42318' : '#111'


  /* ---------- add sportsbook actions ---------- */

  function startAddBook() {
    setIsAddingBook(true)
    setNameDraft('')
    setBalDraft('0')
  }

  function cancelAddBook() {
    setIsAddingBook(false)
    setNameDraft('')
    setBalDraft('0')
  }

  function saveAddBook() {
    const nextName = nameDraft.trim()
    if (!nextName) {
      cancelAddBook()
      return
    }

    const nextBal = Math.max(0, parseNum(balDraft, 0))

    setBooks((prev) => {
      // Optional: prevent duplicates by name (case-insensitive)
      const exists = prev.some((b) => b.name.trim().toLowerCase() === nextName.toLowerCase())
      if (exists) return prev
      return [...prev, { id: crypto.randomUUID(), name: nextName, balance: nextBal }]
    })

    cancelAddBook()
  }

  function removeBook(id: string) {
    const b = books.find((x) => x.id === id)
    const name = b?.name ?? 'this sportsbook'
    const ok = window.confirm(`Remove ${name}?`)
    if (!ok) return
    setBooks((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Bankroll</h1>
      </div>

      {/* Summary card */}
      <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>Total Bankroll</div>
        <div style={{ fontSize: 44, fontWeight: 900, marginTop: 2 }}>{fmtMoney(totalBankroll)}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <MiniStat label='Cashroll' value={fmtMoney(cashroll)} />

          {books.length ? (
            <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>Sportsbooks</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {books.map((b) => (
                  <div
                    key={b.id}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}
                  >
                    <div style={{ fontWeight: 800 }}>{b.name}</div>
                    <div style={{ fontWeight: 900 }}>{fmtMoney(b.balance ?? 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, fontSize: 13, opacity: 0.75 }}>
              No sportsbooks added yet.
            </div>
          )}
        </div>
      </div>

      {/* Manager block */}
      <div style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
        {/* Cashroll deposit/withdraw */}
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Cashroll</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{fmtMoney(cashroll)}</div>
            </div>

            {cashMode === 'none' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startCash('deposit')} style={btn}>
                  Deposit
                </button>
                <button onClick={() => startCash('withdraw')} style={btn}>
                  Withdraw
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={cashAmtDraft}
                  onChange={(e) => setCashAmtDraft(e.target.value)}
                  placeholder='Amount'
                  style={{ ...inputStyle, width: 140, color: cashActionColor, fontWeight: 900 }}
                  autoFocus
                />
                <button onClick={confirmCash} style={btn}>
                  Confirm
                </button>
                <button onClick={cancelCash} style={btn}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {cashMode !== 'none' ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {cashMode === 'deposit' ? (
                <>
                  This will add a <b style={{ color: '#111' }}>black absolute</b> amount to Cashroll.
                </>
              ) : (
                <>
                  This will subtract a <b style={{ color: '#b42318' }}>red absolute</b> amount from Cashroll.
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Sportsbook blocks */}
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {books.map((b) => {
            const isEditing = bookCashId === b.id && bookCashMode !== 'none'
            return (
              <div
                key={b.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{b.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      Balance: <b>{fmtMoney(b.balance ?? 0)}</b>
                    </div>
                  </div>

                  {!isEditing ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startBookCash(b.id, 'deposit')} style={btn}>
                        Deposit
                      </button>
                      <button onClick={() => startBookCash(b.id, 'withdraw')} style={btn}>
                        Withdraw
                      </button>
                      <button onClick={() => removeBook(b.id)} style={btnDanger}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        value={bookCashAmtDraft}
                        onChange={(e) => setBookCashAmtDraft(e.target.value)}
                        placeholder='Amount'
                        style={{ ...inputStyle, width: 140, color: bookCashActionColor, fontWeight: 900 }}
                        autoFocus
                      />
                      <button onClick={confirmBookCash} style={btn}>
                        Confirm
                      </button>
                      <button onClick={cancelBookCash} style={btn}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    {bookCashMode === 'deposit' ? (
                      <>
                        Adding to <b>{b.name}</b>.
                      </>
                    ) : (
                      <>
                        Withdrawing from <b>{b.name}</b>.
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add new sportsbook */}
        <div style={{ marginTop: 12 }}>
          {!isAddingBook ? (
            <button onClick={startAddBook} style={btn}>
              + Add New Sportsbook
            </button>
          ) : (
            <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Add Sportsbook</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Name</div>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    style={inputStyle}
                    placeholder='Type sportsbook name…'
                    autoFocus
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Starting balance</div>
                  <input value={balDraft} onChange={(e) => setBalDraft(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={saveAddBook} style={btn}>
                  Save
                </button>
                <button onClick={cancelAddBook} style={btn}>
                  Cancel
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                Tip: Starting balance can be <b>0</b>.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =======================
   UI bits
======================= */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{value}</div>
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
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #f1c3c3',
  background: 'white',
  cursor: 'pointer',
}
