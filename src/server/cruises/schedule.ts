// Schedule, prices and seats: what the public pages read and what every booking is checked against.

import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { Schedule } from '@/lib/cruiseStore'
import { getDb, type Queryable } from '../db/client'
import { ConfigError } from '../env'
import { errorText, log } from '../log'
import { appSettings, bookings, cruiseSettings, departureOverrides, type OverrideRow, type SettingsRow } from '../db/schema'
import { addDaysISO, athensNow, isISODate, toMinutes, weekdayOf } from '../time'
import { BOOKING_CUTOFF_MINUTES, DEFAULT_SEASON, isScheduledKey, pickupTimes, SCHEDULED_KEYS, type PickupTimes, type ScheduledKey } from './catalog'

export type Season = { start: string; end: string }
export type DepartureStatus = 'open' | 'cancelled' | 'closed' | 'soldout' | 'past'

/** Seats a booking takes: infants travel free but count towards the boat's licence. */
export const seatsSql = sql<number>`(${bookings.adults} + ${bookings.children} + ${bookings.infants})`

export async function loadSettings(q: Queryable): Promise<Map<ScheduledKey, SettingsRow>> {
  const rows = await q.select().from(cruiseSettings)
  return new Map(rows.filter((r) => isScheduledKey(r.cruise)).map((r) => [r.cruise as ScheduledKey, r]))
}

export async function loadSeason(q: Queryable): Promise<Season> {
  const [row] = await q.select().from(appSettings).where(eq(appSettings.key, 'season'))
  const v = row?.value as Partial<Season> | undefined
  return v && isISODate(v.start) && isISODate(v.end) ? { start: v.start, end: v.end } : DEFAULT_SEASON
}

export const depKey = (cruise: string, date: string) => `${cruise}:${date}`

export async function loadOverrides(q: Queryable, from: string, to: string, cruises?: string[]) {
  const rows = await q
    .select()
    .from(departureOverrides)
    .where(and(gte(departureOverrides.date, from), lte(departureOverrides.date, to), cruises ? inArray(departureOverrides.cruise, cruises) : undefined))
  return new Map(rows.map((r) => [depKey(r.cruise, r.date), r]))
}

export type SeatCount = { paid: number; held: number; refundDue: number; refunded: number; bookings: number }

/** Seats per departure: paid, held by guests who are paying right now, and those due or given a refund. */
export async function loadSeatCounts(q: Queryable, from: string, to: string, cruises?: string[]) {
  const rows = await q
    .select({
      cruise: bookings.cruise,
      date: bookings.date,
      paid: sql<number>`coalesce(sum(${seatsSql}) filter (where ${bookings.status} = 'PAID'), 0)::int`,
      held: sql<number>`coalesce(sum(${seatsSql}) filter (where ${bookings.status} = 'PENDING_PAYMENT' and ${bookings.holdExpiresAt} > now()), 0)::int`,
      refundDue: sql<number>`coalesce(sum(${seatsSql}) filter (where ${bookings.status} = 'REFUND_DUE'), 0)::int`,
      refunded: sql<number>`coalesce(sum(${seatsSql}) filter (where ${bookings.status} = 'REFUNDED'), 0)::int`,
      bookings: sql<number>`(count(*) filter (where ${bookings.status} in ('PAID', 'REFUND_DUE', 'REFUNDED')))::int`,
    })
    .from(bookings)
    .where(and(gte(bookings.date, from), lte(bookings.date, to), cruises ? inArray(bookings.cruise, cruises) : undefined))
    .groupBy(bookings.cruise, bookings.date)
  return new Map<string, SeatCount>(rows.map((r) => [depKey(r.cruise, r.date), { paid: +r.paid, held: +r.held, refundDue: +r.refundDue, refunded: +r.refunded, bookings: +r.bookings }]))
}

