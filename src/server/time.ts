// Dates and times on the boat's clock. Departure dates are Greek calendar days (YYYY-MM-DD) and times are
// Greek wall-clock times (HH:MM), so "today" and "tomorrow" are always computed in Europe/Athens, never in
// the server's own time zone (Vercel runs in UTC).

export const TIME_ZONE = 'Europe/Athens'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** true for a real calendar day written YYYY-MM-DD */
export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = ISO_DATE.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** true for a 24-hour time such as "09:00" */
export const isHHMM = (s: unknown): s is string => typeof s === 'string' && HH_MM.test(s)

export const toMinutes = (hhmm: string) => {
  const m = HH_MM.exec(hhmm)
  return m ? +m[1] * 60 + +m[2] : NaN
}

export const toHHMM = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** UTC midnight of a calendar day, for weekday maths and Intl formatting with timeZone UTC. */
export function utcDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const isoOf = (d: Date) => d.toISOString().slice(0, 10)

export const addDaysISO = (iso: string, n: number) => {
  const d = utcDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoOf(d)
}

/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (iso: string) => utcDate(iso).getUTCDay()

export const daysBetween = (a: string, b: string) => Math.round((utcDate(b).getTime() - utcDate(a).getTime()) / 86400000)

/** The current day and minute of the day in Greece. */
export function athensNow(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: +get('hour') * 60 + +get('minute') }
}

/** The UTC instant of a Greek wall-clock time (handles summer time). */
export function athensInstant(iso: string, hhmm: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const mins = toMinutes(hhmm)
  const guess = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60)
  const offset = (at: number) => {
    const local = athensNow(new Date(at))
    const asUtc = utcDate(local.date).getTime() + local.minutes * 60000
    return asUtc - Math.floor(at / 60000) * 60000
  }
  const first = guess - offset(guess)
  return new Date(guess - offset(first))
}
