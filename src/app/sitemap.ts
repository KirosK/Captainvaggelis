import type { MetadataRoute } from 'next'
import { cruises } from '@/data/cruises'
import { site } from '@/data/site'
import { locales } from '@/lib/i18n'

const PATHS = ['', '/aegealis', '/theodora', '/cruises', ...cruises.map((c) => `/cruises/${c.slug}`), '/guide', '/faq', '/contact', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date('2026-10-23')
  return PATHS.flatMap((p) =>
    locales.map((l) => ({
      url: `${site.url}/${l}${p}`,
      lastModified: now,
      changeFrequency: p.startsWith('/cruises') ? ('weekly' as const) : ('monthly' as const),
      priority: p === '' || p === '/aegealis' || p === '/theodora' ? 1 : p === '/guide' ? 0.8 : p === '/cruises' ? 0.6 : p.startsWith('/cruises/') ? 0.5 : 0.4,
      alternates: { languages: { ...Object.fromEntries(locales.map((x) => [x, `${site.url}/${x}${p}`])), 'x-default': `${site.url}/en${p}` } },
    })),
  )
}
