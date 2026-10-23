import { Gallery } from '@/components/ui/Gallery'
import type { Photo } from '@/data/types'
import type { Dict, Locale } from '@/lib/i18n'

/**
 * Photos of one cruise as the shared editorial mosaic, which closes into full rows for any count
 * (a 5-photo set shows all five; beyond eight, the last tile opens the rest in the lightbox).
 * Server component: Gallery localises the alts here, so only the shown language travels to the browser.
 */
export function CruisePhotos({ photos, locale, common }: { photos: Photo[]; locale: Locale; common: Dict }) {
  if (!photos.length) return null
  return <Gallery photos={photos} common={common} locale={locale} />
}
