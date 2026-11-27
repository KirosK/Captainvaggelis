import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgePercent, Check, Clock, Gauge, Ruler, Users, Wrench, Waves, Calendar, Fish } from 'lucide-react'
import { Hero } from '@/components/ui/Hero'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Gallery } from '@/components/ui/Gallery'
import { Accordion } from '@/components/ui/Accordion'
import { WeekStrip } from '@/components/cruises/WeekStrip'
import { CruiseDays, CruisePrice, CruiseTimes, LiveText, LiveTextMany } from '@/components/cruises/LiveCruise'
import { CruiseQuotes } from '@/components/cruises/CruiseQuotes'
import { StayBand } from '@/components/cruises/StayBand'
import { JsonLd } from '@/components/JsonLd'
import { cruiseReviewQuotes, cruises, scheduledCruises, scheduleOf } from '@/data/cruises'
import { cruiseMedia } from '@/data/cruiseMedia'
import { properties } from '@/data/properties'
import { films } from '@/data/videos'
import { altFor, localized } from '@/data/alts'
import { getDictionary, href, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'
import { breadcrumbLd } from '@/lib/jsonld'
import { ScheduleSeed } from '@/lib/cruiseStore'
import { scheduleSeed } from '@/server/cruises/schedule'

// fares, days and times come from /admin: re-rendered at most a minute after a change (the admin also revalidates at once)
export const revalidate = 60

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  const img = cruiseMedia.hero ?? properties.aegealis.hero
  return pageMetadata({ locale: params.lang, path: '/cruises', title: d.pages.seo.cruises.title, description: d.pages.seo.cruises.description, image: { ...img, alt: altFor(img, params.lang) } })
}

const TAGS = ['kids', 'culture', 'swim', 'adventure', 'short'] as const

