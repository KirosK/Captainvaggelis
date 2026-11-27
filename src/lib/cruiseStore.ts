'use client'

// Live data layer of the public cruise pages. The days, times, fares and seats left come from the booking API
// (src/app/api/cruises/*), which reads the database that /admin edits. Until the first answer arrives, and whenever
// the API cannot be reached, the components use the static schedule in src/data/cruises.ts, so the server HTML and
// the first client render are identical and the pages never break.

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { boat, cruises, type Cruise } from '@/data/cruises'
import { fromISO, SEASON_END, SEASON_START, toISO } from './dates'

/** The boat's licence (NIRIIS): every passenger, infants included, takes one of these seats. */
export const CAPACITY = boat.capacity

export type CruiseConfig = { weekdays: number[]; depart: string; returnSkala: string; adult: number; child: number; active: boolean }
export type Season = { start: string; end: string }
/** Which payment page the server will use: the test page ('mock'), Alpha Bank ('alpha'), or none configured (null). */
export type PaymentMode = 'mock' | 'alpha' | null

export type Schedule = {
  config: Record<string, CruiseConfig>
  season: Season
  /** today's date in Greece, from the server (null until the API answers) */
  today: string | null
  /** undefined until the API answers */
  payments: PaymentMode | undefined
  /** 'live' once the API has answered; 'static' before that or when it fails */
  source: 'static' | 'live'
}

function staticSchedule(): Schedule {
  const config: Record<string, CruiseConfig> = {}
  for (const c of cruises) {
    if (!c.scheduled) continue
    config[c.key] = { weekdays: c.weekdays, depart: c.depart!, returnSkala: c.returnSkala!, adult: c.prices!.adult, child: c.prices!.child, active: true }
  }
  return { config, season: { start: toISO(SEASON_START), end: toISO(SEASON_END) }, today: null, payments: undefined, source: 'static' }
}
const STATIC = staticSchedule()

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Reads the API answer defensively: anything unexpected keeps the static value for that cruise. */
function parseSchedule(body: unknown): Schedule | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { season?: Partial<Season>; today?: unknown; payments?: unknown; cruises?: unknown }
  if (!Array.isArray(b.cruises)) return null
  const config: Record<string, CruiseConfig> = { ...STATIC.config }
  for (const raw of b.cruises as Record<string, unknown>[]) {
    const key = typeof raw?.key === 'string' ? raw.key : ''
    if (!config[key]) continue
    const prices = raw.prices as { adult?: unknown; child?: unknown } | undefined
    const weekdays = Array.isArray(raw.weekdays) ? (raw.weekdays as unknown[]).filter((w): w is number => isNum(w) && w >= 0 && w <= 6) : null
    if (!weekdays || !isTime(String(raw.depart)) || !isTime(String(raw.returnSkala)) || !isNum(prices?.adult) || !isNum(prices?.child)) continue
    config[key] = { weekdays, depart: String(raw.depart), returnSkala: String(raw.returnSkala), adult: prices.adult, child: prices.child, active: raw.active !== false }
  }
  const season = b.season && ISO.test(String(b.season.start)) && ISO.test(String(b.season.end)) ? { start: String(b.season.start), end: String(b.season.end) } : STATIC.season
  const payments: PaymentMode | undefined = b.payments === 'mock' || b.payments === 'alpha' ? b.payments : b.payments === null ? null : undefined
  return { config, season, today: typeof b.today === 'string' && ISO.test(b.today) ? b.today : null, payments, source: 'live' }
}

// One request per page load, shared by every component that shows the schedule (a page can hold a dozen of them).
let live: Schedule | null = null
let loadedAt = 0
let inflight: Promise<Schedule | null> | null = null
const subscribers = new Set<(s: Schedule | null) => void>()

