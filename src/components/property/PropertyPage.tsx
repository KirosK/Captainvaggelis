import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgePercent, Check, Clock, Info, LogIn, LogOut, PawPrint, Baby, BedDouble, CalendarRange, CalendarX, CigaretteOff, Moon, PartyPopper, Wallet } from 'lucide-react'
import { Hero } from '@/components/ui/Hero'
import { SubNav } from './SubNav'
import { UnitCard } from './UnitCard'
import { Gallery } from '@/components/ui/Gallery'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Accordion } from '@/components/ui/Accordion'
import { featureIcon } from '@/components/ui/featureIcons'
import { RatingSummary } from '@/components/reviews/RatingSummary'
import { ReviewsWall } from '@/components/reviews/ReviewsWall'
import { AreaMap } from '@/components/map/AreaMap'
import { SkalaNow } from '@/components/map/SkalaNow'
import { BookingBar } from '@/components/home/BookingBar'
import { JsonLd } from '@/components/JsonLd'
import { properties, unitsFor } from '@/data/properties'
import { ratings, reviews } from '@/data/reviews'
import { films } from '@/data/videos'
import { cruiseMedia } from '@/data/cruiseMedia'
import type { PropertyKey } from '@/data/types'
import { getDictionary, href, tr, type Locale } from '@/lib/i18n'
import { breadcrumbLd, lodgingLd } from '@/lib/jsonld'
import { altFor, localized } from '@/data/alts'
import { IdentityBadge, PropertyGlance, RoomsTable } from './PropertyGlance'

const FAQ_KEYS: Record<PropertyKey, [string, string][]> = {
  aegealis: [['stay', 'checkin'], ['stay', 'pool'], ['stay', 'breakfast'], ['stay', 'parking'], ['stay', 'wifi'], ['families', 'cot'], ['getting', 'find'], ['cruises', 'where']],
  theodora: [['stay', 'checkin'], ['stay', 'late'], ['stay', 'pool'], ['stay', 'parking'], ['stay', 'kitchen'], ['families', 'five'], ['getting', 'car'], ['cruises', 'discount']],
}

