import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Bus, Plane, Ship, Sun } from 'lucide-react'
import { Hero } from '@/components/ui/Hero'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { AreaMap } from '@/components/map/AreaMap'
import { JsonLd } from '@/components/JsonLd'
import { cruiseMedia } from '@/data/cruiseMedia'
import { cruises } from '@/data/cruises'
import { altFor, localized } from '@/data/alts'
import { inventory, properties } from '@/data/properties'
import Image from 'next/image'
import { IdentityBadge } from '@/components/property/PropertyGlance'
import { getDictionary, href, htmlLang, type Locale } from '@/lib/i18n'
import { pageMetadata, absolute } from '@/lib/seo'
import { breadcrumbLd, orgRef, skalaName } from '@/lib/jsonld'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  const img = properties.aegealis.hero
  return pageMetadata({ locale: params.lang, path: '/guide', title: d.pages.seo.guide.title, description: d.pages.seo.guide.description, image: { ...img, alt: img.altEn } })
}

export default async function GuidePage({ params }: { params: { lang: Locale } }) {
  const locale = params.lang
  const d = await getDictionary(locale)
  const g = d.guide
  const c = d.common
  const heroImg = cruiseMedia.groups.fiscardo?.cover ?? properties.aegealis.hero
  const intro = String(g.intro.body).split('\n\n')
  const beaches = Object.entries(g.beaches.items as Record<string, { name: string; body: string }>)
  const todo = Object.entries(g.todo.items as Record<string, { name: string; body: string }>)
  // where a place in the guide is also a stop on a cruise, or right outside one of the properties, link to it
  const cruiseLink = (key: string) => {
    const cr = cruises.find((x) => x.key === key)
    return cr ? [{ href: href(locale, `/cruises/${cr.slug}`), label: d.cruises.list[key].name as string }] : []
  }
  const related: Record<string, { href: string; label: string }[]> = {
    skala: [
      { href: href(locale, '/aegealis'), label: properties.aegealis.name },
      { href: href(locale, '/theodora'), label: properties.theodora.name },
    ],
    miniMyrtos: [...cruiseLink('fiscardo'), ...cruiseLink('bbq')],
    melissani: cruiseLink('fiscardo'),
  }
  const Related = ({ k }: { k: string }) =>
    related[k]?.length ? (
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {related[k].map((r) => (
          <Link key={r.href} href={r.href} className="group inline-flex items-center gap-1.5 text-[0.92rem] font-semibold text-sea-deep">
            {r.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        ))}
      </p>
    ) : null
  const getting = [
    { icon: Plane, ...g.gettingHere.air },
    { icon: Ship, ...g.gettingHere.ferry },
    { icon: Bus, ...g.gettingHere.around },
  ]

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.hero.title,
    description: d.pages.seo.guide.description,
    inLanguage: htmlLang[locale],
    datePublished: '2026-10-23',
    dateModified: '2026-10-23',
    author: orgRef,
    publisher: orgRef,
    image: absolute(heroImg.src),
    about: [
      { '@type': 'Place', name: skalaName(locale), geo: { '@type': 'GeoCoordinates', latitude: 38.0738, longitude: 20.7969 } },
      ...beaches.map(([, b]) => ({ '@type': 'Beach', name: b.name })),
    ],
  }

  return (
    <>
      <Hero eyebrow={g.hero.eyebrow} title={g.hero.title} subtitle={g.hero.subtitle} image={localized(heroImg, locale)} size="tall" labels={{ play: c.a11y.play, pause: c.a11y.pause }} />

      <section className="bg-sand-paper py-20 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading kicker={d.glance.kickers.aboutSkala} title={g.intro.title} />
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {intro.map((p, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <p className={`text-[1.08rem] leading-[1.8] text-ink-soft text-pretty ${i ? 'mt-6' : ''}`}>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={d.home.map.filters.beach} title={g.beaches.title} />
          <Stagger className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {beaches.map(([k, b], i) => (
              <StaggerItem key={k} as="article" className="rounded-xl3 bg-white p-7 shadow-soft ring-1 ring-ink/5">
                <span className="font-display text-[2.4rem] font-light leading-none text-sea/60 tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-display text-2xl">{b.name}</h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">{b.body}</p>
                <Related k={k} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="bg-sand-paper py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={d.home.map.kicker} title={d.home.map.title} intro={d.home.map.intro} />
          <Reveal className="mt-10" y={30}>
            <AreaMap locale={locale} g={d.glance} initialTab="explore" />
          </Reveal>
        </div>
      </section>

      <section className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={d.home.map.filters.sight} title={g.todo.title} />
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {todo.map(([k, x], i) => (
              <Reveal key={k} delay={(i % 2) * 0.06} className="border-t border-line pt-6">
                <h3 className="font-display text-2xl">{x.name}</h3>
                <p className="mt-3 text-[1rem] leading-relaxed text-ink-soft">{x.body}</p>
                <Related k={k} />
                {k === 'cruise' && (
                  <Link href={href(locale, '/cruises')} className="mt-4 inline-flex items-center gap-2 font-semibold text-sea">
                    {c.cta.bookACruise} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sand-paper py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={c.nav.stay} title={d.glance.seo.whereToStay} intro={d.glance.seo.whereToStayIntro} />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {(['aegealis', 'theodora'] as const).map((p) => {
              const prop = properties[p]
              const inv = inventory(p)
              const img = prop.extras.card ?? prop.hero
              return (
                <Reveal key={p}>
                  <Link href={href(locale, `/${p}`)} className="group flex h-full flex-col overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 transition-shadow hover:shadow-lift">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image src={img.src} alt={altFor(img, locale)} fill sizes="(min-width:768px) 45vw, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                      <IdentityBadge p={p} g={d.glance} className="absolute left-4 top-4" />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-2xl">{prop.name}</h3>
                      <p className="mt-1 text-[0.9rem] text-ink-mute">
                        {inv.total} {d.glance.roomsBy?.[p] ?? d.glance.rooms}
                      </p>
                      <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">{d.home.properties[p].pitch}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 font-semibold text-ink">
                        {c.cta.viewRooms} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-white md:py-28">
        <div className="container">
          <SectionHeading kicker={d.glance.kickers.practical} title={g.gettingHere.title} tone="light" />
          <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
            {getting.map((x) => (
              <StaggerItem key={x.title} className="rounded-xl3 bg-white/[0.06] p-7 ring-1 ring-white/15">
                <x.icon className="h-6 w-6 text-sea-light" />
                <h3 className="mt-5 font-display text-2xl">{x.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-white/75">{x.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-8 flex items-start gap-4 rounded-xl3 bg-sun/15 p-7 ring-1 ring-sun/30">
            <Sun className="mt-1 h-6 w-6 shrink-0 text-sun" />
            <div>
              <h3 className="font-display text-2xl">{g.when.title}</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-white/80">{g.when.body}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd([{ name: c.nav.home, path: `/${locale}` }, { name: c.nav.guide, path: `/${locale}/guide` }])} />
    </>
  )
}