/** Fetches the live schedule unless the copy in memory is younger than `maxAgeMs`. Resolves to null when the API fails. */
export function refreshSchedule(maxAgeMs = 0): Promise<Schedule | null> {
  if (inflight) return inflight
  if (live && Date.now() - loadedAt < maxAgeMs) return Promise.resolve(live)
  inflight = fetch('/api/cruises/schedule', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then(parseSchedule)
    .catch(() => null)
    .then((s) => {
      inflight = null
      if (s) {
        live = s
        loadedAt = Date.now()
      }
      subscribers.forEach((f) => f(s))
      return s
    })
  return inflight
}

/** Refreshes when the guest comes back to the tab, so a change made in /admin shows up without a reload. */
function useRefreshOnReturn(refresh: () => void) {
  const fn = useRef(refresh)
  fn.current = refresh
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && fn.current()
    document.addEventListener('visibilitychange', on)
    window.addEventListener('focus', on)
    return () => {
      document.removeEventListener('visibilitychange', on)
      window.removeEventListener('focus', on)
    }
  }, [])
}

const SeedContext = createContext<Schedule | null>(null)

/**
 * The cruise pages are rendered on the server with the schedule saved in /admin (scheduleSeed in
 * src/server/cruises/schedule.ts) and pass it down here, so the HTML, the JSON-LD and the first client render already
 * show the live fares, days and times. Without a seed (or when the database could not be read) the static data is used.
 */
export function ScheduleSeed({ seed, children }: { seed: Schedule | null; children: ReactNode }) {
  return createElement(SeedContext.Provider, { value: seed }, children)
}

/**
 * The live schedule (days, times, fares, season, payment mode). Starts with the server's seed, or the static data;
 * `ready` turns true once the API has answered or failed, and `source` says which of the two is showing.
 */
export function useSchedule(): Schedule & { ready: boolean } {
  const seed = useContext(SeedContext)
  const [state, setState] = useState<Schedule>(() => (seed ? { ...seed, config: { ...STATIC.config, ...seed.config } } : STATIC))
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const on = (s: Schedule | null) => {
      if (s) setState(s)
      setReady(true)
    }
    subscribers.add(on)
    if (live) on(live)
    refreshSchedule(30_000)
    return () => {
      subscribers.delete(on)
    }
  }, [])
  useRefreshOnReturn(() => refreshSchedule(30_000))
  return { ...state, ready }
}

// ----- seats per departure ----------------------------------------------------------------------------------

export type DepartureStatus = 'open' | 'cancelled' | 'closed' | 'soldout' | 'past'
/** `left` is null when the seats are unknown (the API could not be reached; the server still checks them on payment). */
export type DepartureState = { date: Date; iso: string; status: DepartureStatus; left: number | null; capacity: number }

const STATUSES: DepartureStatus[] = ['open', 'cancelled', 'closed', 'soldout', 'past']

/** Sailing days from the schedule alone, when the seats cannot be loaded: every future day on the schedule, seats unknown. */
function scheduleDates(schedule: Schedule, cruise: string): DepartureState[] {
  const cfg = schedule.config[cruise]
  const season = { start: fromISO(schedule.season.start) ?? SEASON_START, end: fromISO(schedule.season.end) ?? SEASON_END }
  if (!cfg?.active) return []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: DepartureState[] = []
  for (let d = new Date(Math.max(season.start.getTime(), today.getTime())); d <= season.end; d.setDate(d.getDate() + 1)) {
    if (cfg.weekdays.includes(d.getDay())) out.push({ date: new Date(d), iso: toISO(d), status: 'open', left: null, capacity: CAPACITY })
  }
  return out
}

/**
 * Departures of one cruise from today to the end of the season, with their status and seats left (live 15-minute holds
 * of guests who are paying already count). Refreshes every two minutes while the page is visible and when the guest
 * returns to the tab. Falls back to the schedule's sailing days, seats unknown, when the API fails.
 */
