'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { Anchor } from 'lucide-react'
import { scheduledCruises, WEEK_ORDER } from '@/data/cruises'
import { useSchedule } from '@/lib/cruiseStore'
import { href, weekdayName, type Dict, type Locale } from '@/lib/i18n'

/**
 * Monday→Sunday strip showing which cruise sails each day (the live schedule saved in /admin, the static one until it loads). Highlights today.
 * One row per day on phones, two columns from 640 px (still in rows), then stacked cards four (768 px) and seven (1024 px) to a row:
 * a row layout in a quarter of a tablet screen leaves too little room for the name and the times.
 */
export function WeekStrip({ locale, cruiseNames, labels, tone = 'dark' }: { locale: Locale; cruiseNames: Dict; labels: { depart: string; return: string }; tone?: 'dark' | 'light' }) {
  const [today, setToday] = useState<number | null>(null)
  const { config } = useSchedule()
  useEffect(() => setToday(new Date().getDay()), [])

  const sailingOn = (wd: number) => {
    for (const c of scheduledCruises) {
      const cfg = config[c.key]
      const days = cfg ? (cfg.active ? cfg.weekdays : []) : c.weekdays
      if (days.includes(wd)) return { cruise: c, depart: cfg?.depart ?? c.depart, back: cfg?.returnSkala ?? c.returnSkala }
    }
    return null
  }

  const light = tone === 'light'
  const mute = light ? 'text-white/60' : 'text-ink-mute'

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      {WEEK_ORDER.map((wd, i) => {
        const s = sailingOn(wd)
        const isToday = today === wd
        const base = light ? 'bg-white/[0.06] text-white' : 'bg-white text-ink'
        // one ring class per card: today's sun ring must not compete with the default ring colour in the CSS order
        const ring = isToday ? 'ring-2 ring-sun' : light ? 'ring-1 ring-white/15' : 'ring-1 ring-ink/5'
        return (
          <m.li
            key={wd}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="h-full"
          >
            {s ? (
              <Link
                href={href(locale, `/cruises/${s.cruise.slug}`)}
                className={`group relative flex h-full flex-row items-center gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 md:flex-col md:items-start md:gap-0 md:pt-5 ${base} ${ring}`}
              >
                {/* route colour, shared with the timeline and the map line on the cruise page */}
                <span className="absolute inset-y-0 left-0 w-1 md:inset-x-0 md:bottom-auto md:h-1 md:w-auto" style={{ background: s.cruise.accent }} aria-hidden="true" />
                <span className={`w-12 shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] md:w-auto ${mute}`}>{weekdayName(locale, wd, 'short')}</span>
                <span className="min-w-0 flex-1 md:mt-3">
                  {/* whole words only (hyphenation split "Ναυά-γιο" and "Γαλά-ζιες"), balanced over the lines; a touch smaller in the seven narrow desktop columns */}
                  <span className="block break-words font-display text-[1.08rem] leading-tight text-balance lg:text-[1rem] xl:text-[1.08rem]">{cruiseNames[s.cruise.key]?.name}</span>
                  <span className={`mt-1 block whitespace-nowrap text-[0.78rem] tabular-nums ${mute}`}>
                    <span className="sr-only">{labels.depart} </span>
                    {s.depart} → <span className="sr-only">{labels.return} </span>
                    {s.back}
                  </span>
                </span>
              </Link>
            ) : (
              <div className={`flex h-full flex-row items-center gap-4 rounded-2xl p-4 md:flex-col md:items-start md:gap-0 md:pt-5 ${base} ${ring} opacity-60`}>
                <span className="w-12 shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] md:w-auto">{weekdayName(locale, wd, 'short')}</span>
                <Anchor className="h-4 w-4 md:mt-3" aria-hidden="true" />
              </div>
            )}
          </m.li>
        )
      })}
    </ol>
  )
}
