import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BadgePercent } from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { altFor } from '@/data/alts'
import { properties } from '@/data/properties'
import { ratings } from '@/data/reviews'
import { formatNumber, href, tr, type Dict, type Locale } from '@/lib/i18n'

/**
 * "Stay in Skala, sail for 20% less": links every cruise page to the two places to stay,
 * so cruise visitors (and search engines) find the rooms. Reuses the home page's property copy.
 */
export function StayBand({ locale, t, props, common, tone = 'sand' }: { locale: Locale; t: Dict; props: Dict; common: Dict; tone?: 'sand' | 'paper' }) {
  return (
    <section className={`${tone === 'sand' ? 'bg-sand' : 'bg-sand-paper'} py-20 md:py-24`}>
      <div className="container grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <SectionHeading kicker={t.kicker} title={t.title} />
          <Reveal delay={0.1}>
            <p className="mt-5 flex max-w-md items-start gap-3 text-[1.02rem] leading-relaxed text-ink-soft">
              <BadgePercent className="mt-1 h-5 w-5 shrink-0 text-sea" aria-hidden="true" />
              {t.body}
            </p>
          </Reveal>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
          {(['aegealis', 'theodora'] as const).map((p, i) => {
            const prop = properties[p]
            const img = prop.extras.card ?? prop.hero
            const c = props[p]
            const tint = p === 'aegealis' ? 'bg-sea' : 'bg-terra'
            return (
              <Reveal key={p} delay={0.08 * i} y={30} className="h-full">
                <Link
                  href={href(locale, `/${p}`)}
                  className="group flex h-full flex-col overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-ink/5 transition-shadow duration-500 hover:shadow-lift"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={img.src}
                      alt={altFor(img, locale)}
                      fill
                      sizes="(min-width:1024px) 28vw, (min-width:640px) 46vw, 100vw"
                      className="object-cover transition-transform duration-[1.4s] ease-swift group-hover:scale-[1.05]"
                      style={{ objectPosition: img.focus ?? '50% 50%' }}
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[0.75rem] font-semibold text-ink backdrop-blur">{c.tag}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-[1.4rem] leading-tight">{prop.name}</h3>
                      <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                    <p className="mt-3 line-clamp-3 text-[0.93rem] leading-relaxed text-ink-soft">{c.pitch}</p>
                    <p className="mt-auto flex items-center gap-2 pt-5 text-[0.82rem] text-ink-mute">
                      <span className={`rounded-md px-1.5 py-0.5 font-semibold tabular-nums text-white ${tint}`}>{formatNumber(locale, ratings[p].score)}</span>
                      {tr(common, 'trust.reviews', { count: ratings[p].count })}
                    </p>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