export function useAvailability(cruise: string, schedule: Schedule & { ready: boolean }) {
  const [state, setState] = useState<{ deps: DepartureState[]; live: boolean; ready: boolean }>({ deps: [], live: false, ready: false })
  const loadedRef = useRef(0)
  const load = useCallback(async (): Promise<DepartureState[] | null> => {
    try {
      const res = await fetch(`/api/cruises/availability?cruise=${encodeURIComponent(cruise)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { departures?: Record<string, unknown> }
      const list = body?.departures?.[cruise]
      if (!Array.isArray(list)) throw new Error('shape')
      const deps: DepartureState[] = []
      for (const raw of list as Record<string, unknown>[]) {
        const date = fromISO(String(raw?.date))
        const status = STATUSES.find((s) => s === raw?.status)
        if (!date || !status) continue
        deps.push({ date, iso: toISO(date), status, left: isNum(raw.left) ? raw.left : 0, capacity: isNum(raw.capacity) ? raw.capacity : CAPACITY })
      }
      loadedRef.current = Date.now()
      setState({ deps, live: true, ready: true })
      return deps
    } catch {
      setState((s) => ({ ...s, ready: true }))
      return null
    }
  }, [cruise])

  useEffect(() => {
    load()
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 120_000)
    return () => clearInterval(id)
  }, [load])
  useRefreshOnReturn(() => Date.now() - loadedRef.current > 30_000 && load())

  const departures = state.live ? state.deps : state.ready ? scheduleDates(schedule, cruise) : []
  return { departures, ready: state.ready, live: state.live, refresh: load }
}

// ----- shared helpers ---------------------------------------------------------------------------------------

/** Passengers who take a seat: adults, children and infants (infants travel free but count towards the boat's licence). */
export const seatsOf = (b: { adults: number; children: number; infants?: number }) => b.adults + b.children + (b.infants ?? 0)

const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}
const toHHMM = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** true for a valid 24-hour time such as "09:00" */
export function isTime(s: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s ?? '')
}

/** On the way back the boat calls at Poros about 15 minutes before it reaches Skala (Captain's timetable: 17:30 / 17:45). */
export const POROS_RETURN_EARLIER_MIN = 15

/**
 * Boarding and return times at each pick-up point, following the (editable) schedule:
 * Poros is the Skala departure plus the offset in the itinerary (09:00 → 09:20). The server uses the same rule.
 */
export function pickupTimes(cruise: Pick<Cruise, 'stops' | 'depart' | 'returnSkala'>, cfg?: Pick<CruiseConfig, 'depart' | 'returnSkala'>) {
  const depart = cfg && isTime(cfg.depart) ? cfg.depart : cruise.depart ?? '09:00'
  const back = cfg && isTime(cfg.returnSkala) ? cfg.returnSkala : cruise.returnSkala ?? '17:45'
  const skalaStop = cruise.stops.find((s) => s.key === 'skala')?.time
  const porosStop = cruise.stops.find((s) => s.key === 'poros' && s.kind === 'pickup')?.time
  const offset = skalaStop && porosStop ? toMinutes(porosStop) - toMinutes(skalaStop) : 20
  return {
    skala: { depart, back },
    poros: { depart: toHHMM(toMinutes(depart) + offset), back: toHHMM(toMinutes(back) - POROS_RETURN_EARLIER_MIN) },
    hasPoros: !!porosStop,
  }
}

/** Form checks shared by the booking and contact forms (the server applies the same rules). */
export const isEmail = (s: string) => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(s.trim())
/** International format only (+30 … or 0030 …), as the error message asks: the Captain calls guests from many countries. */
export const isPhone = (s: string) => /^(\+|00)[\d\s()-]{8,}$/.test(s.trim()) && s.replace(/\D/g, '').length >= 8 && s.replace(/\D/g, '').length <= 17

/** Error answer of the booking API: `{ error: code, …extra }`. */
export type ApiError = { error?: string; status?: string; left?: number; total?: number; fields?: string[]; retryAfter?: number }

/** POSTs JSON to the site's own API and returns the status and the parsed body (null when it is not JSON). */
export async function postJson<T = unknown>(url: string, body: unknown): Promise<{ ok: boolean; status: number; body: (T & ApiError) | null }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  const data = (await res.json().catch(() => null)) as (T & ApiError) | null
  return { ok: res.ok, status: res.status, body: data }
}
