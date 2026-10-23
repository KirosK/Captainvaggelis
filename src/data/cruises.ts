import type { Photo } from './types'

export type CruiseKey = 'fiscardo' | 'ithacaVathiKioni' | 'ithacaVathi' | 'zakynthos' | 'bbq' | 'private' | 'wedding'

export type Stop = {
  key: string
  time?: string
  until?: string
  kind: 'depart' | 'pickup' | 'swim' | 'ashore' | 'sight' | 'return'
  geo: [number, number]
}

export type Cruise = {
  key: CruiseKey
  slug: string
  /** 0 = Sunday … 6 = Saturday; empty = on request */
  weekdays: number[]
  depart?: string
  returnSkala?: string
  prices?: { adult: number; child: number }
  durationHours?: number
  scheduled: boolean
  stops: Stop[]
  /**
   * Sea waypoints for the map line, in the order the boat sails. Every leg was checked against the OpenStreetMap coastline
   * (the tiles the map draws), so the line stays over water; it touches land only for the last few metres at a quay or beach.
   */
  path: [number, number][]
  /** route colour shared by the week strip, timeline icons and map line; the four scheduled routes use distinct site tokens (sea, terra, olive, sun) */
  accent: string
  tags: ('kids' | 'culture' | 'swim' | 'adventure' | 'short')[]
  cover?: Photo
  photos: Photo[]
}

const SKALA: [number, number] = [38.0785, 20.8013]
/** the ferry quay, where the boat picks up on request (the town centre is 600 m west) */
const POROS: [number, number] = [38.1478, 20.7831]
const MAKRIA_PETRA: [number, number] = [38.1838, 20.7546]
const MINI_MYRTOS: [number, number] = [38.2236, 20.7139]
const GIDAKI: [number, number] = [38.3858, 20.7299]
const VATHI: [number, number] = [38.3659, 20.7151]

