import type { Viewport } from 'next'
import { notFound } from 'next/navigation'
import '../globals.css'
import { fontVars, preloadFonts } from '@/lib/fonts'
import { getDictionary, htmlLang, isLocale, locales, type Locale } from '@/lib/i18n'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ContactDock } from '@/components/layout/ContactDock'
import { JsonLd } from '@/components/JsonLd'
import { organizationLd } from '@/lib/jsonld'
import { MotionProvider } from '@/components/ui/MotionProvider'
import { inventory } from '@/data/properties'
import { cruises } from '@/data/cruises'

export const viewport: Viewport = {
  themeColor: '#0F2430',
  width: 'device-width',
  initialScale: 1,
}

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: { lang: string } }) {
  if (!isLocale(params.lang)) notFound()
  const locale = params.lang as Locale
  const d = await getDictionary(locale)
  const cruiseNames = Object.fromEntries(Object.entries(d.cruises.list as Record<string, { name: string }>).map(([k, v]) => [k, v.name]))
  return (
    <html lang={htmlLang[locale]} className={fontVars}>
      <head>
        {/* the web fonts used in the first screen, fetched straight away instead of after the CSS is parsed */}
        {preloadFonts(locale).map((f) => (
          <link key={f} rel="preload" href={f} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body>
        <MotionProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
            {d.common.a11y.skip}
          </a>
          <Header
            locale={locale}
            common={d.common}
            stayMeta={Object.fromEntries(
              (['aegealis', 'theodora'] as const).map((p) => {
                const inv = inventory(p)
                return [p, { identity: d.glance.identity[p], line: `${inv.total} ${d.glance.roomsBy?.[p] ?? d.glance.rooms}` }]
              }),
            )}
            cruiseSlugs={cruises.map((c) => c.slug)}
          />
          <main id="main">{children}</main>
          <Footer locale={locale} common={d.common} cruiseNames={cruiseNames} />
          <ContactDock locale={locale} common={d.common} cruiseNames={cruiseNames} />
        </MotionProvider>
        <JsonLd data={organizationLd(locale, d.common)} />
      </body>
    </html>
  )
}
