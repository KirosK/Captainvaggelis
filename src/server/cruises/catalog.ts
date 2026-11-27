// Fixed facts about the cruises, taken from src/data/cruises.ts (which follows research/facts.md).
// What the Captain can change (days, times, prices, capacity, on/off) lives in the database instead.

import { boat, cruiseRules, cruises, type CruiseKey } from '@/data/cruises'
import { SEASON_END, SEASON_START, toISO } from '@/lib/dates'
import { toHHMM, toMinutes } from '../time'

export const SCHEDULED_KEYS = ['fiscardo', 'ithacaVathiKioni', 'ithacaVathi', 'zakynthos'] as const satisfies readonly CruiseKey[]
export const ON_REQUEST_KEYS = ['bbq', 'private', 'wedding'] as const satisfies readonly CruiseKey[]
export type ScheduledKey = (typeof SCHEDULED_KEYS)[number]
export type OnRequestKey = (typeof ON_REQUEST_KEYS)[number]

export const isScheduledKey = (k: string): k is ScheduledKey => (SCHEDULED_KEYS as readonly string[]).includes(k)

/** NIRIIS is licensed for 200 passengers; no departure may be set higher. */
export const BOAT_CAPACITY = boat.capacity

/** Seats stay held for a guest who is paying for this long. */
export const HOLD_MINUTES = 15
/** Online booking for a departure closes this many minutes before it leaves Skala. */
export const BOOKING_CUTOFF_MINUTES = 60
/** A late payment for an expired hold is still accepted; the hold is marked cancelled only after this extra time. */
export const HOLD_GRACE_MINUTES = 30

export const CHILD_AGES = cruiseRules.childAges
export const DISCOUNT_RATE = { none: 0, guest20: cruiseRules.guestDiscount, second15: cruiseRules.secondCruiseDiscount } as const

/** The default bookable season (src/lib/dates.ts); the admin can change it. */
export const DEFAULT_SEASON = { start: toISO(SEASON_START), end: toISO(SEASON_END) }

/** On the way back the boat calls at Poros about 15 minutes before it reaches Skala (Captain's timetable: 17:30 / 17:45). */
export const POROS_RETURN_EARLIER_MIN = 15

const byKey = (k: string) => cruises.find((c) => c.key === k)

/** The Poros pick-up exists only on the Ithaca and Fiscardo cruises, and only on request (facts.md). */
export function hasPoros(key: string) {
  return !!byKey(key)?.stops.some((s) => s.key === 'poros' && s.kind === 'pickup')
}

function porosOffset(key: string) {
  const c = byKey(key)
  const skala = c?.stops.find((s) => s.key === 'skala')?.time
  const poros = c?.stops.find((s) => s.key === 'poros' && s.kind === 'pickup')?.time
  return skala && poros ? toMinutes(poros) - toMinutes(skala) : 20
}

export type PickupTimes = { skala: { depart: string; back: string }; poros: { depart: string; back: string } | null }

/** Boarding and return times at each pick-up point for the current schedule (Poros follows Skala: 09:00 → 09:20). */
export function pickupTimes(key: string, depart: string, returnSkala: string): PickupTimes {
  return {
    skala: { depart, back: returnSkala },
    poros: hasPoros(key) ? { depart: toHHMM(toMinutes(depart) + porosOffset(key)), back: toHHMM(toMinutes(returnSkala) - POROS_RETURN_EARLIER_MIN) } : null,
  }
}

/** The static schedule a scheduled cruise starts with (seed for cruise_settings). */
export function staticSchedule(key: ScheduledKey) {
  const c = byKey(key)!
  return {
    weekdays: c.weekdays,
    depart: c.depart!,
    returnSkala: c.returnSkala!,
    adultCents: Math.round(c.prices!.adult * 100),
    childCents: Math.round(c.prices!.child * 100),
  }
}

export const cruiseSlug = (key: string) => byKey(key)?.slug ?? ''
