import geo from './pois.generated.json'
import type { PropertyKey } from './types'

export type PoiCategory = 'property' | 'beach' | 'food' | 'shop' | 'transport' | 'sight' | 'village' | 'cruise-point' | 'health'

export type Leg = { meters: number; walkMin?: number; driveMin?: number }
export type Route = { m: number; min: number; path: [number, number][] }

export type Poi = {
  key: string
  nameEn: string
  nameEl: string
  nameIt: string
  category: PoiCategory
  lat: number
  lng: number
  fromAegealis: Leg
  fromTheodora: Leg
  routes?: Partial<Record<PropertyKey, { walk?: Route; drive?: Route }>>
  note?: string
}

export const pois = ((geo as unknown as { pois: Poi[] }).pois ?? []).filter((p) => p.category !== 'property')

export function poiName(p: Poi, locale: 'en' | 'el' | 'it') {
  return locale === 'el' ? p.nameEl : locale === 'it' ? p.nameIt : p.nameEn
}

/** Map tabs, in the spirit of "what would a guest look for first". */
export const mapTabs = ['sea', 'food', 'daily', 'transport', 'explore'] as const
export type MapTab = (typeof mapTabs)[number]

// Places in the village itself are everyday errands, not day trips (Theodora is 3 minutes from the church square).
const EVERYDAY_VILLAGE = ['skala-centre', 'skala-church-square']

export function tabOf(p: Poi): MapTab {
  if (EVERYDAY_VILLAGE.includes(p.key)) return 'daily'
  switch (p.category) {
    case 'beach':
    case 'cruise-point':
      return 'sea'
    case 'food':
      return 'food'
    case 'shop':
    case 'health':
      return 'daily'
    case 'transport':
      return 'transport'
    default:
      return 'explore'
  }
}

/** The best way to get there from a property: walking when it is a sensible walk, otherwise driving. */
export function bestLeg(p: Poi, origin: PropertyKey): { mode: 'walk' | 'drive'; min: number; m: number; path?: [number, number][] } {
  const r = p.routes?.[origin]
  const leg = origin === 'aegealis' ? p.fromAegealis : p.fromTheodora
  const walk = r?.walk ?? (leg.walkMin != null ? { m: leg.meters, min: leg.walkMin, path: undefined } : undefined)
  const drive = r?.drive ?? (leg.driveMin != null ? { m: leg.meters, min: leg.driveMin, path: undefined } : undefined)
  if (walk && walk.min <= 25) return { mode: 'walk', min: walk.min, m: walk.m, path: walk.path }
  if (drive) return { mode: 'drive', min: drive.min, m: drive.m, path: drive.path }
  if (walk) return { mode: 'walk', min: walk.min, m: walk.m, path: walk.path }
  return { mode: 'walk', min: Math.max(1, Math.round(leg.meters / 80)), m: leg.meters }
}