export async function PropertyPage({ p, locale }: { p: PropertyKey; locale: Locale }) {
  const d = await getDictionary(locale)
  const prop = properties[p]
  const t = d.property[p]
  const ui = d.property.ui
  const c = d.common
  const units = unitsFor(p)
  const propReviews = reviews.filter((r) => r.property === p)
  const featured = propReviews.filter((r) => r.featured)
  const other: PropertyKey = p === 'aegealis' ? 'theodora' : 'aegealis'
  const accent = prop.accent
  const faqItems = FAQ_KEYS[p].map(([g, k]) => d.faq.groups[g].items[k] as { q: string; a: string })
  const overview = String(t.overview.body).split('\n\n')

  const policyRows = [
    { icon: LogIn, label: ui.checkIn, value: t.policies.checkIn },
    { icon: LogOut, label: ui.checkOut, value: t.policies.checkOut },
    // the room terms of the family's booking engine: minimum stay, deposit and cancellation
    { icon: CalendarRange, label: ui.minStay, value: t.policies.minStay },
    { icon: Wallet, label: ui.payment, value: t.policies.payment },
    { icon: CalendarX, label: ui.cancellation, value: t.policies.cancellation },
    { icon: Baby, label: ui.children, value: t.policies.children },
    { icon: BedDouble, label: ui.extraBeds, value: t.policies.extraBeds },
    { icon: PawPrint, label: ui.pets, value: t.policies.pets },
    { icon: CigaretteOff, label: ui.smoking, value: t.policies.smoking },
    { icon: PartyPopper, label: ui.parties, value: t.policies.parties },
    // only Aegealis has confirmed quiet hours; at Theodora the parties row already asks guests to keep it quiet
    ...(p === 'aegealis' ? [{ icon: Moon, label: ui.quietHours, value: t.policies.quietHours }] : []),
  ]
  // the last rule widens to close its row, so the grid never shows an empty grey cell
  const lastRule = [policyRows.length % 2 ? 'sm:col-span-2' : '', ['lg:col-span-1', 'lg:col-span-3', 'lg:col-span-2'][policyRows.length % 3]].join(' ')

  const nav = [
    { id: 'overview', label: ui.overview },
    { id: 'rooms', label: ui.rooms },
    { id: 'photos', label: ui.gallery },
    { id: 'location', label: ui.location },
    { id: 'reviews', label: ui.reviews },
    { id: 'rules', label: ui.policies },
    { id: 'questions', label: ui.faq },
  ]

  return (
    <div className={accent === 'sea' ? 'theme-sea' : 'theme-terra'}>
      <Hero eyebrow={t.hero.eyebrow} seoHeading={d.glance.seo[p]} title={t.hero.title} subtitle={t.hero.subtitle} image={localized(prop.hero, locale)} video={films[p]} size="tall" labels={{ play: c.a11y.play, pause: c.a11y.pause }}>
        <ul className="flex flex-wrap items-center gap-2">
          <li>
            <IdentityBadge p={p} g={d.glance} />
          </li>
          {/* only the two strongest points: the "at a glance" band right below carries the rest */}
          {(t.chips as string[]).slice(0, 2).map((chip) => (
            <li key={chip} className="rounded-full bg-white/12 px-3.5 py-1.5 text-[0.85rem] font-medium text-white ring-1 ring-white/25 backdrop-blur">
              {chip}
            </li>
          ))}
        </ul>
      </Hero>

      <PropertyGlance p={p} g={d.glance} units={d.units} />

      <SubNav
        items={nav}
        label={c.a11y.sections}
        cta={
          <Link href={`${href(locale, '/book')}?property=${p}`} className={`btn py-2.5 ${accent === 'sea' ? 'btn-sea' : 'btn-terra'}`}>
            {c.cta.checkAvailability}
          </Link>
        }
      />

      {/* Overview */}
      <section id="overview" className="bg-sand-paper py-20 md:py-28">
        <div className="container grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal y={10} blur={false}>
              <p className="kicker">{ui.overview}</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.overview.title}</h2>
            </Reveal>
            {overview.map((para, i) => (
              <Reveal key={i} delay={0.08 + i * 0.05}>
                <p className="mt-6 text-[1.06rem] leading-[1.8] text-ink-soft text-pretty">{para}</p>
              </Reveal>
            ))}
            <div className="mt-12">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{ui.whyGuests}</p>
              <Stagger className="mt-5 grid gap-4 sm:grid-cols-2">
                {(t.why as { title: string; body: string }[]).map((w) => (
                  <StaggerItem key={w.title} className="rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-ink/5">
                    <h3 className="font-display text-[1.25rem]">{w.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{w.body}</p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="sticky top-44 space-y-5">
              <Reveal>
                <div className="rounded-xl3 bg-ink p-7 text-white shadow-lift">
                  <p className="font-display text-2xl text-balance">{ui.bookingCardTitle}</p>
                  <p className="mt-2 text-[0.92rem] text-white/70">{ui.bookingCardNote}</p>
                  <ul className="mt-6 space-y-2.5 text-[0.92rem]">
                    {/* booking is self-service: live engine, online deposit (facts.md, "Booking engine and payments") */}
                    {[c.trust.noCommission, c.trust.secure, c.trust.guestDiscount].map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-sea-light" />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <Link href={`${href(locale, '/book')}?property=${p}`} className="btn btn-light mt-7 w-full whitespace-nowrap text-[0.9rem]">
                    {c.cta.checkAvailability} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <RatingSummary locale={locale} common={c} score={ratings[p].score} count={ratings[p].count} categories={ratings[p].categories} title={ui.categoryScores} compact hide={['wifi']} />
              </Reveal>
            </div>
          </aside>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={ui.rooms} title={ui.chooseRoom} intro={ui.chooseRoomIntro} />
          <Reveal className="mt-10" y={24}>
            <RoomsTable p={p} g={d.glance} units={d.units} />
          </Reveal>
          <div className="mt-10 space-y-8">
            {units.map((u, i) => (
              <Reveal key={u.key} y={40} delay={i ? 0.05 : 0}>
                {/* UnitCard is a client component: hand it only its own photos, already in the page language */}
                <UnitCard unit={{ ...u, photos: u.photos.map((ph) => localized(ph, locale)) }} fallback={localized(prop.hero, locale)} locale={locale} units={d.units} common={c} ui={ui} g={d.glance} accent={accent} />
              </Reveal>
            ))}
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-xl3 bg-white p-7 shadow-soft ring-1 ring-ink/5">
                <h3 className="font-display text-2xl">{ui.inEveryRoom}</h3>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  {prop.roomFeatures.map((f) => {
                    const Icon = featureIcon[f]
                    return (
                      <li key={f} className="flex items-center gap-3 text-[0.95rem]">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${accent === 'sea' ? 'bg-sea-mist text-sea' : 'bg-terra-light text-terra'}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {c.features[f]}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-xl3 bg-white p-7 shadow-soft ring-1 ring-ink/5">
                <h3 className="font-display text-2xl">{ui.onSite}</h3>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  {prop.features.map((f) => {
                    const Icon = featureIcon[f]
                    return (
                      <li key={f} className="flex items-center gap-3 text-[0.95rem]">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${accent === 'sea' ? 'bg-sea-mist text-sea' : 'bg-terra-light text-terra'}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {c.features[f]}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal className="mt-6">
            <div className="rounded-xl3 border border-dashed border-ink/20 p-7">
              <p className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                <Info className="h-4 w-4" /> {ui.goodToKnow}
              </p>
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {(t.goodToKnow as string[]).map((g) => (
                  <li key={g} className="text-[0.95rem] leading-relaxed text-ink-soft">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Photos */}
      <section id="photos" className="bg-sand-paper py-20 md:py-28">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading kicker={ui.gallery} title={prop.name} />
            <p className="text-[0.9rem] text-ink-mute">{tr(ui, 'photoCount', { count: prop.gallery.length })}</p>
          </div>
          <div className="mt-10">
            <Gallery photos={prop.gallery} common={c} locale={locale} />
          </div>
        </div>
      </section>

      {/* Location */}
      <section id="location" className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={ui.location} title={t.aroundTitle} intro={t.aroundIntro ?? d.home.map.intro} />
          <Reveal className="mt-10" y={30}>
            <AreaMap locale={locale} g={d.glance} initialOrigin={p} lockOrigin />
          </Reveal>
          <Reveal className="mt-6" y={20}>
            <SkalaNow locale={locale} g={d.glance} property={p} />
          </Reveal>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="overflow-hidden bg-sand-paper py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={ui.reviews} title={d.home.reviews.title} intro={d.home.reviews.intro} />
        </div>
        <div className="mt-14">
          <ReviewsWall reviews={propReviews} featured={featured} translations={d.reviews} locale={locale} common={c} showProperty={false} />
        </div>
      </section>

      {/* House rules */}
      <section id="rules" className="bg-sand py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={d.glance.kickers.beforeYouArrive} title={ui.policies} />
          <Stagger className="mt-10 grid gap-px overflow-hidden rounded-xl3 bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-3">
            {policyRows.map((r, i) => (
              <StaggerItem key={r.label} className={`flex gap-4 bg-white p-6 ${i === policyRows.length - 1 ? lastRule : ''}`}>
                <r.icon className={`mt-0.5 h-5 w-5 shrink-0 ${accent === 'sea' ? 'text-sea' : 'text-terra'}`} />
                <div>
                  <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{r.label}</p>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed">{r.value}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-5 flex items-center gap-2 text-[0.8rem] text-ink-mute">
            <Clock className="h-3.5 w-3.5" /> {c.footer.licence}: {prop.licence}
          </p>
        </div>
      </section>

      {/* Compare */}
      <section className="bg-sand-paper py-20 md:py-28">
        <div className="container">
          <SectionHeading kicker={ui.compare} title={d.property.compare.title} intro={d.property.compare.intro} />
          {properties.theodora.extras.aerialBoth && (
            <Reveal className="mt-10" y={30}>
              <figure className="relative aspect-[21/9] overflow-hidden rounded-xl3 shadow-soft">
                <Image src={properties.theodora.extras.aerialBoth.src} alt={altFor(properties.theodora.extras.aerialBoth, locale)} fill sizes="(min-width:1360px) 1300px, 100vw" className="object-cover" style={{ objectPosition: '50% 45%' }} />
              </figure>
            </Reveal>
          )}
          <Reveal className="mt-6" y={30}>
            {/* Phones: each row is a small heading with the two answers stacked under it, so nothing is squeezed into a narrow column */}
            <dl className="divide-y divide-line overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 md:hidden">
              {Object.entries(d.property.compare.rows as Record<string, { label: string; aegealis: string; theodora: string }>).map(([k, row]) => (
                <div key={k} className="px-5 py-4">
                  <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-ink-mute">{row.label}</dt>
                  {(['aegealis', 'theodora'] as const).map((pk) => (
                    <dd key={pk} className={`mt-2 rounded-xl px-3 py-2.5 text-[0.92rem] leading-snug ${pk === p ? (pk === 'aegealis' ? 'bg-sea-mist/70' : 'bg-terra-light/50') : 'bg-sand/50'}`}>
                      <span className={`block text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${pk === 'aegealis' ? 'text-sea-deep' : 'text-terra-deep'}`}>{properties[pk].shortName}</span>
                      <span className="mt-0.5 block">{row[pk]}</span>
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
            <div className="hidden overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 md:block">
              <table className="w-full table-fixed text-left text-[0.95rem]">
                <thead>
                  <tr className="border-b border-line">
                    <td className="w-1/3 p-5" />
                    {(['aegealis', 'theodora'] as const).map((k) => (
                      <th key={k} scope="col" className={`p-5 font-display text-xl font-normal leading-tight ${k === p ? (k === 'aegealis' ? 'bg-sea-mist' : 'bg-terra-light/60') : ''}`}>
                        <Link href={href(locale, `/${k}`)} className="hover:underline">
                          {properties[k].shortName}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.property.compare.rows as Record<string, { label: string; aegealis: string; theodora: string }>).map(([k, row]) => (
                    <tr key={k} className="border-b border-line last:border-0">
                      <th scope="row" className="p-5 align-top text-[0.85rem] font-semibold leading-snug text-ink-mute">{row.label}</th>
                      <td className={`p-5 align-top leading-snug ${p === 'aegealis' ? 'bg-sea-mist/60' : ''}`}>{row.aegealis}</td>
                      <td className={`p-5 align-top leading-snug ${p === 'theodora' ? 'bg-terra-light/40' : ''}`}>{row.theodora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal className="mt-6">
            <Link href={href(locale, `/${other}`)} className="group inline-flex items-center gap-2 font-semibold text-ink">
              {tr(ui, 'otherProperty', { name: properties[other].name })}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Cruise band */}
      <section className="relative overflow-hidden bg-ink py-20 text-white">
        {cruiseMedia.hero && (
          <div className="absolute inset-0 opacity-40">
            <Image src={cruiseMedia.hero.src} alt="" fill sizes="100vw" className="object-cover" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="container relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 font-semibold text-sun-light">
              <BadgePercent className="h-5 w-5" /> {d.home.cruises.discount}
            </p>
            <h2 className="mt-3 font-display text-display-md font-light">{d.home.cruises.title}</h2>
          </div>
          <Link href={href(locale, '/cruises')} className="btn btn-light shrink-0">
            {d.home.cruises.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="questions" className="bg-sand-paper py-20 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading kicker={ui.faq} title={d.home.faq.title} />
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <Accordion items={faqItems} />
            <Link href={href(locale, '/faq')} className="btn btn-ghost mt-8">
              {d.home.faq.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-sand py-16">
        <div className="container flex flex-col items-center gap-6 text-center">
          <h2 className="font-display text-display-md font-light">{ui.bookingCardTitle}</h2>
          <div className="w-full max-w-4xl text-left [&_p]:text-ink-mute">
            <BookingBar locale={locale} t={d.home.bookingBar} common={c} defaultProperty={p} />
          </div>
        </div>
      </section>

      <JsonLd data={lodgingLd(locale, p, { common: c, units: d.units, seo: d.pages.seo })} />
      <JsonLd data={breadcrumbLd([{ name: c.nav.home, path: `/${locale}` }, { name: prop.name, path: `/${locale}/${p}` }])} />
    </div>
  )
}
