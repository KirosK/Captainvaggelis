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
    checkIn: '13:00',
    checkOut: '11:00',
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
    checkIn: '13:00',
    checkOut: '11:00',
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
    audiences: ['couple', 'solo'], photos: photos('aegealis', 'ag-garden-studio'),
  },
  {
    key: 'ag-sea-studio', layout: 'studio', view: 'seaMixed', property: 'aegealis', variants: ['ag-side-sea-studio', 'ag-balcony-partial-sea', 'ag-superior-sea-studio'], count: 3, size: [15, 22],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 2, seaView: true,
    features: ['sideSeaView', 'kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], photos: photos('aegealis', 'ag-sea-studio'),
  },
  {
    key: 'ag-triple-studio', layout: 'studio', property: 'aegealis', variants: ['ag-triple'], count: 1, size: [22, 22],
    maxGuests: 3, maxAdults: 3, bedrooms: 0, tier: 2, seaView: false,
    features: ['kitchenette', 'airCon', 'shower'],
    audiences: ['friends', 'family'], photos: photos('aegealis', 'ag-triple-studio'),
  },
  {
    key: 'ag-family-studio', layout: 'studio', view: 'sea', property: 'aegealis', variants: ['ag-family'], count: 1, size: [26, 26],
    maxGuests: 4, maxAdults: 2, bedrooms: 0, tier: 3, seaView: true,
    features: ['seaView', 'terrace', 'kitchenette', 'airCon'],
    audiences: ['family'], photos: photos('aegealis', 'ag-family-studio'),
  },
  {
    key: 'ag-apartment', layout: 'oneBedroom', view: 'sea', property: 'aegealis', variants: ['ag-apt-ground', 'ag-apt-upper'], count: 2, size: [30, 30],
    maxGuests: 4, maxAdults: 4, bedrooms: 1, tier: 3, seaView: true,
    features: ['seaView', 'sofaBed', 'kitchenette', 'airCon'],
    audiences: ['family', 'friends', 'couple'], photos: photos('aegealis', 'ag-apartment'),
  },
  {
    // the first-floor double with terrace (No 5) has a sea view; the ground-floor double (No 2a) a side view
    key: 'th-double', layout: 'room', view: 'seaOne', property: 'theodora', variants: ['th-standard-double', 'th-double', 'th-double-terrace'], count: 3, size: [20, 20],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 1, seaView: false, someSeaView: true,
    features: ['balcony', 'kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], photos: photos('theodora', 'th-double'),
  },
  {
    // ground floor: front (No 1, 2) or side view (No 3, 4); second floor: front sea view (No 8) and pool view (No 10, the studio apartment)
    key: 'th-studio', layout: 'studio', view: 'villageMixed', property: 'theodora', variants: ['th-studio', 'th-studio-apartment', 'th-studio-ground', 'th-studio-top'], count: 5, size: [16, 24],
    maxGuests: 2, maxAdults: 2, bedrooms: 0, tier: 2, seaView: false, someSeaView: true,
    features: ['kitchenette', 'airCon', 'shower'],
    audiences: ['couple', 'solo'], photos: photos('theodora', 'th-studio'),
  },
  {
    // first floor, terrace with a view of the pool (No 7)
    key: 'th-triple', layout: 'room', view: 'pool', property: 'theodora', variants: ['th-triple-terrace'], count: 1, size: [24, 24],
    maxGuests: 3, maxAdults: 3, bedrooms: 0, tier: 2, seaView: false,
    features: ['terrace', 'kitchenette', 'airCon', 'shower'],
    audiences: ['family', 'friends'], photos: photos('theodora', 'th-triple'),
  },
  {
    // first floor (No 6) and second floor (No 9), both with a front and side sea view
    key: 'th-two-bedroom', layout: 'twoBedrooms', view: 'seaFrontSide', property: 'theodora', variants: ['th-2br'], count: 2, size: [50, 50],
    maxGuests: 5, maxAdults: 5, bedrooms: 2, tier: 3, seaView: true,
    features: ['seaView', 'kitchenette', 'balcony', 'airCon', 'shower'],
    audiences: ['family', 'friends'], photos: photos('theodora', 'th-two-bedroom'),
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
