import type { Photo, Property, PropertyKey, UnitGroup } from './types'
import media from './media.generated.json'

type MediaSet = {
  hero: Photo
  gallery: (Photo & { section: string })[]
  units: Record<string, Photo[]>
  extras?: Record<string, Photo>
  video?: { mp4: string; webm?: string; poster: string }
}
const m = media as unknown as Record<PropertyKey, MediaSet>

export const properties: Record<PropertyKey, Property> = {
  aegealis: {
    key: 'aegealis',
    name: 'Aegealis Studios',
    shortName: 'Aegealis',
    bookingUrl: 'https://www.booking.com/hotel/gr/aegealis.html',
    licence: '0458K132K0314201',
    geo: { lat: 38.078137603921796, lng: 20.800316333770752 },
    address: { street: 'Skala seafront', locality: 'Skala', postalCode: '28086', region: 'Kefalonia', country: 'GR' },
    checkIn: '14:00',
    checkOut: '10:00',
    childAdultAge: 6,
    hero: m.aegealis.hero,
    gallery: m.aegealis.gallery,
    features: ['beachfront', 'cruiseDeparture', 'poolAccess', 'garden', 'freeParking', 'wifi', 'dailyCleaning', 'breakfastNextDoor', 'familyRooms', 'nonSmoking'],
    roomFeatures: ['kitchenette', 'airCon', 'tv', 'shower', 'hairdryer', 'safe', 'freshTowels', 'mosquitoNets'],
    accent: 'sea',
    extras: m.aegealis.extras ?? {},
    video: m.aegealis.video,
  },
  theodora: {
    key: 'theodora',
    name: 'Theodora Studios & Apartments',
    shortName: 'Theodora',
    bookingUrl: 'https://www.booking.com/hotel/gr/theodora-studios-ap-nts.html',
    licence: '0458K132K0314301',
    geo: { lat: 38.074388584943335, lng: 20.79509139060974 },
    address: { street: 'Top of the main street', locality: 'Skala', postalCode: '28086', region: 'Kefalonia', country: 'GR' },
    checkIn: '14:00',
    checkOut: '10:00',
    childAdultAge: 4,
    hero: m.theodora.hero,
    gallery: m.theodora.gallery,
    features: ['villageCentre', 'quiet', 'garden', 'sunbeds', 'poolAccessOne', 'coldWater', 'dailyCleaning', 'wiredInternet', 'streetParking', 'familyRooms', 'nonSmoking'],
    // not every unit has a balcony: some have a terrace instead
    roomFeatures: ['kitchenette', 'airCon', 'tv', 'shower', 'hairdryer', 'safe', 'freshTowels', 'balconyOrTerrace'],
    accent: 'terra',
    extras: m.theodora.extras ?? {},
    video: m.theodora.video,
  },
}

const photos = (p: PropertyKey, key: string) => m[p].units[key] ?? []

