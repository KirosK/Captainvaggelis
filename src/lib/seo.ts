import type { Metadata } from 'next'
import { site } from '@/data/site'
import { locales, ogLocale, type Locale } from './i18n'
import { properties } from '@/data/properties'
import { altFor } from '@/data/alts'
import type { PropertyKey } from '@/data/types'

type ShareImage = { src: string; width: number; height: number; alt: string; /** src of the photo whose translated alt describes this image */ altSrc?: string }

/** 1200×630 share image cropped from a property's hero (made by scripts/prepare-images.mjs), described by the hero's alt. */
export function ogImage(p: PropertyKey): ShareImage {
  const hero = properties[p].hero
  return { src: `/media/og/${p}.jpg`, width: 1200, height: 630, alt: hero.altEn, altSrc: hero.src }
}

export function absolute(path: string) {
  return new URL(path, site.url).toString()
}

/** Shared metadata builder: canonical, hreflang alternates, Open Graph and Twitter cards. */
export function pageMetadata(opts: {
  locale: Locale
  path: string
  title: string
  description: string
  image?: ShareImage
  noindex?: boolean
}): Metadata {
  const { locale, path, title, description } = opts
  // pages without their own photo share the Aegealis crop (Theodora's own page passes the Theodora one)
  const base = opts.image ?? ogImage(path === '/theodora' ? 'theodora' : 'aegealis')
  // share previews describe the photo in the page's language when a translated alt exists
  const image = { src: base.src, width: base.width, height: base.height, alt: altFor({ src: base.altSrc ?? base.src, altEn: base.alt }, locale) }
  const clean = path === '/' ? '' : path
  // language-only hreflang so visitors from Cyprus, Switzerland etc. also match
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}${clean}`])) as Record<string, string>
  languages['x-default'] = `/en${clean}`
  const noindex = opts.noindex || process.env.NEXT_PUBLIC_NOINDEX === '1'
  return {
    metadataBase: new URL(site.url),
    title,
    description,
    alternates: { canonical: `/${locale}${clean}`, languages },
    openGraph: {
      type: 'website',
      siteName: site.brand,
      title,
      description,
      url: `/${locale}${clean}`,
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images: [{ url: image.src, width: image.width, height: image.height, alt: image.alt }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.src] },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
  }
}
