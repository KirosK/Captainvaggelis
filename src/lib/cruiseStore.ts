'use client'

// Demo data layer shared by the public cruise booking and the admin panel.
// Everything lives in this browser's localStorage, so changes made in /admin
// (cancel for weather, new prices, schedule) show up instantly on the public pages,
// even across tabs (via the "storage" event). A real build would use a database.

import { useEffect, useState } from 'react'
import { cruises, type Cruise, type CruiseKey } from '@/data/cruises'
import { SEASON_END, SEASON_START, seeded, toISO } from './dates'

export const CAPACITY = 200
const KEY = 'cv-demo-store-v1'

export type CruiseConfig = { weekdays: number[]; depart: string; returnSkala: string; adult: number; child: number; active: boolean }
export type Override = { status: 'open' | 'cancelled' | 'closed'; note?: string; capacity?: number; updatedAt: string }
export type CruiseBooking = {
  ref: string
  cruise: CruiseKey
  date: string
  adults: number
  children: number
  infants: number
  pickup: 'skala' | 'poros'
  name: string
  email: string
  phone: string
  total: number
  paid: boolean
  guest: boolean
  /** where the guest is staying and free-text notes from the booking form */
  hotel?: string
  notes?: string
  /** language the booking was made in */
  lang?: string
  createdAt: string
}
export type StayRequest = {
  ref: string
  property: string
  unit: string
  from: string
  to: string
  adults: number
  children: number
  name: string
  email: string
  phone: string
  total: number
  country?: string
  /** estimated arrival time, HH:MM */
  arrival?: string
  requests?: string
  taxi?: boolean
  payPlan?: 'deposit' | 'full'
  /** amount charged online; the rest is due on arrival */
  paidNow?: number
  lang?: string
  createdAt: string
}
/** Request for a cruise that only runs on request (BBQ, private, wedding). */
export type CruiseRequestEntry = {
  ref: string
  cruise: CruiseKey
  date?: string
  people: number
  name: string
  email: string
  phone: string
  message?: string
  lang?: string
  createdAt: string
}

export type Store = {
  config: Record<string, CruiseConfig>
  overrides: Record<string, Override>
  bookings: CruiseBooking[]
  stays: StayRequest[]
  requests: CruiseRequestEntry[]
}

export function defaultStore(): Store {
  const config: Record<string, CruiseConfig> = {}
  for (const c of cruises) {
    if (!c.scheduled) continue
    config[c.key] = { weekdays: c.weekdays, depart: c.depart!, returnSkala: c.returnSkala!, adult: c.prices!.adult, child: c.prices!.child, active: true }
  }
  return { config, overrides: {}, bookings: [], stays: [], requests: [] }
}

export function readStore(): Store {
  if (typeof window === 'undefined') return defaultStore()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as Partial<Store>
    const base = defaultStore()
    return {
      ...base,
      ...parsed,
      config: { ...base.config, ...parsed.config },
      bookings: parsed.bookings ?? [],
      stays: parsed.stays ?? [],
      requests: parsed.requests ?? [],
    }
  } catch {
    return defaultStore()
  }
}

export function writeStore(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    window.dispatchEvent(new Event('cv-store'))
  } catch {}
}

export function resetStore() {
  try {
    localStorage.removeItem(KEY)
    window.dispatchEvent(new Event('cv-store'))
  } catch {}
}

/** Subscribes to the demo store, including changes made in other tabs. */
export function useStore() {
  const [store, setStore] = useState<Store>(defaultStore)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const sync = () => setStore(readStore())
    sync()
    setReady(true)
    const onStorage = (e: StorageEvent) => e.key === KEY && sync()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cv-store', sync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cv-store', sync)
    }
  }, [])
  const update = (fn: (s: Store) => Store) => {
    const next = fn(readStore())
    writeStore(next)
    setStore(next)
  }
  return { store, update, ready }
}

export const depId = (cruise: string, date: Date | string) => `${cruise}:${typeof date === 'string' ? date : toISO(date)}`

/** Passengers who take a seat: adults, children and infants (infants travel free but count towards the boat's licence). */
export const seatsOf = (b: Pick<CruiseBooking, 'adults' | 'children' | 'infants'>) => b.adults + b.children + (b.infants ?? 0)

/** Seats sold for a departure: a stable demo baseline plus bookings made in this browser. */
export function seatsSold(store: Store, cruise: string, date: Date) {
  const id = depId(cruise, date)
  const month = date.getMonth() + 1
  const peak = month === 7 || month === 8 ? 0.55 : month === 6 || month === 9 ? 0.35 : 0.18
  const baseline = Math.floor(CAPACITY * Math.min(0.97, peak + seeded(id) * 0.42))
  const booked = store.bookings.filter((b) => b.cruise === cruise && b.date === toISO(date)).reduce((n, b) => n + seatsOf(b), 0)
  return Math.min(capacityOf(store, cruise, date), baseline + booked)
}

export function capacityOf(store: Store, cruise: string, date: Date) {
  return store.overrides[depId(cruise, date)]?.capacity ?? CAPACITY
}

export type DepartureState = { date: Date; status: 'open' | 'cancelled' | 'closed' | 'soldout' | 'past'; left: number; capacity: number; note?: string }

export function departureState(store: Store, cruise: string, date: Date): DepartureState {
  const ov = store.overrides[depId(cruise, date)]
  const capacity = capacityOf(store, cruise, date)
  const sold = seatsSold(store, cruise, date)
  const left = Math.max(0, capacity - sold)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return { date, status: 'past', left, capacity }
  if (ov?.status === 'cancelled') return { date, status: 'cancelled', left, capacity, note: ov.note }
  if (ov?.status === 'closed') return { date, status: 'closed', left: 0, capacity, note: ov.note }
  if (left === 0) return { date, status: 'soldout', left: 0, capacity }
  return { date, status: 'open', left, capacity }
}

/** All sailing dates of a cruise between two dates, following the (editable) weekday schedule. */
export function sailingDates(store: Store, cruise: string, from = SEASON_START, to = SEASON_END) {
  const cfg = store.config[cruise]
  if (!cfg || !cfg.active) return []
  const out: Date[] = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (cfg.weekdays.includes(d.getDay())) out.push(new Date(d))
  return out
}

const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}
const toHHMM = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** true for a valid 24-hour time such as "09:00" */
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s ?? '')

/** On the way back the boat calls at Poros about 15 minutes before it reaches Skala (Captain's timetable: 17:30 / 17:45). */
export const POROS_RETURN_EARLIER_MIN = 15

/**
 * Boarding and return times at each pick-up point, following the (editable) schedule:
 * Poros is the Skala departure plus the offset in the itinerary (09:00 → 09:20).
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

/** Form checks shared by the stay and cruise booking forms. */
export const isEmail = (s: string) => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(s.trim())
/** International format only (+30 … or 0030 …), as the error message asks: the Captain calls guests from many countries. */
export const isPhone = (s: string) => /^(\+|00)[\d\s()-]{8,}$/.test(s.trim()) && s.replace(/\D/g, '').length >= 8

export function makeRef(prefix: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${prefix}-${s}`
}
