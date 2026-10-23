export type PropertyKey = 'aegealis' | 'theodora'

export type Photo = {
  src: string
  width: number
  height: number
  /** key into the alt-text dictionary, falls back to altEn */
  altKey?: string
  altEn: string
  /** focal point for object-position, e.g. '50% 60%' */
  focus?: string
}

export type FeatureKey =
  | 'seaView' | 'sideSeaView' | 'partialSeaView' | 'gardenView' | 'groundFloor' | 'upperFloor' | 'topFloor'
  | 'balcony' | 'terrace' | 'largeBalcony' | 'kitchenette' | 'fullKitchen' | 'airCon' | 'tv' | 'safe' | 'shower'
  | 'hairdryer' | 'dailyCleaning' | 'freshTowels' | 'wifi' | 'wiredInternet' | 'freeParking' | 'streetParking'
  | 'poolAccess' | 'poolAccessOne' | 'garden' | 'sunbeds' | 'familyRooms' | 'nonSmoking' | 'mosquitoNets'
  | 'doubleGlazing' | 'sofaBed' | 'extraBed' | 'noExtraBeds' | 'beachfront' | 'villageCentre' | 'coldWater'
  | 'quiet' | 'cruiseDeparture' | 'breakfastNextDoor' | 'balconyOrTerrace'

export type Audience = 'couple' | 'family' | 'friends' | 'solo'

export type UnitGroup = {
  key: string
  property: PropertyKey
  /** Booking.com unit names this group covers, keyed for translation */
  variants: string[]
  maxGuests: number
  /** maximum adults (children counted as adults above the property's age limit) */
  maxAdults: number
  bedrooms: 0 | 1 | 2
  features: FeatureKey[]
  audiences: Audience[]
  /** 1 = budget … 3 = top of the property */
  tier: 1 | 2 | 3
  seaView: boolean
  /** DEMO nightly rates in EUR */
  demoRates: { low: number; mid: number; high: number }
  photos: Photo[]
  beds?: string
  layout: 'room' | 'studio' | 'oneBedroom' | 'twoBedrooms'
  /** gardenMixed: garden view, one ground-floor unit with a partial sea view; villageMixed: village view, some top-floor units see the sea */
  view?: 'sea' | 'seaMixed' | 'garden' | 'gardenMixed' | 'village' | 'villageMixed'
  /** number of units of this type (Booking.com room list) */
  count: number
  /** floor area in m², [min, max] across the variants */
  size: [number, number]
}

export type Property = {
  key: PropertyKey
  name: string
  shortName: string
  bookingUrl: string
  licence: string
  geo: { lat: number; lng: number }
  address: { street: string; locality: string; postalCode: string; region: string; country: string }
  checkIn: string
  checkOut: string
  childAdultAge: number
  hero: Photo
  gallery: Photo[]
  features: FeatureKey[]
  roomFeatures: FeatureKey[]
  accent: 'sea' | 'terra'
  extras: Record<string, Photo>
  video?: { mp4: string; webm?: string; poster: string }
}
