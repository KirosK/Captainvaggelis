'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowRight, Heart, MessageCircle, Plus, RotateCcw, Sparkles, User, Users, UsersRound } from 'lucide-react'
import { partyFor, suggestRooms, type Priority } from '@/lib/roomFinder'
import { altFor } from '@/data/alts'
import { properties, unitByKey } from '@/data/properties'
import { whatsappLink } from '@/data/site'
import type { Audience, UnitGroup } from '@/data/types'
import enBooking from '@/content/en/booking.json'
import elBooking from '@/content/el/booking.json'
import itBooking from '@/content/it/booking.json'
import { fill, href, tr, type Dict, type Locale } from '@/lib/i18n'
import { Reveal } from '@/components/ui/Reveal'

const whoIcons: Record<Audience, typeof Heart> = { couple: Heart, family: UsersRound, friends: Users, solo: User }
/** Group strings (6+ guests) live in booking.json → "group", shared with the booking page. */
const GROUP: Record<Locale, Dict> = { en: enBooking.group, el: elBooking.group, it: itBooking.group }
/** For six or more: Theodora's two-bedroom apartment plus a studio next to it. */
const COMBO = ['th-two-bedroom', 'th-studio'].map((k) => unitByKey(k)).filter(Boolean) as UnitGroup[]