/** Seats taken on one departure right now (paid plus live holds), optionally leaving one booking out. */
export async function seatsTaken(q: Queryable, cruise: string, date: string, exceptBookingId?: number) {
  const [row] = await q
    .select({ n: sql<number>`coalesce(sum(${seatsSql}), 0)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.cruise, cruise),
        eq(bookings.date, date),
        sql`(${bookings.status} = 'PAID' or (${bookings.status} = 'PENDING_PAYMENT' and ${bookings.holdExpiresAt} > now()))`,
        exceptBookingId ? sql`${bookings.id} <> ${exceptBookingId}` : undefined,
      ),
    )
  return +(row?.n ?? 0)
}

export const inSeason = (season: Season, date: string) => date >= season.start && date <= season.end

/** true when the cruise normally sails that day (active, in season, on one of its weekdays) */
export const onSchedule = (setting: SettingsRow, season: Season, date: string) => setting.active && inSeason(season, date) && setting.weekdays.includes(weekdayOf(date))

export type DepartureState = {
  status: DepartureStatus
  capacity: number
  left: number
  onSchedule: boolean
  /** 'cutoff' when online booking closed because the boat leaves soon, 'admin' when the Captain closed it */
  closedBy?: 'cutoff' | 'admin'
  note?: string | null
  cancelReason?: string | null
}

export function departureState(opts: {
  setting: SettingsRow
  season: Season
  date: string
  override?: OverrideRow
  taken: number
  now?: { date: string; minutes: number }
}): DepartureState {
  const { setting, season, date, override, taken } = opts
  const now = opts.now ?? athensNow()
  const capacity = override?.capacity ?? setting.capacity
  const left = Math.max(0, capacity - taken)
  const base = { capacity, left, onSchedule: onSchedule(setting, season, date), note: override?.note ?? null, cancelReason: override?.cancelReason ?? null }
  if (date < now.date) return { ...base, status: 'past' }
  if (override?.status === 'cancelled') return { ...base, status: 'cancelled' }
  if (override?.status === 'closed') return { ...base, status: 'closed', closedBy: 'admin' }
  if (date === now.date && now.minutes >= toMinutes(setting.depart) - BOOKING_CUTOFF_MINUTES) return { ...base, status: 'closed', closedBy: 'cutoff' }
  if (left === 0) return { ...base, status: 'soldout' }
  return { ...base, status: 'open' }
}

/** Every sailing day of a cruise between two days, following its current weekdays and the season. */
export function sailingDates(setting: SettingsRow, season: Season, from: string, to: string) {
  const out: string[] = []
  if (!setting.active) return out
  const start = from > season.start ? from : season.start
  const end = to < season.end ? to : season.end
  for (let d = start; d <= end; d = addDaysISO(d, 1)) if (setting.weekdays.includes(weekdayOf(d))) out.push(d)
  return out
}

const euros = (cents: number) => Math.round(cents) / 100

export type PublicCruiseSchedule = {
  key: ScheduledKey
  active: boolean
  weekdays: number[]
  depart: string
  returnSkala: string
  times: PickupTimes
  prices: { adult: number; child: number }
  capacity: number
  updatedAt: string
}

/** GET /api/cruises/schedule */
export async function getSchedule() {
  const db = await getDb()
  const [settings, season] = await Promise.all([loadSettings(db), loadSeason(db)])
  const cruises: PublicCruiseSchedule[] = SCHEDULED_KEYS.filter((k) => settings.has(k)).map((k) => {
    const s = settings.get(k)!
    return {
      key: k,
      active: s.active,
      weekdays: s.weekdays,
      depart: s.depart,
      returnSkala: s.returnSkala,
      times: pickupTimes(k, s.depart, s.returnSkala),
      prices: { adult: euros(s.adultCents), child: euros(s.childCents) },
      capacity: s.capacity,
      updatedAt: s.updatedAt.toISOString(),
    }
  })
  return { season, today: athensNow().date, cruises }
}

export type PublicDeparture = { date: string; status: DepartureStatus; left: number; capacity: number }

/** GET /api/cruises/availability: the sailing days of each cruise from `from` (default today) to `to` (default season end). */
export async function getAvailability(opts: { cruises?: ScheduledKey[]; from?: string; to?: string }) {
  const db = await getDb()
  const now = athensNow()
  const [settings, season] = await Promise.all([loadSettings(db), loadSeason(db)])
  const from = opts.from && opts.from > now.date ? opts.from : now.date
  const to = opts.to && opts.to < season.end ? opts.to : season.end
  const keys = (opts.cruises?.length ? opts.cruises : [...SCHEDULED_KEYS]).filter((k) => settings.has(k))
  const [overrides, counts] = await Promise.all([loadOverrides(db, from, to, keys), loadSeatCounts(db, from, to, keys)])
  const departures: Record<string, PublicDeparture[]> = {}
  for (const k of keys) {
    const setting = settings.get(k)!
    departures[k] = sailingDates(setting, season, from, to).map((date) => {
      const c = counts.get(depKey(k, date))
      const st = departureState({ setting, season, date, override: overrides.get(depKey(k, date)), taken: (c?.paid ?? 0) + (c?.held ?? 0), now })
      return { date, status: st.status, left: st.status === 'open' || st.status === 'soldout' ? st.left : 0, capacity: st.capacity }
    })
  }
  return { season, today: now.date, from, to, departures }
}

/**
 * The schedule as /admin saved it, for the server render of the public pages that show fares, days or times (cruise
 * pages, home). Those pages revalidate every minute, and the admin revalidates them on every change
 * (src/server/cruises/admin.ts). Null when the database cannot be read (e.g. `next build` without DATABASE_URL): the
 * pages then use the static data and the browser loads the live schedule from the API as before.
 */
export async function scheduleSeed(): Promise<Schedule | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('schedule seed timed out')), 4000)
    })
    const s = await Promise.race([getSchedule(), timeout])
    const config: Schedule['config'] = {}
    for (const c of s.cruises) config[c.key] = { weekdays: c.weekdays, depart: c.depart, returnSkala: c.returnSkala, adult: c.prices.adult, child: c.prices.child, active: c.active }
    // `today` and the payment mode stay unknown: a cached page could be older than a day; the API fills them in
    return { config, season: s.season, today: null, payments: undefined, source: 'live' }
  } catch (e) {
    if (!(e instanceof ConfigError)) log.warn('schedule.seed_failed', { error: errorText(e) })
    return null
  } finally {
    clearTimeout(timer)
  }
}
