export function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string | null | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? undefined : date
}

export function nightsBetween(a: Date, b: Date) {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** First day of the 2027 season, used as the earliest bookable date in the demo. */
export const SEASON_START = new Date(2027, 4, 1)
export const SEASON_END = new Date(2027, 9, 31)

/** Minimum stay for the rooms (the owner's booking terms). */
export const MIN_NIGHTS = 5

/**
 * The last check-out the owner's VikBooking accepts: it is closed from 16 Oct 2027 (live searches, 25 Nov 2026; facts.md,
 * "Booking engine and payments"). Room stays end here; SEASON_END still applies to everything else. Move it when the
 * owner opens later dates in VikBooking.
 */
export const ROOMS_LAST_CHECKOUT = new Date(2027, 9, 15)

/** Today at 00:00, local time. */
export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** The first day a room stay can start: today or the first day of the season, whichever is later. */
export function firstBookableDay() {
  const today = startOfToday()
  return today > SEASON_START ? today : SEASON_START
}

/**
 * A room stay is valid when it starts on or after the first bookable day (`first`, today by default), ends by the last
 * check-out VikBooking accepts and lasts at least the minimum stay.
 */
export function validStay(from?: Date, to?: Date, minNights = MIN_NIGHTS, first: Date = firstBookableDay()): boolean {
  return !!(from && to && from >= first && to <= ROOMS_LAST_CHECKOUT && nightsBetween(from, to) >= minNights)
}

/** Deterministic pseudo-random number in [0,1) from a string — used for demo availability. */
export function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
