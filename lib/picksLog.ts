// lib/picksLog.ts
// LocalStorage day-grouped picks log utilities.

export type WagerTiming =
  | 'pre_match'
  | 'live'
  | 'non_sys_pre_match'
  | 'non_sys_live'

export type LoggedPick = {
  id: string
  pick: string
  market: string
  oddsAmerican: number
  pctOfBankroll: number
  // ✅ NEW
  wagerTiming: WagerTiming
  amountIsOverride?: boolean

  amount: number
  toWin: number
  bankrollAtSubmit: number
  submittedAt: string // ISO
}

export type DayLog = {
  dayKey: string // YYYY-MM-DD
  picks: LoggedPick[]
  updatedAt: string // ISO
}

const LS_DAYLOGS_KEY = 'PicksLogByDay'

// ---------- date helpers ----------

export function getTodayDayKey(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------- storage ----------

export function loadDayLogs(): Record<string, DayLog> {
  try {
    const raw = localStorage.getItem(LS_DAYLOGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DayLog>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveDayLogs(next: Record<string, DayLog>) {
  localStorage.setItem(LS_DAYLOGS_KEY, JSON.stringify(next))
}

// ---------- operations ----------

export function addPickToDayLog(pick: LoggedPick) {
  const dayKey = getTodayDayKey()
  const logs = loadDayLogs()
  const existing: DayLog = logs[dayKey] ?? { dayKey, picks: [], updatedAt: new Date().toISOString() }

  // append/merge (no overwrite). If id exists, replace it.
  const picks = [...(existing.picks ?? [])]
  const idx = picks.findIndex((p) => p.id === pick.id)
  if (idx >= 0) picks[idx] = pick
  else picks.push(pick)

  logs[dayKey] = { dayKey, picks, updatedAt: new Date().toISOString() }
  saveDayLogs(logs)
}

export function removePickFromDayLog(dayKey: string, pickId: string) {
  const logs = loadDayLogs()
  const existing = logs[dayKey]
  if (!existing?.picks?.length) return

  const nextPicks = existing.picks.filter((p) => p.id !== pickId)
  logs[dayKey] = { ...existing, picks: nextPicks, updatedAt: new Date().toISOString() }
  saveDayLogs(logs)
}

export function loadTodaysPicks(): LoggedPick[] {
  const logs = loadDayLogs()
  const dk = getTodayDayKey()
  return logs?.[dk]?.picks ?? []
}

// Used by your log page (and anything else)
export function listDayLogsSortedDesc(): DayLog[] {
  const logs = loadDayLogs()
  const days = Object.values(logs)
  return days.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
}
