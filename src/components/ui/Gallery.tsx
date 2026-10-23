import { LightboxGallery, type MosaicTile } from './Lightbox'
import type { Photo } from '@/data/types'
import { localized } from '@/data/alts'
import { fill, type Dict, type Locale } from '@/lib/i18n'

type GPhoto = Photo & { section?: string }
type Kind = 'full' | 'large' | 'wide' | 'small'

// Spans for the 2-column (phone) and 4-column (md+) grid. "large" is 2×2, "wide" 2×1, "small" 1×1.
const SPAN: Record<Kind, string> = {
  full: 'col-span-2 row-span-2 md:col-span-4',
  large: 'col-span-2 row-span-2',
  wide: 'col-span-2',
  small: '',
}
// Rendered widths: the container tops out at 1264px of content (1360px minus padding).
const SIZES: Record<Kind, string> = {
  full: '(min-width:1360px) 1264px, 100vw',
  large: '(min-width:1360px) 630px, (min-width:768px) 50vw, 100vw',
  wide: '(min-width:1360px) 630px, (min-width:768px) 50vw, 100vw',
  small: '(min-width:1360px) 310px, (min-width:768px) 25vw, 50vw',
}
// One pattern per tile count. Every pattern closes into full rows at both 2 and 4 columns, so no cell stays empty.
const PATTERNS: Record<number, Kind[]> = {
  1: ['full'],
  2: ['large', 'large'],
  3: ['large', 'wide', 'wide'],
  4: ['large', 'wide', 'small', 'small'],
  5: ['large', 'small', 'small', 'small', 'small'],
  6: ['large', 'wide', 'small', 'small', 'wide', 'wide'],
  7: ['large', 'small', 'small', 'wide', 'wide', 'small', 'small'],
  8: ['large', 'small', 'small', 'wide', 'small', 'small', 'small', 'small'],
}

function layout(count: number): Kind[] {
  const kinds: Kind[] = []
  for (let left = count; left > 0; left -= 8) kinds.push(...PATTERNS[Math.min(left, 8)])
  return kinds
}

/**
 * Editorial mosaic that adapts to 1–8 photos (groups of 8 beyond that) and opens the lightbox.
 * Server component: it localises the alts here so only the photos it shows travel to the browser.
 * Pass `locale` (preferred) or the `alt` map from getAlts(locale).
 */
export function Gallery({
  photos,
  common,
  limit = 8,
  alt,
  locale,
}: {
  photos: GPhoto[]
  common: Dict
  limit?: number
  alt?: Record<string, string>
  locale?: Locale
}) {
  if (!photos.length) return null
  const list: Photo[] = photos.map((p) => {
    const lp = locale ? localized(p, locale) : { ...p, altEn: alt?.[p.src] ?? p.altEn }
    return { src: lp.src, width: lp.width, height: lp.height, altEn: lp.altEn, ...(lp.focus ? { focus: lp.focus } : {}) }
  })
  const shown = Math.min(list.length, Math.max(1, limit))
  const tiles: MosaicTile[] = layout(shown).map((k) => ({ span: SPAN[k], sizes: SIZES[k] }))
  const a = common.a11y

  return (
    <LightboxGallery
      photos={list}
      tiles={tiles}
      labels={{ dialog: a.gallery ?? a.zoom, close: a.close, prev: a.prev, next: a.next, photo: a.photo }}
      viewAll={list.length > shown ? fill(common.cta.viewAllPhotos, { count: list.length }) : undefined}
    />
  )
}
