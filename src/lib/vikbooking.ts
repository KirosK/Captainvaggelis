import { unitGroups } from '@/data/properties'
import type { PropertyKey } from '@/data/types'
import type { Locale } from './i18n'

/**
 * Room bookings are made in the owner's VikBooking engine on cptvangelis-apartments.com (live availability, prices and
 * the card payment through Alpha Bank). This builds its search URL, the same GET request its own search form sends, so
 * every booking entry point on this site lands on the live results with the visitor's dates and guests filled in.
 */
export type VikProperty = PropertyKey | 'both'
export type VikRoom = { adults: number; children: number }

const ORIGIN = 'https://cptvangelis-apartments.com'
const LANG_PREFIX: Record<Locale, string> = { en: '', el: 'el/', it: 'it/' }
/** VikBooking categories: 1 = Aegealis, 2 = Theodora. */
const CATEGORY: Record<VikProperty, string> = { aegealis: '1', theodora: '2', both: 'all' }

/** What VikBooking's search form offers: 1–3 rooms, 1–5 adults and 0–4 children per room. */
export const VIK_MAX_ROOMS = 3
export const VIK_ROOM_MAX_ADULTS = 5
export const VIK_ROOM_MAX_CHILDREN = 4

/** Check-in from 13:00, check-out by 11:00 (the owner's room terms). */
const CHECK_IN = { h: 13, m: 0 }
const CHECK_OUT = { h: 11, m: 0 }

/**
 * The largest party the site's pickers offer: three rooms of four, which every search can place (Aegealis units take up
 * to 4 guests, Theodora's two-bedroom apartments 5).
 */
export const PARTY_MAX_GUESTS = 12
export const PARTY_MAX_CHILDREN = 8

/** The most children the pickers allow next to `adults` adults: every VikBooking room takes one adult and up to 4 children. */
export const maxChildrenFor = (adults: number) => Math.min(PARTY_MAX_CHILDREN, PARTY_MAX_GUESTS - adults, Math.min(VIK_MAX_ROOMS, Math.max(1, adults)) * VIK_ROOM_MAX_CHILDREN)

/**
 * How each room type of this site is named in the results of the owner's VikBooking (identical in en, el and it; checked
 * on the live engine, 25 Nov 2026). The booking page tells a guest who chose a room type which names to look for.
 * The Aegealis family studio is left out until the owner confirms which VikBooking room it is.
 */
export const VIK_ROOM_NAMES: Record<string, string[]> = {
  'ag-garden-studio': ['Standard Studio', 'Studio with Garden View', 'Studio (2 Adults) - Ground Floor with Side Sea View'],
  'ag-sea-studio': ['Studio with Side Sea View', 'Studio with Balcony and Side Sea View', 'Superior Studio with Sea View'],
  'ag-triple-studio': ['Studio (3 Adults)'],
  'ag-apartment': ['One-Bedroom Apartment with Sea View - Ground Floor', 'One-Bedroom Apartment with Sea View - Top Floor'],
  'th-double': ['Double Room', 'Double Room with Terrace'],
  'th-studio': ['Studio', 'Studio (2 Adults) - Ground Floor', 'Studio on the ground floor with side view', 'Studio (2 Adults) - Top Floor', 'Studio Apartment'],
  'th-triple': ['Triple Room with Terrace'],
  'th-two-bedroom': ['Two-Bedroom Apartment'],
}

/** The most guests one unit of that property (or of either) takes. */
function roomCapacity(property: VikProperty) {
  return Math.max(...unitGroups.filter((u) => property === 'both' || u.property === property).map((u) => u.maxGuests))
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)))

/**
 * Splits a party into VikBooking rooms: one room while it fits (at most 5 adults, 4 children and the largest unit's
 * capacity), otherwise 2 or 3 rooms with the guests spread evenly. Every room keeps at least one adult.
 */
export function splitParty(adults: number, children: number, property: VikProperty = 'both'): VikRoom[] {
  const a = clamp(adults, 1, VIK_MAX_ROOMS * VIK_ROOM_MAX_ADULTS)
  // every room needs an adult, so a party can bring at most 4 children per adult (the pickers enforce the same rule)
  const c = clamp(children, 0, Math.min(VIK_MAX_ROOMS, a) * VIK_ROOM_MAX_CHILDREN)
  const needed = Math.max(1, Math.ceil(a / VIK_ROOM_MAX_ADULTS), Math.ceil(c / VIK_ROOM_MAX_CHILDREN), Math.ceil((a + c) / roomCapacity(property)))
  const rooms = Math.min(needed, VIK_MAX_ROOMS, a)
  return Array.from({ length: rooms }, (_, i) => ({
    adults: Math.floor(a / rooms) + (i < a % rooms ? 1 : 0),
    children: Math.min(VIK_ROOM_MAX_CHILDREN, Math.floor(c / rooms) + (i < c % rooms ? 1 : 0)),
  }))
}

/** DD/MM/YYYY from the local date parts (no UTC shift). */
function vikDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** The VikBooking search URL for these dates and guests, in the page language. */
export function vikbookingUrl({
  locale,
  from,
  to,
  adults,
  children,
  property,
}: {
  locale: Locale
  from: Date
  to: Date
  adults: number
  children: number
  property: VikProperty
}) {
  const rooms = splitParty(adults, children, property)
  const params = [
    'Itemid=239',
    'option=com_vikbooking',
    'task=search',
    `checkindate=${vikDate(from)}`,
    `checkinh=${CHECK_IN.h}`,
    `checkinm=${CHECK_IN.m}`,
    `checkoutdate=${vikDate(to)}`,
    `checkouth=${CHECK_OUT.h}`,
    `checkoutm=${CHECK_OUT.m}`,
    `roomsnum=${rooms.length}`,
    // one adults[] and one children[] per room, in room order, as VikBooking's own form sends them
    ...rooms.flatMap((r) => [`adults[]=${r.adults}`, `children[]=${r.children}`]),
    `categories=${CATEGORY[property]}`,
  ]
  return `${ORIGIN}/${LANG_PREFIX[locale]}component/vikbooking/?${params.join('&')}`
}
