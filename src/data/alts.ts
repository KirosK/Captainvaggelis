import alts from './alts.generated.json'
import type { Locale } from '@/lib/i18n'
import type { Photo } from './types'

/** Localised alt texts keyed by image src (falls back to the English alt on the photo). */
export function getAlts(locale: Locale): Record<string, string> {
  return (alts as Record<Locale, Record<string, string>>)[locale] ?? {}
}

/** The alt text of a photo in the visitor's language. */
export function altFor(photo: Pick<Photo, 'src' | 'altEn'>, locale: Locale) {
  return getAlts(locale)[photo.src] ?? photo.altEn
}

/** Returns the photo with its altEn replaced by the localised alt (for components that read altEn). */
export function localized<T extends Pick<Photo, 'src' | 'altEn'>>(photo: T, locale: Locale): T {
  return { ...photo, altEn: altFor(photo, locale) }
}
