'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { m, useScroll, useTransform } from 'framer-motion'
import { Anchor, Eye, Footprints, Sailboat, Waves } from 'lucide-react'
import type { Cruise, Stop } from '@/data/cruises'
import { useLiveTimes } from './LiveCruise'
import type { Dict } from '@/lib/i18n'

const RouteMapInner = dynamic(() => import('./RouteMapInner'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-sea-mist" /> })

const KIND_ICON: Record<Stop['kind'], typeof Anchor> = { depart: Sailboat, pickup: Anchor, swim: Waves, ashore: Footprints, sight: Eye, return: Sailboat }

/**
 * Stop-by-stop timeline beside a tall route map (sticky while the list scrolls); hovering a stop highlights it on the map.
 * Built to sit in the page's main column, next to the booking card: list and map side by side on tablets and wide
 * screens, stacked in the narrower two-column range (lg).
 */
export function Itinerary({
  cruise,
  stopsText,
  labels,
  placeNames,
  zoomLabels,
}: {
  cruise: Cruise
  stopsText: Dict
  labels: Dict
  placeNames: Record<string, string>
  zoomLabels?: { in: string; out: string }
}) {
  const [active, setActive] = useState<string | null>(null)
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] })
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])
  const live = useLiveTimes(cruise)

  // departure, Poros pick-up and return (times and the sentences that quote them) follow the schedule set in /admin
  const timeOf = (s: Stop) => {
    if (!s.time) return undefined
    if (s.kind === 'depart') return live.times.skala.depart
    if (s.kind === 'pickup' && s.key === 'poros') return live.times.poros.depart
    if (s.kind === 'return') return live.times.skala.back
    return s.time
  }
  const textOf = (s: Stop) => {
    const text = stopsText[s.key] as string | undefined
    return text && (s.kind === 'depart' || s.kind === 'pickup' || s.kind === 'return') ? live.text(text) : text
  }

  let n = 0

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <ol ref={ref} className="relative space-y-1 pl-12">
        <span className="absolute left-[19px] top-3 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden="true" />
        <m.span style={{ scaleY, background: cruise.accent }} className="absolute left-[19px] top-3 h-[calc(100%-1.5rem)] w-px origin-top" aria-hidden="true" />
        {cruise.stops.map((s, i) => {
          const Icon = KIND_ICON[s.kind]
          const number = s.kind === 'return' ? null : ++n
          const time = timeOf(s)
          return (
            <m.li
              key={s.key + i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              className={`relative rounded-2xl p-4 transition-colors ${active === s.key ? 'bg-white shadow-soft' : ''}`}
            >
              <span className="absolute -left-12 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-ink/5">
                <Icon className="h-4 w-4" style={{ color: cruise.accent }} />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {number && <span className="text-[0.72rem] font-semibold tabular-nums text-ink-mute">{String(number).padStart(2, '0')}</span>}
                <span className="font-display text-[1.25rem] leading-tight">{placeNames[s.key]}</span>
                {time && (
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-[0.78rem] font-semibold tabular-nums text-ink-soft">
                    {time}
                    {s.until ? `–${s.until}` : ''}
                  </span>
                )}
                {s.kind === 'pickup' && <span className="rounded-full bg-sun-light px-2.5 py-0.5 text-[0.72rem] font-semibold text-ink-soft">{labels.onRequest}</span>}
                {s.kind === 'swim' && <span className="rounded-full bg-sea-mist px-2.5 py-0.5 text-[0.72rem] font-semibold text-sea-deep">{labels.swimStop}</span>}
                {s.kind === 'ashore' && <span className="rounded-full bg-terra-light px-2.5 py-0.5 text-[0.72rem] font-semibold text-terra-deep">{labels.ashore}</span>}
              </div>
              {textOf(s) && <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-soft">{textOf(s)}</p>}
            </m.li>
          )
        })}
      </ol>
      <div className="md:sticky md:top-[calc(var(--header-h)+var(--banner-h,0px)+1.5rem)] md:self-start lg:static xl:sticky">
        <div
          role="region"
          aria-label={labels.mapLabel}
          className="h-[440px] overflow-hidden rounded-xl3 shadow-lift ring-1 ring-ink/5 md:aspect-[2/3] md:h-auto lg:aspect-square xl:aspect-[2/3]"
        >
          <RouteMapInner path={cruise.path} stops={cruise.stops} names={placeNames} active={active} onActive={setActive} color={cruise.accent} hint={labels.mapHint} zoomLabels={zoomLabels} />
        </div>
      </div>
    </div>
  )
}
