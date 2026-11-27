import { boat, type Cruise } from '@/data/cruises'
import { inventory, properties, unitsFor } from '@/data/properties'
import { site } from '@/data/site'
import type { FeatureKey, PropertyKey } from '@/data/types'
import { placeNames } from '@/data/places'
import { tr, type Dict, type Locale, htmlLang } from './i18n'
import { absolute } from './seo'

const ORG_ID = `${site.url}/#organization`
const SITE_ID = `${site.url}/#website`
export const lodgingId = (p: PropertyKey) => `${site.url}/#${p}`

// Features that describe the setting rather than an amenity of the property stay out of amenityFeature.
const NOT_AMENITIES: FeatureKey[] = ['cruiseDeparture', 'breakfastNextDoor', 'beachfront', 'villageCentre', 'quiet']

const SKALA_ADDRESS = { '@type': 'PostalAddress', addressLocality: 'Skala', addressRegion: 'Kefalonia', postalCode: '28086', addressCountry: 'GR' }

// Free-text values follow the page language; the postal fields above stay as they are.
const SKALA_NAME: Record<Locale, string> = { en: 'Skala, Kefalonia', el: 'Σκάλα, Κεφαλονιά', it: 'Skala, Cefalonia' }
const TRIP_ORIGIN: Record<Locale, string> = { en: 'Skala beach, Kefalonia', el: 'Παραλία της Σκάλας, Κεφαλονιά', it: 'Spiaggia di Skala, Cefalonia' }
const BOAT: Record<Locale, { label: string; m: string; people: string }> = {
  en: { label: 'Boat', m: 'm', people: 'passengers' },
  el: { label: 'Σκάφος', m: 'μ.', people: 'επιβάτες' },
  it: { label: 'Barca', m: 'm', people: 'passeggeri' },
}
export const skalaName = (locale: Locale) => SKALA_NAME[locale]
const skala = (locale: Locale) => ({ '@type': 'Place', name: SKALA_NAME[locale], address: SKALA_ADDRESS })

function lodgingCore(p: PropertyKey, locale: Locale) {
  const prop = properties[p]
  return {
    '@type': 'LodgingBusiness',
    '@id': lodgingId(p),
    name: prop.name,
    url: absolute(`/${locale}/${p}`),
    telephone: site.phones[0].e164,
    // no streetAddress until the owner confirms the street names: the coordinates and postcode locate both properties
    address: SKALA_ADDRESS,
    geo: { '@type': 'GeoCoordinates', latitude: prop.geo.lat, longitude: prop.geo.lng },
  }
}

export function organizationLd(locale: Locale, c: Dict) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': ORG_ID,
        name: site.brand,
        alternateName: ['Captain Vangelis Special Cruises', 'Καπετάν Βαγγέλης'],
        foundingDate: site.founded,
        founder: { '@type': 'Person', name: 'Vangelis Spathis', jobTitle: 'Captain' },
        slogan: tr(c, 'brand.tagline'),
        url: absolute('/'),
        logo: absolute('/icon-512.png'),
        image: absolute(properties.aegealis.hero.src),
        email: site.email,
        telephone: site.phones[0].e164,
        address: SKALA_ADDRESS,
        geo: { '@type': 'GeoCoordinates', latitude: site.kiosk.lat, longitude: site.kiosk.lng },
        areaServed: ['Skala', 'Kefalonia'],
        knowsLanguage: ['el', 'en', 'es'],
        sameAs: site.sameAs.filter((u) => !u.includes('booking.com')),
        subOrganization: [{ '@id': lodgingId('aegealis') }, { '@id': lodgingId('theodora') }],
      },
      lodgingCore('aegealis', locale),
      lodgingCore('theodora', locale),
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: absolute('/'),
        name: site.brand,
        inLanguage: htmlLang[locale],
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

