'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Anchor, ArrowUpRight, Car, Cross, Footprints, Landmark, MapPin, Megaphone, ShoppingBasket, UtensilsCrossed, Bus, Waves, type LucideIcon } from 'lucide-react'
import { bestLeg, mapTabs, poiName, pois, tabOf, type MapTab, type Poi } from '@/data/pois'
import { properties } from '@/data/properties'
import type { PropertyKey } from '@/data/types'
import { fill, formatDistance, type Dict, type Locale } from '@/lib/i18n'

const AreaMapInner = dynamic(() => import('./AreaMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sea-mist" />,
})

const TAB_ICON: Record<MapTab, LucideIcon> = { sea: Waves, food: UtensilsCrossed, daily: ShoppingBasket, transport: Bus, explore: Landmark }

function rowIcon(p: Poi): LucideIcon {
  if (p.category === 'cruise-point') return Anchor
  if (p.category === 'beach') return Waves
  if (p.category === 'food') return UtensilsCrossed
  if (p.category === 'health') return Cross
  if (p.category === 'shop') return ShoppingBasket
  if (p.category === 'transport') return Bus
  if (p.category === 'sight') return Landmark
  if (p.category === 'village') return MapPin
  return Megaphone
}

/** Interactive neighbourhood map: tabs by need, tap a place to see the real walking route and time. */
export function AreaMap({ locale, g, initialOrigin = 'aegealis', lockOrigin, initialTab = 'sea' }: { locale: Locale; g: Dict; initialOrigin?: PropertyKey; lockOrigin?: boolean; initialTab?: MapTab }) {
  const t = g.map
  const [origin, setOrigin] = useState<PropertyKey>(initialOrigin)
  const [tab, setTab] = useState<MapTab>(initialTab)
  const names = useMemo(() => Object.fromEntries(pois.map((p) => [p.key, poiName(p, locale)])), [locale])

  // places within walking distance come first (nearest first), then the drives, so a tab never opens on a drive
  const items = useMemo(
    () =>
      pois
        .filter((p) => tabOf(p) === tab)
        .sort((a, b) => {
          const la = bestLeg(a, origin)
          const lb = bestLeg(b, origin)
          return (la.mode === 'walk' ? 0 : 1) - (lb.mode === 'walk' ? 0 : 1) || la.min - lb.min || la.m - lb.m
        }),
    [tab, origin],
  )
  const [selected, setSelected] = useState<string | null>(null)
  // mount Leaflet only when the map is about to scroll into view
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [touch, setTouch] = useState(false)
  // on touch screens one finger scrolls the page: the two-finger hint shows briefly after a one-finger drag on the map
  const [showHint, setShowHint] = useState(false)
  const hinted = useRef(false)
  const hintTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(hintTimer.current), [])
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch || hinted.current || e.touches.length !== 1) return
    hinted.current = true
    setShowHint(true)
    hintTimer.current = window.setTimeout(() => setShowHint(false), 2000)
  }
  // keep the active category chip in view inside its scrolling strip (without scrolling the page)
  const strip = useRef<HTMLDivElement>(null)
  const stripReady = useRef(false)
  useEffect(() => {
    const el = strip.current
    const chip = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !chip) return
    const sr = el.getBoundingClientRect()
    const cr = chip.getBoundingClientRect()
    const left = Math.max(0, el.scrollLeft + cr.left - sr.left - (sr.width - cr.width) / 2)
    // straight there on load, smoothly when the visitor changes category
    el.scrollTo({ left, behavior: stripReady.current ? 'smooth' : 'auto' })
    stripReady.current = true
  }, [tab])
  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches)
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // select the nearest place of the tab, so the route is visible straight away
  useEffect(() => {
    setSelected(items[0]?.key ?? null)
  }, [items])

  const sel = items.find((i) => i.key === selected)
  const leg = sel ? bestLeg(sel, origin) : null
  const timeText = (mode: 'walk' | 'drive', min: number) => (mode === 'walk' ? (min === 1 ? t.walkOne : fill(t.walk, { count: min })) : min === 1 ? t.driveOne : fill(t.drive, { count: min }))
  // "1 λεπτό", not "1 λεπτά": the singular comes from walkShortOne when the dictionary has it
  const shortTime = (min: number) => (min === 1 ? t.walkShortOne ?? (locale === 'el' ? '1 λεπτό' : fill(t.walkShort, { count: 1 })) : fill(t.walkShort, { count: min }))
  const walking = items.filter((p) => bestLeg(p, origin).mode === 'walk')
  const driving = items.filter((p) => bestLeg(p, origin).mode === 'drive')
  const from = properties[origin]
  const directions = sel
    ? `https://www.google.com/maps/dir/?api=1&origin=${from.geo.lat},${from.geo.lng}&destination=${sel.lat},${sel.lng}&travelmode=${leg?.mode === 'drive' ? 'driving' : 'walking'}`
    : `https://www.google.com/maps/search/?api=1&query=${from.geo.lat},${from.geo.lng}`
  const propList = (['aegealis', 'theodora'] as const).map((k) => ({ key: k, name: properties[k].shortName, lat: properties[k].geo.lat, lng: properties[k].geo.lng }))

  const Row = ({ p }: { p: Poi }) => {
    const l = bestLeg(p, origin)
    const Icon = rowIcon(p)
    const active = p.key === selected
    return (
      <li>
        <button
          type="button"
          onClick={() => setSelected(p.key)}
          aria-pressed={active}
          className={`flex w-full items-center gap-3 border-b border-line py-3 text-left transition-colors ${active ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 transition-colors ${active ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10'}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className={`min-w-0 flex-1 line-clamp-3 text-[0.95rem] leading-snug ${active ? 'font-semibold' : 'font-medium'}`}>{names[p.key]}</span>
          <span className="shrink-0 text-[0.88rem] tabular-nums text-ink-mute">{shortTime(l.min)}</span>
        </button>
      </li>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div ref={strip} className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t.categories ?? t.tabs.sea}>
          {mapTabs.map((k) => {
            const Icon = TAB_ICON[k]
            return (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[0.9rem] font-medium transition-colors ${tab === k ? 'text-white' : 'bg-white text-ink ring-1 ring-ink/10 hover:bg-sand'}`}
              >
                {tab === k && <m.span layoutId={`map-tab-${lockOrigin ? origin : 'all'}`} className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <Icon className="relative h-4 w-4" aria-hidden="true" />
                <span className="relative">{t.tabs[k]}</span>
              </button>
            )
          })}
        </div>
        {!lockOrigin && (
          <div className="flex items-center gap-2 text-[0.82rem] text-ink-mute">
            <span className="hidden sm:inline" aria-hidden="true">{t.from}</span>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-ink/10" role="group" aria-label={t.from}>
              {(['aegealis', 'theodora'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setOrigin(k)} className="relative rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold" aria-pressed={origin === k}>
                  {origin === k && <m.span layoutId="map-origin" className={`absolute inset-0 rounded-full ${k === 'aegealis' ? 'bg-sea' : 'bg-terra'}`} />}
                  <span className={`relative ${origin === k ? 'text-white' : 'text-ink'}`}>{properties[k].shortName}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={box} onTouchMove={onTouchMove} className="relative isolate z-0 aspect-[4/5] overflow-hidden rounded-xl3 bg-sea-mist shadow-soft ring-1 ring-ink/5 [&_.leaflet-control-attribution]:px-4 sm:aspect-[4/3] lg:aspect-auto lg:min-h-[560px]">
          {touch && (
            <p
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 top-3 z-[500] w-max max-w-[calc(100%-6.5rem)] -translate-x-1/2 rounded-2xl bg-ink/75 px-3 py-1.5 text-center text-[0.75rem] font-medium leading-snug text-white backdrop-blur transition-opacity duration-300 ${showHint ? 'opacity-100' : 'opacity-0'}`}
            >
              {t.twoFingers}
            </p>
          )}
          {near && (
          <AreaMapInner
            items={items}
            origin={origin}
            properties={propList}
            selected={selected}
            onSelect={setSelected}
            onOrigin={setOrigin}
            names={names}
            route={leg ? { mode: leg.mode, path: leg.path } : undefined}
            pillText={leg ? shortTime(leg.min) : ''}
            lockOrigin={lockOrigin}
            zoomLabels={{ in: t.zoomIn, out: t.zoomOut }}
          />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <AnimatePresence mode="wait">
            {sel && leg && (
              <m.div key={`${origin}-${sel.key}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-[1.45rem] leading-tight text-balance">{names[sel.key]}</p>
                    <p className="mt-2 flex items-center gap-2 text-[0.95rem] text-ink-soft">
                      {leg.mode === 'walk' ? <Footprints className="h-4 w-4 text-[#8A6420]" /> : <Car className="h-4 w-4 text-ink-mute" />}
                      <span>
                        <strong className="font-semibold text-ink">{timeText(leg.mode, leg.min)}</strong> <span className="whitespace-nowrap">· {formatDistance(locale, leg.m)}</span>
                      </span>
                    </p>
                    <p className="mt-1 text-[0.8rem] text-ink-mute">{t.fromNamed?.[origin] ?? `${t.from} ${properties[origin].shortName}`}</p>
                  </div>
                  <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[0.9rem] font-semibold text-sea hover:underline">
                    {t.directions} <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          <div className="rounded-xl3 bg-white px-6 pb-3 pt-5 shadow-soft ring-1 ring-ink/5 lg:max-h-[440px] lg:overflow-y-auto">
            {walking.length > 0 && (
              <>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.byFoot}</p>
                <ul className="mt-1">
                  {walking.map((p) => (
                    <Row key={p.key} p={p} />
                  ))}
                </ul>
              </>
            )}
            {driving.length > 0 && (
              <>
                <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute ${walking.length ? 'mt-5' : ''}`}>{t.byCar}</p>
                <ul className="mt-1">
                  {driving.map((p) => (
                    <Row key={p.key} p={p} />
                  ))}
                </ul>
              </>
            )}
            <p className="py-3 text-[0.78rem] text-ink-mute">{t.hint}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