export function RoomFinder({ locale, t, common, units }: { locale: Locale; t: Dict; common: Dict; units: Dict }) {
  const [who, setWho] = useState<Audience>('couple')
  const [priority, setPriority] = useState<Priority>('beach')
  const [guests, setGuests] = useState(2)

  const pickWho = (w: Audience) => {
    setWho(w)
    setGuests(w === 'solo' ? 1 : w === 'couple' ? 2 : w === 'family' ? 4 : 3)
  }

  const results = useMemo(() => suggestRooms(who, priority, guests), [who, priority, guests])
  const top = results[0]
  const alts = results.slice(1, 3)
  const party = partyFor(who, guests)
  const bookHref = top ? `${href(locale, '/book')}?property=${top.unit.property}&unit=${top.unit.key}&adults=${party.adults}${party.children ? `&children=${party.children}` : ''}` : ''
  const group = GROUP[locale]

  const option = (active: boolean) =>
    `relative flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[0.92rem] font-medium transition-colors duration-300 ${active ? 'text-white' : 'text-ink hover:bg-ink/5 ring-1 ring-inset ring-ink/10'}`

  return (
    <section id="finder" className="relative bg-sand-paper py-24 md:py-32">
      <div className="container grid gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <Reveal y={10} blur={false}>
            <p className="kicker">{t.kicker}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.title}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-ink-soft">{t.intro}</p>
          </Reveal>

          <div className="mt-10 space-y-8">
            <fieldset className="min-w-0">
              <legend className="label text-[0.78rem] uppercase tracking-[0.14em] text-ink-mute">1 · {t.q1.label}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['couple', 'family', 'friends', 'solo'] as Audience[]).map((w) => {
                  const Icon = whoIcons[w]
                  return (
                    <button key={w} type="button" className={option(who === w)} onClick={() => pickWho(w)} aria-pressed={who === w}>
                      {who === w && <m.span layoutId="finder-who" className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                      <Icon className="relative h-4 w-4" />
                      <span className="relative">{t.q1.options[w]}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="label text-[0.78rem] uppercase tracking-[0.14em] text-ink-mute">2 · {t.q2.label}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['beach', 'view', 'quiet', 'space', 'value'] as Priority[]).map((p) => (
                  <button key={p} type="button" className={option(priority === p)} onClick={() => setPriority(p)} aria-pressed={priority === p}>
                    {priority === p && <m.span layoutId="finder-priority" className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                    <span className="relative">{t.q2.options[p]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="label text-[0.78rem] uppercase tracking-[0.14em] text-ink-mute">3 · {t.q3.label}</legend>
              <div className="mt-3 flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGuests(n)}
                    aria-pressed={guests === n}
                    className={`grid h-11 w-11 place-items-center rounded-full text-[0.95rem] font-semibold tabular-nums transition-colors ${guests === n ? 'bg-ink text-white' : 'ring-1 ring-inset ring-ink/10 hover:bg-ink/5'}`}
                  >
                    {n === 6 ? '6+' : n}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[0.82rem] text-ink-mute">{t.q3.hint}</p>
            </fieldset>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7 lg:min-h-[720px]" aria-live="polite">
          <AnimatePresence mode="wait">
            {top ? (
              <m.div
                key={top.unit.key}
                initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
                transition={{ duration: 0.55 }}
              >
                <article className="overflow-hidden rounded-xl3 bg-white shadow-lift ring-1 ring-ink/5">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={(top.unit.photos[0] ?? properties[top.unit.property].hero).src}
                      alt={altFor(top.unit.photos[0] ?? properties[top.unit.property].hero, locale)}
                      fill
                      sizes="(min-width:1024px) 55vw, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-transparent" />
                    <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[0.78rem] font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-sun" /> {t.resultTitle}
                    </span>
                    <div className="absolute bottom-5 left-6 right-6 text-white">
                      <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white/80">{properties[top.unit.property].name}</p>
                      <h3 className="mt-1 font-display text-display-sm">{units[top.unit.key].name}</h3>
                    </div>
                  </div>
                  <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
                    <div>
                      <p className="text-[0.98rem] leading-relaxed text-ink-soft">{units[top.unit.key].short}</p>
                      <p className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.why}</p>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {top.reasons.map((r, i) => (
                          <m.li
                            key={r}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + i * 0.07 }}
                            className="rounded-full bg-sea-mist px-3 py-1.5 text-[0.85rem] font-medium text-sea-deep"
                          >
                            {t.reasons[r]}
                          </m.li>
                        ))}
                      </ul>
                    </div>
                    {/* prices are live in the family's booking engine: where a price would sit, a way to see them for your dates */}
                    <div className="md:text-right">
                      <Link href={bookHref} className="text-[0.92rem] font-semibold underline decoration-sea decoration-1 underline-offset-4 hover:decoration-2">
                        {t.seePrices}
                      </Link>
                      <div>
                        <Link href={bookHref} className="btn btn-primary mt-4">
                          {common.cta.chooseThis} <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
                {alts.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.alsoGood}</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {alts.map((a) => (
                        <Link
                          key={a.unit.key}
                          href={`${href(locale, `/${a.unit.property}`)}#${a.unit.key}`}
                          className="group flex min-w-0 items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-ink/5 transition hover:shadow-soft"
                        >
                          <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                            <Image src={(a.unit.photos[0] ?? properties[a.unit.property].hero).src} alt="" fill sizes="80px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-semibold leading-snug">{units[a.unit.key].name}</span>
                            <span className="block text-[0.82rem] text-ink-mute">
                              {properties[a.unit.property].shortName} · {tr(common, 'units.upTo', { count: a.unit.maxGuests })}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </m.div>
            ) : (
              <m.div key="none" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45 }} className="rounded-xl3 bg-white p-6 shadow-lift ring-1 ring-ink/5 md:p-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-light px-3.5 py-1.5 text-[0.78rem] font-semibold text-ink">
                  <Users className="h-3.5 w-3.5" /> {group.combo}
                </span>
                <p className="mt-4 max-w-xl font-display text-[1.45rem] leading-snug text-balance">{tr(t, 'noMatch', { count: guests === 6 ? '6+' : guests })}</p>
                <div className="mt-6 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  {COMBO.map((u, i) => (
                    <div key={u.key} className="contents">
                      {i > 0 && (
                        <span className="grid place-items-center text-ink-mute" aria-hidden="true">
                          <Plus className="h-5 w-5" />
                        </span>
                      )}
                      <Link href={`${href(locale, `/${u.property}`)}#${u.key}`} className="group flex min-w-0 items-center gap-4 rounded-2xl bg-sand-paper p-3 ring-1 ring-ink/5 transition hover:shadow-soft">
                        <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                          <Image src={(u.photos[0] ?? properties[u.property].hero).src} alt="" fill sizes="80px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 font-semibold leading-snug">{units[u.key].name}</span>
                          <span className="block text-[0.82rem] text-ink-mute">
                            {properties[u.property].shortName} · {tr(common, 'units.upTo', { count: u.maxGuests })}
                          </span>
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  {/* the booking page splits a party this size over two rooms in the live search */}
                  <Link href={`${href(locale, '/book')}?property=theodora&adults=${party.adults}${party.children ? `&children=${party.children}` : ''}`} className="btn btn-primary px-5 text-center text-[0.9rem] leading-snug text-balance">
                    {t.twoRooms} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {/* one line from 640px; on a phone the long Greek and Italian labels wrap evenly instead of overflowing */}
                  <a href={whatsappLink(group.messageMany)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost bg-white px-5 text-center text-[0.9rem] leading-snug text-balance sm:whitespace-nowrap">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> {fill(group.whatsapp, { count: '6+' })}
                    <span className="sr-only"> {common.a11y.external}</span>
                  </a>
                  <button type="button" onClick={() => pickWho('couple')} className="btn btn-ghost">
                    <RotateCcw className="h-4 w-4" /> {t.reset}
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