export function lodgingLd(locale: Locale, p: PropertyKey, d: { common: Dict; units: Dict; seo: Dict }) {
  const prop = properties[p]
  const units = unitsFor(p)
  const amenities = [...prop.features, ...prop.roomFeatures].filter((f) => !NOT_AMENITIES.includes(f))
  const images = Array.from(new Set([prop.hero.src, ...prop.gallery.map((g) => g.src)])).slice(0, 8).map(absolute)
  return {
    '@context': 'https://schema.org',
    ...lodgingCore(p, locale),
    description: tr(d.seo, `${p}.description`),
    image: images,
    email: site.email,
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    numberOfRooms: inventory(p).total,
    // the room terms of the family's booking engine: check-in from 13:00, check-out by 11:00
    checkinTime: prop.checkIn,
    checkoutTime: prop.checkOut,
    petsAllowed: false,
    smokingAllowed: false,
    hasMap: `https://www.google.com/maps/search/?api=1&query=${prop.geo.lat},${prop.geo.lng}`,
    containedInPlace: skala(locale),
    parentOrganization: { '@id': ORG_ID },
    identifier: { '@type': 'PropertyValue', propertyID: 'MHTE', value: prop.licence },
    amenityFeature: amenities.map((f) => ({ '@type': 'LocationFeatureSpecification', name: tr(d.common, `features.${f}`), value: true })),
    availableLanguage: ['Greek', 'English', 'Spanish'],
    containsPlace: units.map((u) => ({
      '@type': u.bedrooms > 0 ? 'Apartment' : 'HotelRoom',
      name: tr(d.units, `${u.key}.name`),
      description: tr(d.units, `${u.key}.description`),
      occupancy: { '@type': 'QuantitativeValue', maxValue: u.maxGuests, unitText: 'guests' },
      floorSize: { '@type': 'QuantitativeValue', minValue: u.size[0], maxValue: u.size[1], unitCode: 'MTK' },
      ...(u.bedrooms > 0 ? { numberOfBedrooms: u.bedrooms } : {}),
      amenityFeature: u.features.map((f) => ({ '@type': 'LocationFeatureSpecification', name: tr(d.common, `features.${f}`), value: true })),
    })),
    sameAs: [prop.bookingUrl],
  }
}

export function cruiseLd(locale: Locale, cruise: Cruise & { cover?: { src: string } }, d: { cruises: Dict; seo: Dict }) {
  const base = `list.${cruise.key}`
  const names = placeNames(locale)
  const det = d.cruises.detail
  const url = absolute(`/${locale}/cruises/${cruise.slug}#book`)
  // the 2027 dates are still to be confirmed, so the offers carry no availability or validity dates
  const offer = (name: string, price: number) => ({ '@type': 'Offer', name, price, priceCurrency: 'EUR', url })
  const b = BOAT[locale]
  const length = new Intl.NumberFormat(htmlLang[locale], { maximumFractionDigits: 1 }).format(boat.lengthM)
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${site.url}/#cruise-${cruise.key}`,
    name: tr(d.cruises, `${base}.name`),
    description: tr(d.seo, `${cruise.key}.description`),
    url: absolute(`/${locale}/cruises/${cruise.slug}`),
    image: cruise.cover ? absolute(cruise.cover.src) : undefined,
    touristType: tr(d.cruises, `${base}.goodFor`),
    provider: { '@id': ORG_ID },
    ...(cruise.depart ? { departureTime: cruise.depart, arrivalTime: cruise.returnSkala } : {}),
    tripOrigin: { '@type': 'Place', name: TRIP_ORIGIN[locale], geo: { '@type': 'GeoCoordinates', latitude: site.kiosk.lat, longitude: site.kiosk.lng } },
    additionalProperty: { '@type': 'PropertyValue', name: b.label, value: `${boat.name} (${boat.built}, ${length} ${b.m}, ${boat.capacity} ${b.people})` },
    itinerary: cruise.stops.length
      ? {
          '@type': 'ItemList',
          itemListElement: cruise.stops.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: { '@type': 'Place', name: s.key === 'return' ? names.skala : names[s.key] ?? s.key, description: tr(d.cruises, `${base}.stops.${s.key}`), geo: { '@type': 'GeoCoordinates', latitude: s.geo[0], longitude: s.geo[1] } },
          })),
        }
      : undefined,
    offers: cruise.prices ? [offer(det.adult, cruise.prices.adult), offer(det.child, cruise.prices.child)] : undefined,
  }
}

export function cruiseListLd(locale: Locale, items: { slug: string; name: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: absolute(`/${locale}/cruises/${c.slug}`), name: c.name })),
  }
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(it.path) })),
  }
}

export const orgRef = { '@id': ORG_ID }
