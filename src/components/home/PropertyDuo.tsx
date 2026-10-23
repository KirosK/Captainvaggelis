import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BedDouble, Check, Users } from 'lucide-react'
import { IdentityBadge } from '@/components/property/PropertyGlance'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { inventory, properties } from '@/data/properties'
import { ratings } from '@/data/reviews'
import { altFor } from '@/data/alts'
import { formatNumber, href, tr, type Dict, type Locale } from '@/lib/i18n'

export function PropertyDuo({ locale, t, common, g }: { locale: Locale; t: Dict; common: Dict; g: Dict }) {
  return (
    <section className="bg-sand py-24 md:py-32">
      <div className="container">
        <SectionHeading kicker={t.kicker} title={t.title} intro={t.intro} />
        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {(['aegealis', 'theodora'] as const).map((p, i) => {
            const prop = properties[p]
            const img = prop.extras.card ?? prop.hero
            const c = t[p]
            const accent = p === 'aegealis' ? 'text-sea' : 'text-terra'
            const inv = inventory(p)
            return (
              <Reveal key={p} delay={i * 0.12} y={40} className="h-full">
                <Link href={href(locale, `/${p}`)} className={`group flex h-full flex-col overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 transition-shadow duration-500 hover:shadow-lift ${p === 'aegealis' ? 'ring-sea/20' : 'ring-terra/20'}`}>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={img.src}
                      alt={altFor(img, locale)}
                      fill
                      sizes="(min-width:1024px) 48vw, 100vw"
                      className="object-cover transition-transform duration-[1.4s] ease-swift group-hover:scale-[1.06]"
                      style={{ objectPosition: img.focus ?? '50% 50%' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
                    <IdentityBadge p={p} g={g} className="absolute left-5 top-5 shadow-soft" />
                    <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 text-[0.8rem] font-semibold text-white backdrop-blur">
                      <span className={`rounded-md px-1.5 py-0.5 tabular-nums ${p === 'aegealis' ? 'bg-sea' : 'bg-terra'}`}>{formatNumber(locale, ratings[p].score)}</span>
                      {tr(common, 'trust.reviews', { count: ratings[p].count })}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5 min-[400px]:p-7 md:p-9">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-display-sm">{c.title}</h3>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-ink/10 transition-all duration-500 group-hover:rotate-45 group-hover:bg-ink group-hover:text-white">
                        <ArrowUpRight className="h-5 w-5" />
                      </span>
                    </div>
                    <dl className={`mt-5 grid grid-cols-2 divide-x overflow-hidden rounded-2xl text-center ${p === 'aegealis' ? 'divide-sea/15 bg-sea-mist/70' : 'divide-terra/15 bg-terra-light/50'}`}>
                      {[
                        { icon: BedDouble, value: String(inv.total), label: g.roomsBy?.[p] ?? g.rooms },
                        { icon: Users, value: String(inv.maxGuests), label: g.guestsStat ?? g.guests },
                      ].map((x) => (
                        <div key={x.label} className="px-1.5 py-3 min-[400px]:px-2">
                          <dd className={`whitespace-nowrap font-display text-[1.15rem] leading-none tabular-nums min-[400px]:text-[1.35rem] ${accent}`}>{x.value}</dd>
                          <dt className="mt-1.5 flex items-center justify-center gap-1 text-[0.74rem] font-medium leading-tight text-ink-mute">
                            <x.icon className="hidden h-3 w-3 shrink-0 min-[400px]:block" aria-hidden="true" /> {x.label}
                          </dt>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-5 text-[1rem] leading-relaxed text-ink-soft text-pretty">{c.pitch}</p>
                    <ul className="mt-6 grid gap-2.5">
                      {(c.bullets as string[]).map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-[0.95rem]">
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-6">
                      <p className="border-t border-line pt-5 text-[0.88rem] font-medium text-ink-mute">{c.best}</p>
                    </div>
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