export const cruises: Cruise[] = [
  {
    key: 'ithacaVathiKioni', slug: 'ithaca-vathi-kioni', weekdays: [3, 0], depart: '09:00', returnSkala: '17:45',
    prices: { adult: 55, child: 30 }, durationHours: 8.75, scheduled: true, accent: '#17677A', tags: ['culture', 'swim', 'kids'],
    stops: [
      { key: 'skala', time: '09:00', kind: 'depart', geo: SKALA },
      { key: 'poros', time: '09:20', kind: 'pickup', geo: POROS },
      { key: 'gidaki', kind: 'swim', geo: GIDAKI },
      { key: 'vathi', time: '11:15', until: '12:45', kind: 'ashore', geo: VATHI },
      { key: 'kioni', time: '13:15', until: '14:45', kind: 'ashore', geo: [38.4492, 20.6915] },
      { key: 'aiGianni', kind: 'sight', geo: [38.3209, 20.7663] },
      { key: 'miniMyrtos', kind: 'swim', geo: MINI_MYRTOS },
      { key: 'return', time: '17:45', kind: 'return', geo: SKALA },
    ],
    path: [
      SKALA, [38.0826, 20.8067], [38.115, 20.8205], [38.1532, 20.7869], [38.1494, 20.7814], POROS, [38.1494, 20.7814],
      [38.3241, 20.769], [38.3699, 20.7567], [38.3904, 20.7375], GIDAKI, [38.392, 20.7286], [38.3941, 20.7108], [38.3834, 20.6971],
      [38.3774, 20.7005], [38.3731, 20.708], [38.3704, 20.7115], [38.3694, 20.7149], VATHI, [38.3704, 20.7122], [38.372, 20.7087],
      [38.3747, 20.7053], [38.3764, 20.7019], [38.3823, 20.6971], [38.4373, 20.7135], [38.4502, 20.7019], [38.4475, 20.6943], [38.4492, 20.6915],
      [38.448, 20.6978], [38.4491, 20.7046], [38.3613, 20.7608], [38.3214, 20.767], [38.3181, 20.7711], MINI_MYRTOS, [38.2238, 20.7218],
      [38.1672, 20.7718], [38.1494, 20.7814], POROS, [38.1494, 20.7814], [38.1532, 20.7882], [38.1128, 20.8205], [38.0783, 20.8026],
      SKALA,
    ],
    photos: [],
  },
  {
    key: 'fiscardo', slug: 'fiscardo-sami', weekdays: [2, 6], depart: '09:00', returnSkala: '17:45',
    prices: { adult: 55, child: 30 }, durationHours: 8.75, scheduled: true, accent: '#C0603E', tags: ['culture', 'kids'],
    stops: [
      { key: 'skala', time: '09:00', kind: 'depart', geo: SKALA },
      { key: 'poros', time: '09:20', kind: 'pickup', geo: POROS },
      { key: 'makriaPetra', kind: 'sight', geo: MAKRIA_PETRA },
      { key: 'antisamos', kind: 'sight', geo: [38.2608, 20.6734] },
      { key: 'sami', time: '10:15', until: '11:45', kind: 'ashore', geo: [38.2523, 20.6459] },
      { key: 'gorgotas', kind: 'sight', geo: [38.2905, 20.6315] },
      { key: 'fiscardo', time: '13:15', until: '15:00', kind: 'ashore', geo: [38.4622, 20.5763] },
      { key: 'miniMyrtos', kind: 'swim', geo: MINI_MYRTOS },
      { key: 'return', time: '17:45', kind: 'return', geo: SKALA },
    ],
    path: [
      SKALA, [38.0826, 20.8067], [38.115, 20.8205], [38.1532, 20.7869], [38.1494, 20.7814], POROS, [38.1494, 20.7814],
      [38.1775, 20.7643], [38.1845, 20.7553], MAKRIA_PETRA, [38.199, 20.7519], [38.2669, 20.6957], [38.2691, 20.682], [38.2621, 20.6738],
      [38.2766, 20.6854], [38.2847, 20.6752], [38.268, 20.6491], [38.2529, 20.645], [38.2523, 20.6459], [38.2907, 20.6313], [38.3553, 20.6299],
      [38.4346, 20.6018], [38.4594, 20.5799], [38.4622, 20.5763], [38.4577, 20.5833], [38.4195, 20.6094], [38.2362, 20.717], MINI_MYRTOS,
      [38.2238, 20.7218], [38.1672, 20.7718], [38.1494, 20.7814], POROS, [38.1494, 20.7814], [38.1532, 20.7882], [38.1128, 20.8205],
      [38.0783, 20.8026], SKALA,
    ],
    photos: [],
  },
  {
    key: 'ithacaVathi', slug: 'ithaca-vathi', weekdays: [1, 5], depart: '09:00', returnSkala: '16:45',
    prices: { adult: 36, child: 20 }, durationHours: 7.75, scheduled: true, accent: '#66703F', tags: ['culture', 'kids', 'short', 'swim'],
    stops: [
      { key: 'skala', time: '09:00', kind: 'depart', geo: SKALA },
      { key: 'poros', time: '09:20', kind: 'pickup', geo: POROS },
      { key: 'gidaki', kind: 'swim', geo: GIDAKI },
      { key: 'vathi', time: '11:30', until: '13:30', kind: 'ashore', geo: VATHI },
      { key: 'miniMyrtos', kind: 'swim', geo: MINI_MYRTOS },
      { key: 'return', time: '16:45', kind: 'return', geo: SKALA },
    ],
    path: [
      SKALA, [38.0826, 20.8067], [38.115, 20.8205], [38.1532, 20.7869], [38.1494, 20.7814], POROS, [38.1494, 20.7814],
      [38.3241, 20.769], [38.3699, 20.7567], [38.3904, 20.7375], GIDAKI, [38.392, 20.7286], [38.3941, 20.7108], [38.3834, 20.6971],
      [38.3774, 20.7005], [38.3731, 20.708], [38.3704, 20.7115], [38.3694, 20.7149], VATHI, [38.3704, 20.7122], [38.372, 20.7087],
      [38.3747, 20.7053], [38.3764, 20.7019], [38.3823, 20.6971], [38.3898, 20.7033], [38.3952, 20.719], [38.3861, 20.743], [38.3618, 20.7608],
      [38.3165, 20.7697], MINI_MYRTOS, [38.2238, 20.7218], [38.1672, 20.7718], [38.1494, 20.7814], POROS, [38.1494, 20.7814],
      [38.1532, 20.7882], [38.1128, 20.8205], [38.0783, 20.8026], SKALA,
    ],
    photos: [],
  },
  {
    key: 'zakynthos', slug: 'zakynthos-shipwreck', weekdays: [4], depart: '09:00', returnSkala: '15:00',
    prices: { adult: 55, child: 30 }, durationHours: 6, scheduled: true, accent: '#D49A2E', tags: ['adventure', 'swim'],
    stops: [
      { key: 'skala', time: '09:00', kind: 'depart', geo: SKALA },
      { key: 'skinari', kind: 'sight', geo: [37.9339, 20.6993] },
      { key: 'shipwreck', time: '10:00', kind: 'sight', geo: [37.8595, 20.6249] },
      { key: 'blueCaves', kind: 'swim', geo: [37.9328, 20.7008] },
      { key: 'alykes', time: '12:00', until: '14:00', kind: 'ashore', geo: [37.8405, 20.7745] },
      { key: 'return', time: '15:00', kind: 'return', geo: SKALA },
    ],
    path: [
      SKALA, [38.0751, 20.8061], [38.054, 20.7924], [37.9344, 20.6985], [37.9328, 20.6834], [37.894, 20.6347], [37.8665, 20.6169],
      [37.8605, 20.6237], [37.8665, 20.6169], [37.901, 20.6402], [37.9365, 20.695], [37.9349, 20.7012], [37.9339, 20.7012], [37.9333, 20.7087],
      [37.8405, 20.7745], [38.0783, 20.804], SKALA,
    ],
    photos: [],
  },
  {
    key: 'bbq', slug: 'mini-myrtos-bbq', weekdays: [], scheduled: false, accent: '#9C4529', tags: ['swim'],
    stops: [
      { key: 'skala', kind: 'depart', geo: SKALA },
      { key: 'poros', kind: 'sight', geo: POROS },
      { key: 'makriaPetra', kind: 'swim', geo: MAKRIA_PETRA },
      { key: 'koutsoupia', kind: 'swim', geo: MINI_MYRTOS },
      { key: 'return', kind: 'return', geo: SKALA },
    ],
    path: [
      SKALA, [38.0826, 20.8067], [38.115, 20.8205], [38.1516, 20.7882], [38.185, 20.756], MAKRIA_PETRA, [38.1958, 20.7526],
      [38.226, 20.717], MINI_MYRTOS, [38.2238, 20.7218], [38.1516, 20.7882], [38.1133, 20.8205], [38.0783, 20.8026], SKALA,
    ],
    photos: [],
  },
  { key: 'private', slug: 'private-cruises', weekdays: [], scheduled: false, accent: '#17677A', tags: [], stops: [], path: [], photos: [] },
  { key: 'wedding', slug: 'wedding-cruises', weekdays: [], scheduled: false, accent: '#D49A2E', tags: [], stops: [], path: [], photos: [] },
]

