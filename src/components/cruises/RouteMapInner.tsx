'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { BaseMap } from '@/components/map/BaseMap'
import type { Stop } from '@/data/cruises'
import { islandLabels } from '@/data/places'

const KIND_COLOR: Record<Stop['kind'], string> = {
  depart: '#0F2430',
  pickup: '#2A3F4B',
  swim: '#17677A',
  ashore: '#C0603E',
  sight: '#66703F',
  return: '#0F2430',
}

/** Stops closer than this (in metres) share one badge, e.g. Cape Skinari and the Blue Caves → "2·4". */
const MERGE_METRES = 2800
/** which stop gives a shared badge its colour */
const PRIORITY: Stop['kind'][] = ['ashore', 'swim', 'pickup', 'depart', 'sight', 'return']

type Group = { stops: Stop[]; numbers: number[]; geo: [number, number] }

function groupStops(stops: Stop[]): Group[] {
  // the return stop sits on top of the departure, so only number distinct places
  const shown = stops.filter((s) => s.kind !== 'return')
  const groups: Group[] = []
  shown.forEach((s, i) => {
    const near = groups.find((g) => L.latLng(g.geo).distanceTo(L.latLng(s.geo)) < MERGE_METRES)
    if (near) {
      near.stops.push(s)
      near.numbers.push(i + 1)
    } else groups.push({ stops: [s], numbers: [i + 1], geo: s.geo })
  })
  return groups
}

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)

/** Numbered stop badge; `name` (the stop names) is read out with the map, the itinerary list below gives the details. */
function badge(label: string, name: string, kind: Stop['kind'], active: boolean) {
  const c = KIND_COLOR[kind]
  const h = active ? 30 : 24
  const w = Math.max(h, 10 + label.length * 7)
  return L.divIcon({
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
    html: `<span style="display:grid;place-items:center;width:${w}px;height:${h}px;border-radius:999px;background:${c};color:#fff;font:700 11px/1 var(--font-sans),system-ui;letter-spacing:.02em;box-shadow:0 0 0 3px #fff,0 8px 18px -6px rgba(15,36,48,.5);transition:all .25s"><span aria-hidden="true">${label}</span><span class="sr-only">${escape(name)}</span></span>`,
  })
}

function islandIcon(name: string) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<span style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font:600 10.5px/1 var(--font-sans),system-ui;letter-spacing:.22em;text-transform:uppercase;color:rgba(15,36,48,.55);text-shadow:0 0 6px #fff,0 0 2px #fff">${name}</span>`,
  })
}

function Fit({ path }: { path: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!path.length) return
    const fit = () => map.fitBounds(L.latLngBounds(path), { paddingTopLeft: [28, 28], paddingBottomRight: [28, 44] }) // room for the attribution
    fit()
    // the map lives in a column whose size changes with the layout; refit when it does
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      fit()
    })
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map, path])
  return null
}

/** Island names, drawn only when they sit fully inside the view (a name cut by the map edge looks broken). */
function IslandLabels({ names }: { names: Record<string, string> }) {
  const map = useMap()
  const [shown, setShown] = useState<string[]>([])
  useEffect(() => {
    const update = () => {
      const size = map.getSize()
      setShown(
        islandLabels
          .filter((l) => {
            const p = map.latLngToContainerPoint(l.geo)
            const half = (names[l.key] ?? l.key).length * 5 + 8
            return p.x > half && p.x < size.x - half && p.y > 16 && p.y < size.y - 40
          })
          .map((l) => l.key),
      )
    }
    update()
    map.on('moveend zoomend resize', update)
    return () => {
      map.off('moveend zoomend resize', update)
    }
  }, [map, names])
  return (
    <>
      {islandLabels
        .filter((l) => shown.includes(l.key))
        .map((l) => (
          <Marker key={l.key} position={l.geo} icon={islandIcon(names[l.key] ?? l.key)} interactive={false} keyboard={false} />
        ))}
    </>
  )
}

export default function RouteMapInner({
  path,
  stops,
  names,
  active,
  onActive,
  color,
  hint,
  zoomLabels,
}: {
  path: [number, number][]
  stops: Stop[]
  names: Record<string, string>
  active: string | null
  onActive: (k: string | null) => void
  color: string
  /** shown once on touch screens when someone drags the map with one finger */
  hint?: string
  /** accessible names of the zoom buttons in the page language (Leaflet's own are English) */
  zoomLabels?: { in: string; out: string }
}) {
  const groups = useMemo(() => groupStops(stops), [stops])
  // on phones one finger scrolls the page and two fingers move and zoom the map
  const mobile = L.Browser.mobile
  const [showHint, setShowHint] = useState(false)
  const hinted = useRef(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onTouchMove = (e: React.TouchEvent) => {
    if (!mobile || !hint || hinted.current || e.touches.length !== 1) return
    hinted.current = true
    setShowHint(true)
    timer.current = window.setTimeout(() => setShowHint(false), 1800)
  }

  return (
    // the attribution keeps clear of the card's rounded bottom corners (it wraps to two lines on phones)
    <div className="relative isolate h-full w-full [&_.leaflet-control-attribution]:px-4 [&_.leaflet-control-attribution]:pb-0.5" onTouchMove={onTouchMove}>
      <MapContainer center={path[0]} zoom={10} maxZoom={12} minZoom={8} zoomSnap={0.25} scrollWheelZoom={false} dragging={!mobile} tap={false} touchZoom zoomControl={false} className="h-full w-full" style={{ background: '#CFE3E5' }} attributionControl>
        <ZoomControl position="topleft" zoomInTitle={zoomLabels?.in} zoomOutTitle={zoomLabels?.out} />
        {/* the site's vector base (sea colour while it loads) without its own names, so the island and stop labels below follow the page language */}
        <BaseMap labels={false} roads={false} />
        <Fit path={path} />
        <IslandLabels names={names} />
        <Polyline positions={path} pathOptions={{ color, weight: 3, opacity: 0.9, className: 'route-dash', lineCap: 'round' }} />
        {groups.map((g) => {
          const isActive = g.stops.some((s) => s.key === active)
          const first = [...g.stops].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0]
          const label = g.stops.map((s) => names[s.key]).join(' · ')
          return (
            <Marker
              key={first.key + g.numbers.join('-')}
              position={g.geo}
              icon={badge(g.numbers.join('·'), label, first.kind, isActive)}
              zIndexOffset={isActive ? 1000 : 0}
              // hover only: the stop names are in the itinerary list, so the badges stay out of the Tab order
              keyboard={false}
              eventHandlers={{ mouseover: () => onActive(first.key), mouseout: () => onActive(null) }}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                {label}
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>
      {hint && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-ink/45 p-6 text-center text-[0.95rem] font-semibold text-white transition-opacity duration-300 ${showHint ? 'opacity-100' : 'opacity-0'}`}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
