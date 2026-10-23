import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Hero } from '@/components/ui/Hero'
import { BookingBar } from '@/components/home/BookingBar'
import { TrustStrip } from '@/components/home/TrustStrip'
import { Intro } from '@/components/home/Intro'
import { PropertyDuo } from '@/components/home/PropertyDuo'
import { RoomFinder } from '@/components/home/RoomFinder'
import { CruiseTeaser } from '@/components/home/CruiseTeaser'
import { Story } from '@/components/home/Story'
import { ContactBlock } from '@/components/home/ContactBlock'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal } from '@/components/ui/Reveal'
import { RatingSummary } from '@/components/reviews/RatingSummary'
import { ReviewsWall } from '@/components/reviews/ReviewsWall'
import { AreaMap } from '@/components/map/AreaMap'
import { SkalaNow } from '@/components/map/SkalaNow'
import { properties } from '@/data/properties'
import { ratings, reviews } from '@/data/reviews'
import { films } from '@/data/videos'
import { localized } from '@/data/alts'
import { getDictionary, href, type Locale } from '@/lib/i18n'
import { ogImage, pageMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/JsonLd'
import { lodgingLd } from '@/lib/jsonld'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({
    locale: params.lang,
    path: '/',
    title: d.pages.seo.home.title,
    description: d.pages.seo.home.description,
    image: ogImage('aegealis'),
  })
}

const HOME_FAQ: [string, string][] = [
  ['stay', 'pool'],
  ['stay', 'cleaning'],
  ['families', 'kids'],
  ['cruises', 'discount'],
  ['getting', 'airport'],
]

export default async function Home({ params }: { params: { lang: Locale } }) {
  const locale = params.lang
  const d = await getDictionary(locale)
  const t = d.home
  const featured = reviews.filter((r) => r.featured)
  const faqItems = HOME_FAQ.map(([g, k]) => d.faq.groups[g].items[k] as { q: string; a: string })

  return (
    <>
      <Hero
        eyebrow={t.hero.eyebrow}
        seoHeading={d.glance.seo.home}
        title={t.hero.title}
        subtitle={t.hero.subtitle}
        image={localized(properties.aegealis.hero, locale)}
        video={films.home}
        labels={{ play: d.common.a11y.play, pause: d.common.a11y.pause }}
      >
        {/* the trust strip right below already says "no booking fees", so the hero stays clean */}
        <BookingBar locale={locale} t={t.bookingBar} common={d.common} hint={false} />
      </Hero>
      <TrustStrip common={d.common} locale={locale} />
      <Intro t={t.intro} />
      <PropertyDuo locale={locale} t={t.properties} common={d.common} g={d.glance} />
      <RoomFinder locale={locale} t={t.finder} common={d.common} units={d.units} />
      <CruiseTeaser locale={locale} t={t.cruises} cruises={d.cruises} common={d.common} />

      <section className="overflow-hidden bg-sand-paper py-24 md:py-32">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading kicker={t.reviews.kicker} title={t.reviews.title} intro={t.reviews.intro} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
            {(['aegealis', 'theodora'] as const).map((p, i) => (
              <Reveal key={p} delay={i * 0.1}>
                <RatingSummary locale={locale} common={d.common} score={ratings[p].score} count={ratings[p].count} categories={ratings[p].categories} title={properties[p].name} compact hide={['wifi']} />
              </Reveal>
            ))}
          </div>
        </div>
        <div className="mt-20">
          <ReviewsWall reviews={reviews} featured={featured} translations={d.reviews} locale={locale} common={d.common} />
        </div>
      </section>

      <Story t={t.story} locale={locale} />

      <section className="bg-sand py-24 md:py-32" id="map">
        <div className="container">
          <SectionHeading kicker={t.map.kicker} title={t.map.title} intro={t.map.intro} />
          <Reveal className="mt-12" y={30}>
            <AreaMap locale={locale} g={d.glance} />
          </Reveal>
          <Reveal className="mt-6" y={20}>
            <SkalaNow locale={locale} g={d.glance} />
          </Reveal>
        </div>
      </section>

      <section className="bg-sand-paper py-24 md:py-32">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading kicker={t.faq.kicker} title={t.faq.title} />
            <Reveal delay={0.15}>
              <Link href={href(locale, '/faq')} className="btn btn-ghost mt-8">
                {t.faq.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <Accordion items={faqItems} />
          </div>
        </div>
      </section>

      <ContactBlock t={t.contact} contact={d.pages.contact} locale={locale} />
      <JsonLd data={lodgingLd(locale, 'aegealis', { common: d.common, units: d.units, seo: d.pages.seo })} />
      <JsonLd data={lodgingLd(locale, 'theodora', { common: d.common, units: d.units, seo: d.pages.seo })} />
    </>
  )
}