export const cruiseBySlug = (slug: string) => cruises.find((c) => c.slug === slug)
export const scheduledCruises = cruises.filter((c) => c.scheduled)

/** Which cruise runs on each weekday (0 = Sunday). */
export function cruiseForWeekday(weekday: number) {
  return scheduledCruises.find((c) => c.weekdays.includes(weekday))
}

/** Just the schedule and fares of a cruise: what the client components that follow /admin need. */
export const scheduleOf = (c: Pick<Cruise, 'key' | 'weekdays' | 'depart' | 'returnSkala' | 'prices'>) => ({ key: c.key, weekdays: c.weekdays, depart: c.depart, returnSkala: c.returnSkala, prices: c.prices })

/** Monday-first order used wherever weekdays are listed. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const sortWeekdays = (days: number[]) => [...days].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b))

/**
 * The cruise-related sentence of each guest review flagged `cruise: true` in reviews.ts (verbatim, cuts marked "…").
 * Translations live in cruises.json → reviewQuotes. `cruises` lists the routes a review names; the others are general.
 * Iulia's "20% off for any cruise" and Keith's "very healthy discount" are limited to the four scheduled routes: the guest
 * discount is confirmed only for those (facts.md), so their words must not appear on the BBQ, private or wedding pages
 * (the hub, which links to those pages too, leaves Iulia's out). Kelly's "boat trip offers" promises no discount and stays general.
 */
export const cruiseReviewQuotes: { id: string; cruises?: CruiseKey[]; text: string }[] = [
  { id: 'th-helen', cruises: ['ithacaVathiKioni', 'ithacaVathi'], text: 'We also enjoyed our cruise to Ithaca with Captain Vangelis Cruises, which the apartments give you 20% off …' },
  { id: 'ag-amy', cruises: ['ithacaVathiKioni', 'ithacaVathi'], text: 'He offers you 20% off his boat trips (definitely do the Ithaca one) …' },
  { id: 'th-kamila', cruises: ['ithacaVathiKioni', 'ithacaVathi'], text: '… we went also to the cruise to Ithaka which was amazing, she booked it for us.' },
  { id: 'th-keith', cruises: ['fiscardo', 'ithacaVathiKioni', 'ithacaVathi', 'zakynthos'], text: "Captain Vangelis' fabulous boat trips were organised for us (with a very healthy discount!) and airport taxi transfers arranged … It was all so easy and we left very happy and relaxed." },
  { id: 'ag-iulia', cruises: ['fiscardo', 'ithacaVathiKioni', 'ithacaVathi', 'zakynthos'], text: '… also you get 20% off for any cruise with Captain Vangelis, a cruise we 10000% loved.' },
  { id: 'th-kelly', text: '… the owners and maid were so lovely, truly recommend this place and their boat trip offers well worth a fun filled day out.' },
]

/** Up to `n` review quotes for a cruise page: the ones naming this route first, then general ones, rotated per page so pages differ. */
export function cruiseQuotesFor(key: CruiseKey, n = 3) {
  const own = cruiseReviewQuotes.filter((q) => q.cruises?.includes(key))
  const general = cruiseReviewQuotes.filter((q) => !q.cruises)
  const shift = Math.max(0, cruises.findIndex((c) => c.key === key)) % general.length
  const rotated = [...general.slice(shift), ...general.slice(0, shift)]
  return [...own, ...rotated].slice(0, n)
}

export const boat = {
  name: 'NIRIIS',
  built: 2017,
  lengthM: 27.8,
  capacity: 200,
  cruiseKnots: 16,
  maxKnots: 21,
}

export const cruiseRules = {
  guestDiscount: 0.2,
  secondCruiseDiscount: 0.15,
  childAges: [4, 11] as const,
  arriveMinutesBefore: 30,
}
