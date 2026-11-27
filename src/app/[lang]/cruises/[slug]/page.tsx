import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import { Hero } from '@/components/ui/Hero'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Itinerary } from '@/components/cruises/Itinerary'
import { CruiseBooking, CruiseRequest } from '@/components/cruises/CruiseBooking'
import { CruiseDays, CruiseHeroFacts, LiveText } from '@/components/cruises/LiveCruise'
import { CruisePhotos } from '@/components/cruises/CruisePhotos'
import { CruiseQuotes } from '@/components/cruises/CruiseQuotes'
import { StayBand } from '@/components/cruises/StayBand'
import { StickyAside } from '@/components/cruises/StickyAside'
import { JsonLd } from '@/components/JsonLd'
import { cruiseBySlug, cruiseQuotesFor, cruises, scheduleOf } from '@/data/cruises'
import { cruiseMedia } from '@/data/cruiseMedia'
import { placeNames } from '@/data/places'
import { properties } from '@/data/properties'
import { altFor, localized } from '@/data/alts'
import { fill, getDictionary, href, locales, quote as quoted, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'
import { breadcrumbLd, cruiseLd } from '@/lib/jsonld'
import { ScheduleSeed } from '@/lib/cruiseStore'
import { scheduleSeed } from '@/server/cruises/schedule'

// fares, days and times come from /admin: re-rendered at most a minute after a change (the admin also revalidates at once)
export const revalidate = 60

export function generateStaticParams() {
  return locales.flatMap((lang) => cruises.map((c) => ({ lang, slug: c.slug })))
}

function withMedia(slug: string) {
  const c = cruiseBySlug(slug)
  if (!c) return null
  const media = cruiseMedia.groups[c.key]
  const cover = media?.cover ?? cruiseMedia.hero ?? properties.aegealis.hero
  // the cover is already the hero, so the gallery starts with the next photo
  return { ...c, cover, photos: (media?.photos ?? []).filter((p) => p.src !== cover.src) }
}

export async function generateMetadata({ params }: { params: { lang: Locale; slug: string } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  const c = withMedia(params.slug)
  // unknown slug: the page renders the localised 404, so keep it out of the index
  if (!c) return { title: `${d.common.notFound.metaTitle} · ${d.common.brand.name}`, description: d.common.notFound.body, robots: { index: false, follow: true } }
  return pageMetadata({
    locale: params.lang,
    path: `/cruises/${c.slug}`,
    title: d.pages.seo[c.key].title,
    description: d.pages.seo[c.key].description,
    image: { ...c.cover, alt: altFor(c.cover, params.lang) },
  })
}

export default async function CruisePage({ params }: { params: { lang: Locale; slug: string } }) {
  const cruise = withMedia(params.slug)
  if (!cruise) notFound()
  const locale = params.lang
  const d = await getDictionary(locale)
  const c = d.common
  const h = d.cruises.hub
  const t = d.cruises.list[cruise.key]
  const det = d.cruises.detail
  const names = placeNames(locale)
  const others = cruises.filter((o) => o.key !== cruise.key && o.scheduled).slice(0, 3)

  const hasRoute = cruise.stops.length > 0 && !!t.stops
  const hasPoros = cruise.stops.some((s) => s.kind === 'pickup' && s.key === 'poros')
  const included = (t.included ?? det.includedItems) as string[]
  const notIncluded = (t.notIncluded ?? []) as string[]
  // request-only trips have no fixed fares or route, so only the general notes apply
  const notes = h.notes.items as string[]
  const porosNote = det.porosNote as string
  const sideNotes = cruise.scheduled ? [notes[0], ...(hasPoros ? [porosNote] : []), notes[1], notes[2], notes[3]] : [notes[0], notes[4]]
  // pages without a route have room beside the request form for the quote and the photos
  const quoteInMain = !hasRoute && !!t.quote
  const photosInMain = !hasRoute && cruise.photos.length > 0
  const gallerySection = hasRoute && (!!t.quote || cruise.photos.length > 0)
  const reviewQuotes = cruiseQuotesFor(cruise.key)
  // a page that already shows its own guest quote (the wedding cruises) skips a band holding a single general review
  const reviewsBand = reviewQuotes.length >= 2 || !t.quote
  // the bands below the main section alternate sand and paper, starting with sand (true = sand)
  let shown = 0
  const sand = (on: boolean) => on && shown++ % 2 === 0
  sand(gallerySection)
  const reviewsSand = reviewsBand && sand(true)
  const staySand = sand(true)
  const othersSand = sand(true)
  const alt = (on: boolean) => (on ? 'bg-sand' : 'bg-sand-paper')
  // the times quoted in the copy ("back in Skala by 16:45") follow the schedule set in /admin
  const live = { ...scheduleOf(cruise), stops: cruise.stops }
  // scheduled routes get a keyword-rich h1 from det.seoHeading (shown as the kicker); the route name stays the big title
  const seoHeading = cruise.scheduled && typeof det.seoHeading === 'string' ? fill(det.seoHeading, { name: t.name }) : undefined
  // the schedule saved in /admin: the server HTML and the JSON-LD offers show the live fares, days and times
  const seed = await scheduleSeed()
  const cfg = seed?.config[cruise.key]
  const ldCruise = cfg ? { ...cruise, weekdays: cfg.weekdays, depart: cfg.depart, returnSkala: cfg.returnSkala, prices: { adult: cfg.adult, child: cfg.child } } : cruise

  const quote = t.quote && (
    <Reveal>
      <figure className="border-l-2 pl-6" style={{ borderColor: cruise.accent }}>
        <blockquote>
          <p className="font-display text-[1.5rem] font-light italic leading-snug md:text-[1.7rem]">{quoted(locale, t.quote)}</p>
        </blockquote>
        <figcaption className="mt-3 text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.quoteBy}</figcaption>
      </figure>
    </Reveal>
  )

  return (
    <ScheduleSeed seed={seed}>
      <Hero
        eyebrow={cruise.scheduled ? det.eyebrow : t.days}
        seoHeading={seoHeading}
        title={t.name}
        subtitle={cruise.scheduled ? undefined : t.summary}
        image={localized(cruise.cover, locale)}
        size="tall"
        labels={{ play: c.a11y.play, pause: c.a11y.pause }}
      >
        {cruise.scheduled && (
          <>
            {/* the summary sits here rather than in the subtitle so that its times can follow /admin; the negative margin keeps the subtitle's spacing */}
            <p className="-mt-2 mb-7 max-w-xl text-[1rem] leading-relaxed text-white text-pretty [text-shadow:0_1px_12px_rgba(15,36,48,.5)] md:-mt-3 md:mb-9 md:text-[1.15rem]">
              <LiveText cruise={live} text={t.summary} />
            </p>
            <CruiseHeroFacts
              cruise={scheduleOf(cruise)}
              locale={locale}
              labels={{ days: det.days, depart: h.timetable.depart, back: h.timetable.return, price: det.price, skala: names.skala, adult: c.units.perAdult, child: c.units.perChild, paused: det.paused }}
            />
          </>
        )}
      </Hero>

      <section className="bg-sand-paper py-20 md:py-28">
        {/* main column in two parts so that on phones the booking card comes right after "Included", before the long timeline */}
        {/* first row hugs its content; any extra height from the tall booking card goes to the second row, not under "Included" */}
        <div className="container grid gap-x-14 gap-y-16 lg:grid-cols-12 lg:grid-rows-[auto_1fr] xl:gap-x-16">
          <div className="min-w-0 space-y-16 lg:col-span-7 lg:row-start-1">
            <div>
              <SectionHeading kicker={det.highlights} title={t.tagline} />
              <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
                {(t.highlights as string[]).map((x) => (
                  <StaggerItem key={x} className="flex items-start gap-3 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: cruise.accent }} aria-hidden="true" />
                    <span className="text-[0.98rem] font-medium">
                      <LiveText cruise={live} text={x} />
                    </span>
                  </StaggerItem>
                ))}
              </Stagger>
              {t.goodFor && (
                <p className="mt-6 text-[0.95rem] text-ink-soft">
                  <span className="font-semibold text-ink">{det.goodFor}:</span> {t.goodFor}
                </p>
              )}
            </div>

            {t.warning && (
              <Reveal>
                <aside className="rounded-xl3 bg-terra-light/60 p-7 ring-1 ring-terra/20">
                  <p className="flex items-center gap-2 font-display text-xl text-terra-deep">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" /> {t.warning.title}
                  </p>
                  <p className="mt-3 text-[1rem] leading-relaxed text-ink-soft">{t.warning.body}</p>
                </aside>
              </Reveal>
            )}

            <Reveal className="rounded-xl3 bg-white p-7 shadow-soft ring-1 ring-ink/5 md:p-8">
              <h2 className="font-display text-xl">{t.includedTitle ?? det.included}</h2>
              <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[0.95rem] sm:grid-cols-2">
                {included.map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sea" aria-hidden="true" /> {x}
                  </li>
                ))}
              </ul>
              {notIncluded.length > 0 && (
                <p className="mt-5 flex gap-2.5 border-t border-line pt-4 text-[0.88rem] text-ink-mute">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-terra" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink-soft">{det.notIncluded}:</span> {notIncluded.join(' · ')}
                  </span>
                </p>
              )}
            </Reveal>
          </div>

          <aside className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
            {/* stays in view while the timeline scrolls (bottom-aligned when the card is taller than the screen) */}
            <StickyAside>
              {cruise.scheduled ? (
                <CruiseBooking cruise={{ ...cruise, cover: undefined, photos: [] }} locale={locale} t={d.cruises.booking} common={c} name={t.name} />
              ) : (
                <CruiseRequest locale={locale} t={d.cruises.booking} common={c} contact={d.pages.contact} />
              )}
              <ul className="mt-5 space-y-2 px-2 text-[0.85rem] text-ink-mute">
                {sideNotes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sea" aria-hidden="true" />{' '}
                    {/* the Poros pick-up time follows the departure time set in /admin */}
                    {n === porosNote ? <LiveText cruise={live} text={n} /> : n}
                  </li>
                ))}
              </ul>
            </StickyAside>
          </aside>

          {(hasRoute || quoteInMain || photosInMain) && (
            <div className="min-w-0 space-y-16 lg:col-span-7 lg:row-start-2">
              {hasRoute && (
                <div id="route" className="scroll-mt-28">
                  <SectionHeading kicker={det.map} title={det.itinerary} />
                  <div className="mt-10">
                    <Itinerary
                      cruise={{ ...cruise, cover: undefined, photos: [] }}
                      stopsText={t.stops}
                      labels={det}
                      placeNames={names}
                      zoomLabels={{ in: c.a11y.zoomIn, out: c.a11y.zoomOut }}
                    />
                  </div>
                </div>
              )}

              {quoteInMain && quote}

              {photosInMain && <CruisePhotos photos={cruise.photos} locale={locale} common={c} />}
            </div>
          )}
        </div>
      </section>

      {gallerySection && (
        <section className="bg-sand py-20 md:py-28">
          <div className="container space-y-16">
            {quote}
            {cruise.photos.length > 0 && (
              <div>
                <SectionHeading kicker={d.property.ui.gallery} title={t.name} />
                <div className="mt-8">
                  <CruisePhotos photos={cruise.photos} locale={locale} common={c} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {reviewsBand && (
        <section className={`${alt(reviewsSand)} py-20 md:py-24`}>
          <div className="container">
            <SectionHeading kicker={d.home.reviews.kicker} title={h.reviewsTitle} />
            <CruiseQuotes className="mt-10" quotes={reviewQuotes} locale={locale} translations={d.cruises.reviewQuotes} common={c} />
          </div>
        </section>
      )}

      {/* the 20% guest discount covers the scheduled cruises only, so charter pages get a title without it */}
      <StayBand locale={locale} t={cruise.scheduled ? det.stay : { ...det.stay, title: det.stay.titleCharter }} props={d.home.properties} common={c} tone={staySand ? 'sand' : 'paper'} />

      <section className={`${alt(othersSand)} py-20 md:py-24`}>
        <div className="container">
          <SectionHeading kicker={h.choose.title} title={det.other} />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {others.map((o) => {
              const media = cruiseMedia.groups[o.key]
              return (
                <Link key={o.key} href={href(locale, `/cruises/${o.slug}`)} className="group overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-ink/5">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {media?.cover && <Image src={media.cover.src} alt={altFor(media.cover, locale)} fill sizes="(min-width:768px) 32vw, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-105" />}
                  </div>
                  <div className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-display text-xl">{d.cruises.list[o.key].name}</p>
                      <p className="text-[0.85rem] text-ink-mute">
                        <CruiseDays cruise={scheduleOf(o)} locale={locale} paused={det.paused} />
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <JsonLd data={cruiseLd(locale, ldCruise, { cruises: d.cruises, seo: d.pages.seo })} />
      <JsonLd
        data={breadcrumbLd([
          { name: c.nav.home, path: `/${locale}` },
          { name: c.nav.cruises, path: `/${locale}/cruises` },
          { name: t.name, path: `/${locale}/cruises/${cruise.slug}` },
        ])}
      />
    </ScheduleSeed>
  )
}
