import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgePercent, MapPin } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { WeekStrip } from '@/components/cruises/WeekStrip'
import { CruiseDays, CruisePrice } from '@/components/cruises/LiveCruise'
import { scheduledCruises, scheduleOf } from '@/data/cruises'
import { altFor } from '@/data/alts'
import { href, type Dict, type Locale } from '@/lib/i18n'
import { cruiseMedia } from '@/data/cruiseMedia'

export function CruiseTeaser({ locale, t, cruises, common }: { locale: Locale; t: Dict; cruises: Dict; common: Dict }) {
  const hero = cruiseMedia.hero
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-white md:py-32">
      {hero && (
        <div className="absolute inset-0 opacity-25">
          <Image src={hero.src} alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/80 to-ink" />
        </div>
      )}
      <div className="container relative">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Reveal y={10} blur={false}>
              <p className="kicker kicker-light">{t.kicker}</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.title}</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/75">{t.body}</p>
            </Reveal>
          </div>
          <Reveal delay={0.15} className="lg:col-span-5">
            <div className="space-y-3 rounded-xl3 bg-white/[0.06] p-6 ring-1 ring-white/15 backdrop-blur">
              <p className="flex items-start gap-3 text-[0.98rem]">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sea-light" /> {t.departs}
              </p>
              <p className="flex items-start gap-3 text-[0.98rem] font-semibold text-sun-light">
                <BadgePercent className="mt-0.5 h-5 w-5 shrink-0" /> {t.discount}
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-14">
          <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/50">{t.week}</p>
          <WeekStrip locale={locale} cruiseNames={cruises.list} labels={{ depart: cruises.hub.timetable.depart, return: cruises.hub.timetable.return }} tone="light" />
        </div>

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {scheduledCruises.map((c) => {
            const media = cruiseMedia.groups[c.key]
            return (
              <StaggerItem key={c.key}>
                <Link href={href(locale, `/cruises/${c.slug}`)} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl2">
                    {media?.cover && <Image src={media.cover.src} alt={altFor(media.cover, locale)} fill sizes="(min-width:1024px) 24vw, (min-width:640px) 48vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-swift group-hover:scale-110" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/75">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-white/30" style={{ background: c.accent }} aria-hidden="true" />
                        <CruiseDays cruise={scheduleOf(c)} locale={locale} paused={cruises.detail.paused} />
                      </p>
                      <h3 className="mt-1.5 font-display text-[1.45rem] leading-tight">{cruises.list[c.key].name}</h3>
                      <p className="mt-3 flex items-center justify-between text-[0.9rem] text-white/80">
                        <span>
                          {common.units.from}{' '}
                          <strong className="text-white">
                            <CruisePrice cruise={scheduleOf(c)} locale={locale} />
                          </strong>
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                      </p>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </Stagger>

        <div className="mt-12">
          <Link href={href(locale, '/cruises')} className="btn btn-light">
            {t.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
