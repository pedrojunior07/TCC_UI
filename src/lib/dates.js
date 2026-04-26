function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toIsoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseFlexibleDate(value) {
  const s = String(value ?? '').trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const ts = Date.parse(s)
  if (!Number.isNaN(ts)) return new Date(ts)
  return null
}

export function parseFlexibleDateTime(dateStr, timeStr) {
  const d = parseFlexibleDate(dateStr)
  if (!d) return null
  const t = String(timeStr ?? '').trim()
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  }
  return d
}

export function formatMonthKey(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function addDays(date, days) {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}

export function startOfIsoWeek(date) {
  const d = new Date(date.getTime())
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (day - 1))
  return d
}

export function isoWeekRef(date) {
  const d = startOfIsoWeek(date)
  const thursday = addDays(d, 3)
  const year = thursday.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const week1Start = startOfIsoWeek(jan4)
  const diffDays = Math.round((d.getTime() - week1Start.getTime()) / 86400000)
  const week = 1 + Math.floor(diffDays / 7)
  return `${year}-W${pad2(week)}`
}

export function weekRangeLabel(weekRef) {
  const m = String(weekRef ?? '').match(/^(\d{4})-W(\d{2})$/)
  if (!m) return ''
  const year = Number(m[1])
  const week = Number(m[2])
  const jan4 = new Date(year, 0, 4)
  const week1Start = startOfIsoWeek(jan4)
  const start = addDays(week1Start, (week - 1) * 7)
  const end = addDays(start, 6)
  return `${toIsoDate(start)}..${toIsoDate(end)}`
}

export function nextWeekRef(weekRef, deltaWeeks) {
  const m = String(weekRef ?? '').match(/^(\d{4})-W(\d{2})$/)
  const base = m ? new Date(Number(m[1]), 0, 4) : new Date()
  const start = m ? (() => {
    const jan4 = new Date(Number(m[1]), 0, 4)
    const week1Start = startOfIsoWeek(jan4)
    return addDays(week1Start, (Number(m[2]) - 1) * 7)
  })() : startOfIsoWeek(base)
  const moved = addDays(start, deltaWeeks * 7)
  return isoWeekRef(moved)
}