export default async function CruisesHub({ params }: { params: { lang: Locale } }) {
  const locale = params.lang
  const d = await getDictionary(locale)
  const c = d.common
  const h = d.cruises.hub
  const hero = cruiseMedia.hero ?? properties.aegealis.hero
  const boatPhotos = cruiseMedia.groups['boat-niriis']?.photos ?? []
  const faqItems = Object.values(d.faq.groups.cruises.items) as { q: string; a: string }[]
  const specs = [
    { icon: Ruler, label: h.boat.specs.length, value: h.boat.specValues.length },
    { icon: Users, label: h.boat.specs.capacity, value: h.boat.specValues.capacity },
    { icon: Gauge, label: h.boat.specs.speed, value: h.boat.specValues.speed },
    { icon: Calendar, label: h.boat.specs.built, value: h.boat.specValues.built },
    { icon: Wrench, label: h.boat.specs.engines, value: h.boat.specValues.engines },
    { icon: Waves, label: h.boat.specs.stabilisers, value: h.boat.specValues.stabilisers },
  ]
  const boatText = String(h.boat.body).split('\n\n')
  // times in the copy follow the schedule set in /admin
  const live = (cr: (typeof scheduledCruises)[number]) => ({ ...scheduleOf(cr), stops: cr.stops })
  // the schedule saved in /admin, so the server HTML already shows the live fares, days and times
  const seed = await scheduleSeed()

  return (
    <ScheduleSeed seed={seed}>
      <Hero eyebrow={h.hero.eyebrow} seoHeading={d.glance.seo.cruises} title={h.hero.title} subtitle={h.hero.subtitle} image={localized(hero, locale)} video={films.cruises} labels={{ play: c.a11y.play, pause: c.a11y.pause }}>
        <div className="flex flex-wrap gap-3">
          <a href="#timetable" className="btn btn-light">
            {h.timetable.title}
          </a>
          {/* a label, not a second button: smaller and lighter than the CTA beside it, with a discount icon */}
          <p className="inline-flex items-center gap-1.5 self-center rounded-2xl bg-sun/90 px-3 py-1.5 text-[0.8rem] font-semibold leading-snug text-ink">
            <BadgePercent className="h-4 w-4 shrink-0" aria-hidden="true" />
            {c.trust.guestDiscount}
          </p>
        </div>
      </Hero>

      <section id="timetable" className="scroll-mt-28 bg-sand-paper py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={h.timetable.season} title={h.timetable.title} />
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-pretty text-ink-soft">
              <LiveTextMany cruises={scheduledCruises.map(live)} text={h.timetable.intro} />
            </p>
          </Reveal>
          <div className="mt-10">
            <WeekStrip locale={locale} cruiseNames={d.cruises.list} labels={{ depart: h.timetable.depart, return: h.timetable.return }} />
          </div>
        </div>
      </section>

      <section className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={c.nav.cruises} title={h.choose.title} intro={h.choose.intro} />
          <div className="mt-12 space-y-6">
            {scheduledCruises.map((cr, i) => {
              const t = d.cruises.list[cr.key]
              const media = cruiseMedia.groups[cr.key]
              return (
                <Reveal key={cr.key} y={40} delay={i ? 0.04 : 0}>
                  <Link href={href(locale, `/cruises/${cr.slug}`)} className="group grid overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 transition-shadow duration-500 hover:shadow-lift md:grid-cols-[1.1fr_1fr]">
                    <div className={`relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[340px] ${i % 2 ? 'md:order-2' : ''}`}>
                      {media?.cover && <Image src={media.cover.src} alt={altFor(media.cover, locale)} fill sizes="(min-width:768px) 52vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-swift group-hover:scale-105" />}
                    </div>
                    <div className="flex flex-col p-7 md:p-10">
                      <p className="flex items-center gap-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cr.accent }} aria-hidden="true" />
                        <CruiseDays cruise={scheduleOf(cr)} locale={locale} paused={d.cruises.detail.paused} />
                      </p>
                      <h3 className="mt-2 font-display text-display-sm">{t.name}</h3>
                      <p className="mt-4 text-[1rem] leading-relaxed text-ink-soft">
                        <LiveText cruise={live(cr)} text={t.summary} />
                      </p>
                      <ul className="mt-5 flex flex-wrap gap-2">
                        {(t.highlights as string[]).slice(0, 4).map((x) => (
                          <li key={x} className="rounded-full bg-sand px-3 py-1.5 text-[0.8rem] font-medium text-ink-soft">
                            <LiveText cruise={live(cr)} text={x} />
                          </li>
                        ))}
                      </ul>
                      <div className="flex-1" />
                      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                        <p className="flex items-center gap-4 text-[0.9rem] text-ink-soft">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-ink-mute" aria-hidden="true" /> <CruiseTimes cruise={scheduleOf(cr)} />
                          </span>
                          <span>
                            {c.units.from}{' '}
                            <strong className="font-display text-2xl font-normal text-ink">
                              <CruisePrice cruise={scheduleOf(cr)} locale={locale} />
                            </strong>
                          </span>
                        </p>
                        <span className="btn btn-primary">
                          {c.cta.bookCruise} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>

          <Reveal className="mt-14">
            {/* the title stays outside the scroller so it is never cut on a phone; the feature column stays put while the cruises scroll */}
            <div className="overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5">
              <h3 id="compare-title" className="p-6 font-display text-2xl text-balance">{h.compare.title}</h3>
              <div className="relative overflow-x-auto" role="region" aria-labelledby="compare-title" tabIndex={0}>
                {/* fixed layout: the feature column takes 28%, the four cruises share the rest equally */}
                <table className="w-full min-w-[640px] table-fixed text-left text-[0.92rem]">
                  <caption className="sr-only">{h.compare.title}</caption>
                  <thead>
                    <tr className="border-y border-line bg-sand/50">
                      <td className="sticky left-0 z-10 w-[28%] bg-[#FAF7F2] p-4" />
                      {scheduledCruises.map((cr) => (
                        <th key={cr.key} scope="col" className="p-4 font-semibold">
                          {d.cruises.list[cr.key].name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TAGS.map((tag) => (
                      <tr key={tag} className="border-b border-line last:border-0">
                        <th scope="row" className="sticky left-0 z-10 w-[28%] bg-white p-4 font-medium text-ink-soft shadow-[1px_0_0_rgba(15,36,48,.06)]">
                          {h.compare[tag]}
                        </th>
                        {scheduledCruises.map((cr) => (
                          <td key={cr.key} className="p-4">
                            {cr.tags.includes(tag) ? (
                              <>
                                <Check className="h-5 w-5 text-sea" aria-hidden="true" />
                                <span className="sr-only">{h.compare.yes}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-ink-mute/50" aria-hidden="true">—</span>
                                <span className="sr-only">{h.compare.no}</span>
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink py-24 text-white md:py-32">
        <div className="container grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHeading kicker={h.boat.kicker} title={h.boat.title} tone="light" />
            {boatText.map((p, i) => (
              <Reveal key={i} delay={0.08 + i * 0.05}>
                <p className="mt-6 text-[1.04rem] leading-[1.8] text-white/75">{p}</p>
              </Reveal>
            ))}
            <Stagger className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl2 bg-white/10 sm:grid-cols-3">
              {specs.map((s) => (
                <StaggerItem key={s.label} className="bg-ink p-5">
                  <s.icon className="h-5 w-5 text-sea-light" />
                  <p className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/50">{s.label}</p>
                  <p className="mt-1 font-display text-lg leading-snug text-balance">{s.value}</p>
                </StaggerItem>
              ))}
            </Stagger>
            <ul className="mt-8 grid grid-cols-2 gap-3 text-[0.92rem] text-white/80">
              {(h.boat.features as string[]).map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sea-light" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6">
            {boatPhotos.length > 0 && <Gallery photos={boatPhotos} common={c} limit={4} locale={locale} />}
            <Reveal className="mt-8 overflow-hidden rounded-xl3 bg-white/[0.06] ring-1 ring-white/15">
              {cruiseMedia.groups.kalypso?.cover && (
                <div className="relative aspect-[16/7]">
                  <Image src={cruiseMedia.groups.kalypso.cover.src} alt={altFor(cruiseMedia.groups.kalypso.cover, locale)} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
                </div>
              )}
              <div className="p-7">
              <p className="flex items-center gap-2 font-display text-2xl">
                <Fish className="h-5 w-5 text-sea-light" /> {h.kalypso.title}
              </p>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-white/75">{h.kalypso.body}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-sand-paper py-20 md:py-28">
        <div className="container grid gap-6 md:grid-cols-2">
          {[h.notes, h.bring].map((block) => (
            <Reveal key={block.title} className="rounded-xl3 bg-white p-8 shadow-soft ring-1 ring-ink/5">
              <h2 className="font-display text-2xl">{block.title}</h2>
              <ul className="mt-5 space-y-3 text-[0.98rem]">
                {(block.items as string[]).map((x) => (
                  <li key={x} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-sea" /> {x}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        <div className="container mt-6">
          <Reveal>
            <div className="flex flex-col gap-6 rounded-xl3 bg-sand p-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl">{h.private.title}</h2>
                <p className="mt-2 text-ink-soft">{h.private.body}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {cruises
                  .filter((x) => !x.scheduled)
                  .map((x) => (
                    <Link key={x.key} href={href(locale, `/cruises/${x.slug}`)} className="btn btn-ghost bg-white">
                      {d.cruises.list[x.key].name}
                    </Link>
                  ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={d.home.reviews.kicker} title={h.reviewsTitle} />
          {/* Iulia's "20% off for any cruise" sits beside the BBQ, private and wedding links here, where the discount does not apply */}
          <CruiseQuotes className="mt-10" quotes={cruiseReviewQuotes.filter((q) => q.id !== 'ag-iulia')} locale={locale} translations={d.cruises.reviewQuotes} common={c} />
        </div>
      </section>

      <StayBand locale={locale} t={d.cruises.detail.stay} props={d.home.properties} common={c} tone="paper" />

      <section className="bg-sand py-20 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading kicker={d.faq.groups.cruises.title} title={d.home.faq.title} />
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <Accordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* no FAQPage markup here: the same questions are marked up once, on /faq */}
      <JsonLd data={breadcrumbLd([{ name: c.nav.home, path: `/${locale}` }, { name: c.nav.cruises, path: `/${locale}/cruises` }])} />
    </ScheduleSeed>
  )
}