export const unitGroups: UnitGroup[] = [
  {
    key: 'ag-garden-studio', layout: 'studio', view: 'gardenMixed', property: 'aegealis', variants: ['ag-standard-studio', 'ag-garden-view-studio', 'ag-ground-partial-sea'], count: 3, size: [20, 22],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 1, seaView: false,
    features: ['gardenView', 'kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], demoRates: { low: 55, mid: 70, high: 85 }, photos: photos('aegealis', 'ag-garden-studio'),
  },
  {
    key: 'ag-sea-studio', layout: 'studio', view: 'seaMixed', property: 'aegealis', variants: ['ag-side-sea-studio', 'ag-balcony-partial-sea', 'ag-superior-sea-studio'], count: 3, size: [15, 22],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 2, seaView: true,
    features: ['sideSeaView', 'kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], demoRates: { low: 65, mid: 85, high: 105 }, photos: photos('aegealis', 'ag-sea-studio'),
  },
  {
    key: 'ag-triple-studio', layout: 'studio', property: 'aegealis', variants: ['ag-triple'], count: 1, size: [22, 22],
    maxGuests: 3, maxAdults: 3, bedrooms: 0, tier: 2, seaView: false,
    features: ['kitchenette', 'airCon', 'shower'],
    audiences: ['friends', 'family'], demoRates: { low: 70, mid: 90, high: 110 }, photos: photos('aegealis', 'ag-triple-studio'),
  },
  {
    key: 'ag-family-studio', layout: 'studio', view: 'sea', property: 'aegealis', variants: ['ag-family'], count: 1, size: [26, 26],
    maxGuests: 4, maxAdults: 2, bedrooms: 0, tier: 3, seaView: true,
    features: ['seaView', 'terrace', 'kitchenette', 'airCon'],
    audiences: ['family'], demoRates: { low: 80, mid: 105, high: 125 }, photos: photos('aegealis', 'ag-family-studio'),
  },
  {
    key: 'ag-apartment', layout: 'oneBedroom', view: 'sea', property: 'aegealis', variants: ['ag-apt-ground', 'ag-apt-upper'], count: 2, size: [30, 30],
    maxGuests: 4, maxAdults: 4, bedrooms: 1, tier: 3, seaView: true,
    features: ['seaView', 'sofaBed', 'kitchenette', 'airCon'],
    audiences: ['family', 'friends', 'couple'], demoRates: { low: 90, mid: 115, high: 140 }, photos: photos('aegealis', 'ag-apartment'),
  },
  {
    key: 'th-double', layout: 'room', property: 'theodora', variants: ['th-standard-double', 'th-double', 'th-double-terrace'], count: 3, size: [20, 20],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 1, seaView: false,
    features: ['balcony', 'kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], demoRates: { low: 45, mid: 58, high: 70 }, photos: photos('theodora', 'th-double'),
  },
  {
    key: 'th-studio', layout: 'studio', view: 'villageMixed', property: 'theodora', variants: ['th-studio', 'th-studio-apartment', 'th-studio-ground', 'th-studio-top'], count: 5, size: [16, 24],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 2, seaView: false,
    features: ['kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], demoRates: { low: 50, mid: 65, high: 78 }, photos: photos('theodora', 'th-studio'),
  },
  {
    key: 'th-triple', layout: 'room', property: 'theodora', variants: ['th-triple-terrace'], count: 1, size: [24, 24],
    maxGuests: 3, maxAdults: 3, bedrooms: 0, tier: 2, seaView: false,
    features: ['terrace', 'kitchenette', 'airCon', 'shower'],
    audiences: ['family', 'friends'], demoRates: { low: 60, mid: 78, high: 92 }, photos: photos('theodora', 'th-triple'),
  },
  {
    key: 'th-two-bedroom', layout: 'twoBedrooms', view: 'village', property: 'theodora', variants: ['th-2br'], count: 2, size: [50, 50],
    maxGuests: 5, maxAdults: 5, bedrooms: 2, tier: 3, seaView: false,
    features: ['kitchenette', 'balcony', 'airCon', 'shower'],
    audiences: ['family', 'friends'], demoRates: { low: 85, mid: 110, high: 130 }, photos: photos('theodora', 'th-two-bedroom'),
  },
]

export const unitsFor = (p: PropertyKey) => unitGroups.filter((u) => u.property === p)

/** Totals for the "at a glance" panels: number of units, size range and the largest room. */
export function inventory(p: PropertyKey) {
  const groups = unitsFor(p)
  return {
    total: groups.reduce((n, g) => n + g.count, 0),
    minSize: Math.min(...groups.map((g) => g.size[0])),
    maxSize: Math.max(...groups.map((g) => g.size[1])),
    maxGuests: Math.max(...groups.map((g) => g.maxGuests)),
    groups,
  }
}
export const unitByKey = (key: string) => unitGroups.find((u) => u.key === key)

/** DEMO season bands for nightly rates. */
export function seasonFor(date: Date): 'low' | 'mid' | 'high' {
  const month = date.getMonth() + 1
  if (month === 7 || month === 8) return 'high'
  if (month === 6 || month === 9) return 'mid'
  return 'low'
}

export function priceStay(unit: UnitGroup, from: Date, to: Date) {
  let total = 0
  const nights: { date: Date; rate: number }[] = []
  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const rate = unit.demoRates[seasonFor(d)]
    nights.push({ date: new Date(d), rate })
    total += rate
  }
  return { total, nights }
}
