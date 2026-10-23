'use client'

import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, ScaleControl, useMap, useMapEvents } from 'react-leaflet'
import { BaseMap } from './BaseMap'
import 'leaflet/dist/leaflet.css'
import type { Poi } from '@/data/pois'
import type { PropertyKey } from '@/data/types'

// Small line icons (lucide paths) inlined into the Leaflet markers.
const ICONS: Record<string, string> = {
  sea: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  anchor: '<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  daily: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  health: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>',
  transport: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  explore: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  village: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  sight: '<path d="M3 22h18"/><path d="M6 18V11"/><path d="M10 18V11"/><path d="M14 18V11"/><path d="M18 18V11"/><path d="m12 2 8 5H4z"/>',
  walk: '<circle cx="13" cy="4" r="1.6"/><path d="m9 20 3-6 3 3v4"/><path d="m6 8 4-2 3 2 2 3 3 1"/><path d="M12 14 10 9"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
}
const svg = (k: string, size = 14, color = 'currentColor') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] ?? ICONS.explore}</svg>`

function iconKey(p: Poi) {
  if (p.category === 'cruise-point') return 'anchor'
  if (p.category === 'beach') return 'sea'
  if (p.category === 'food') return 'food'
  if (p.category === 'shop') return 'daily'
  if (p.category === 'health') return 'health'
  if (p.category === 'transport') return 'transport'
  if (p.category === 'sight') return 'sight'
  if (p.category === 'village') return 'village'
  return 'explore'
}

type Side = 'left' | 'right'
/** Labels never run wider than this, and wrap onto a second line inside it. */
const LABEL_MAX = 170

function poiIcon(p: Poi, label: string, active: boolean, showLabel: boolean, side: Side, maxW = LABEL_MAX) {
  const ring = active ? '#0F2430' : '#ffffff'
  const fg = active ? '#ffffff' : '#0F2430'
  const bg = active ? '#0F2430' : '#ffffff'
  // a pin in the right half of the map names itself to its left, so the name never runs off the edge
  const place = side === 'left' ? 'right:36px;text-align:right' : 'left:36px'
  return L.divIcon({
    className: 'cv-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="position:relative;display:flex;align-items:center">
      <span style="display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:${bg};color:${fg};box-shadow:0 0 0 2px ${ring},0 6px 16px -6px rgba(15,36,48,.45);transition:all .25s">${svg(iconKey(p), 14)}</span>
      ${showLabel || active ? `<span style="position:absolute;${place};width:max-content;max-width:${maxW}px;font:${active ? 700 : 600} 12.5px/1.2 var(--font-sans),system-ui;color:#0F2430;text-shadow:0 0 3px #fff,0 0 6px #fff,0 0 2px #fff">${label}</span>` : ''}
    </div>`,
  })
}

// The diamond sits exactly on the property; its name pill hangs to the side with more room.
// The name is left out when the selected place is right next to the property, so the two never stack.
function propertyIcon(label: string, color: string, origin: boolean, showLabel: boolean, side: Side) {
  const place = side === 'left' ? 'right:14px' : 'left:14px'
  return L.divIcon({
    className: 'cv-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="position:relative;cursor:pointer">
      <span style="position:absolute;left:-8px;top:-8px;width:16px;height:16px;transform:rotate(45deg);background:${origin ? color : '#fff'};border:2px solid ${origin ? '#fff' : color};box-shadow:0 6px 16px -6px rgba(15,36,48,.6)"></span>
      ${showLabel ? `<span style="position:absolute;${place};top:-12.5px;white-space:nowrap;padding:6px 11px;border-radius:999px;background:${origin ? '#0F2430' : 'rgba(255,255,255,.95)'};color:${origin ? '#fff' : '#0F2430'};font:600 12.5px/1 var(--font-sans),system-ui;box-shadow:0 8px 20px -10px rgba(15,36,48,.6)">${label}</span>` : ''}
    </div>`,
  })
}

function pillIcon(text: string, mode: 'walk' | 'drive', below: boolean) {
  return L.divIcon({
    className: 'cv-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,${below ? '24px' : '-50%'});display:inline-flex;align-items:center;gap:5px;white-space:nowrap;padding:5px 10px;border-radius:999px;background:#fff;border:1.5px solid #B88A2E;color:#0F2430;font:700 12px/1 var(--font-sans),system-ui;box-shadow:0 8px 18px -10px rgba(15,36,48,.6)">${svg(mode === 'walk' ? 'walk' : 'car', 13, '#8A6420')}${text}</div>`,
  })
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!points.length) return
    // names sit beside their pins on either side, so leave room for them on both sides
    const w = map.getSize().x
    const pad = Math.min(56, Math.round(w * 0.1))
    const labelRoom = Math.round(Math.min(120, w * 0.18))
    map.flyToBounds(L.latLngBounds(points), { paddingTopLeft: [pad + labelRoom, pad + 8], paddingBottomRight: [pad + labelRoom, pad + 16], maxZoom: 17, duration: 0.7 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function AreaMapInner({
  items,
  origin,
  properties,
  selected,
  onSelect,
  onOrigin,
  names,
  route,
  pillText,
  lockOrigin,
  zoomLabels,
}: {
  items: Poi[]
  origin: PropertyKey
  properties: { key: PropertyKey; name: string; lat: number; lng: number }[]
  selected: string | null
  onSelect: (k: string) => void
  onOrigin: (k: PropertyKey) => void
  names: Record<string, string>
  route?: { mode: 'walk' | 'drive'; path?: [number, number][] }
  pillText: string
  lockOrigin?: boolean
  zoomLabels: { in: string; out: string }
}) {
  const from = properties.find((p) => p.key === origin)!
  const sel = items.find((i) => i.key === selected)
  const path = useMemo<[number, number][]>(() => {
    if (!sel) return []
    return route?.path?.length ? route.path : [[from.lat, from.lng], [sel.lat, sel.lng]]
  }, [sel, route, from])
  // frame the selected route, or the whole category around the property
  const framing = useMemo<[number, number][]>(() => {
    if (path.length) return [...path, [from.lat, from.lng]]
    const near = items.filter((i) => (origin === 'aegealis' ? i.fromAegealis : i.fromTheodora).meters < 4000)
    const set = near.length ? near : items
    return [[from.lat, from.lng], ...set.map((i) => [i.lat, i.lng] as [number, number])]
  }, [path, items, from, origin])

  return (
    <MapContainer center={[from.lat, from.lng]} zoom={16} scrollWheelZoom={false} dragging={!L.Browser.mobile} touchZoom className="h-full w-full" zoomControl={false} attributionControl>
      <BaseMap />
      <ScaleControl position="bottomleft" imperial={false} />
      <ZoomButtons labels={zoomLabels} />
      <Fit points={framing} />
      {path.length > 0 && (
        <>
          <Polyline positions={path} pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
          <Polyline positions={path} pathOptions={{ color: route?.mode === 'drive' ? '#2A3F4B' : '#8A6420', weight: 3.5, opacity: 1, className: 'route-dash', lineCap: 'round', lineJoin: 'round' }} />
        </>
      )}
      <Pins
        items={items}
        origin={origin}
        properties={properties}
        selected={selected}
        onSelect={onSelect}
        onOrigin={onOrigin}
        names={names}
        lockOrigin={lockOrigin}
        route={sel && path.length ? { path, text: pillText, mode: route?.mode ?? 'walk' } : undefined}
      />
    </MapContainer>
  )
}

/** Rough width in px of a label set in 12.5px semibold sans (Greek and Latin are close enough). */
const textWidth = (s: string) => Math.ceil(s.length * 7.1)
/** Rough box of a pin's name, which wraps inside its maximum width. */
const labelSize = (s: string, max: number) => {
  const w = textWidth(s)
  return { w: Math.min(w, max), h: 16 * Math.ceil(w / max) }
}

type Box = [number, number, number, number]
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/**
 * POI and property markers. Pins are always drawn; a pin's name is drawn only where it does not cover
 * another pin, a property or an earlier name at the current zoom. The selected place is always named,
 * then the nearest places get their names first. The walking or driving time sits on the route where it covers
 * no name (middle first); on a very short route it hangs under the selected place.
 */
function Pins({
  items,
  origin,
  properties,
  selected,
  onSelect,
  onOrigin,
  names,
  lockOrigin,
  route,
}: {
  items: Poi[]
  origin: PropertyKey
  properties: { key: PropertyKey; name: string; lat: number; lng: number }[]
  selected: string | null
  onSelect: (k: string) => void
  onOrigin: (k: PropertyKey) => void
  names: Record<string, string>
  lockOrigin?: boolean
  route?: { path: [number, number][]; text: string; mode: 'walk' | 'drive' }
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  // labels flip side with the pin's place on screen, so they are worked out again after every pan and zoom
  const [view, setView] = useState(0)
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setView((v) => v + 1) })

  const meters = (p: Poi) => (origin === 'aegealis' ? p.fromAegealis : p.fromTheodora).meters
  const sel = items.find((i) => i.key === selected)
  // the selected place is right next to the property: drop the property's name pill, keep its diamond
  const hideOriginName = !!sel && meters(sel) < 80

  const { labelled, side, width, pill, propLabel } = useMemo(() => {
    const at = (lat: number, lng: number) => map.project([lat, lng], zoom)
    // which half of the visible map a point is in decides the side its name goes on
    const centre = map.project(map.getCenter(), zoom)
    const centreX = centre.x
    const { x: W, y: H } = map.getSize()
    const edge = { left: centreX - W / 2, top: centre.y - H / 2, right: centreX + W / 2, bottom: centre.y + H / 2 }
    const onScreen = (pt: { x: number; y: number }) => Math.abs(pt.x - centreX) < W / 2 && Math.abs(pt.y - centre.y) < H / 2
    const sideOf = (x: number): Side => (x > centreX ? 'left' : 'right')
    // room for a name on a side, inside the map: a long name wraps rather than running off the edge
    const roomOn = (x: number, s: Side) => {
      const cx = x - centreX + W / 2
      return Math.floor((s === 'left' ? cx : W - cx) - 21 - 8)
    }
    // the map's own controls: the zoom buttons (top right) and the scale and credits along the bottom edge
    const controls: Box[] = [
      [edge.right - 56, edge.top, edge.right, edge.top + 92],
      [edge.left, edge.bottom - 26, edge.right, edge.bottom],
    ]
    const onControl = (b: Box) => controls.some((c) => overlaps(c, b))
    const side: Record<string, Side> = {}
    const width: Record<string, number> = {}
    const propLabel: Record<string, boolean> = {}
    const pins = items.map((p) => {
      const pt = at(p.lat, p.lng)
      return { p, pt, box: [pt.x - 16, pt.y - 16, pt.x + 16, pt.y + 16] as Box }
    })
    const taken: Box[] = properties.map((p) => {
      const pt = at(p.lat, p.lng)
      return [pt.x - 11, pt.y - 11, pt.x + 11, pt.y + 11]
    })
    // a property's name pill goes only where all of it fits inside the map: the side with more room first, the other
    // side if the first would cover a pin, the other name or a map control. Off screen, only the diamond is drawn.
    // Where both sides would cover pins (zoomed out over the village), only the property the distances start from keeps it.
    for (const p of properties) {
      const pt = at(p.lat, p.lng)
      const first = sideOf(pt.x)
      side[p.key] = first
      if (p.key === origin && hideOriginName) continue
      const w = 26 + textWidth(p.name)
      const fits = ([first, first === 'left' ? 'right' : 'left'] as Side[])
        .map((s) => ({ s, box: (s === 'right' ? [pt.x + 12, pt.y - 14, pt.x + 12 + w, pt.y + 14] : [pt.x - 12 - w, pt.y - 14, pt.x - 12, pt.y + 14]) as Box }))
        .filter(({ box }) => box[0] >= edge.left + 4 && box[2] <= edge.right - 4 && box[1] >= edge.top && box[3] <= edge.bottom)
      const use =
        fits.find(({ box }) => !onControl(box) && !taken.some((b) => overlaps(b, box)) && !pins.some((o) => overlaps(o.box, box))) ??
        (p.key === origin ? fits.find(({ box }) => !onControl(box)) : undefined) ??
        null
      if (!use) continue
      side[p.key] = use.s
      propLabel[p.key] = true
      taken.push(use.box)
    }
    const order = [...pins].sort((a, b) => (a.p.key === selected ? -1 : b.p.key === selected ? 1 : meters(a.p) - meters(b.p)))
    const keep = new Set<string>()
    for (const { p, pt } of order) {
      const isSel = p.key === selected
      // a pin off screen gets no name (unless it is the selected place, which is framed)
      if (!onScreen(pt) && !isSel) continue
      // the side with more room first, then the other side if the first would cover a pin, a property, a name or a map
      // control. Other places are named only where the name gets a decent column, never squeezed into a sliver.
      const first = sideOf(pt.x)
      let placed: { s: Side; max: number; label: Box } | null = null
      let clearOfControls: { s: Side; max: number; label: Box } | null = null
      let fallback: { s: Side; max: number; label: Box } | null = null
      for (const s of [first, first === 'left' ? 'right' : 'left'] as Side[]) {
        const max = Math.min(LABEL_MAX, roomOn(pt.x, s))
        if (max < (isSel ? 56 : 96)) continue
        const { w, h } = labelSize(names[p.key] ?? '', max)
        const label: Box = s === 'right' ? [pt.x + 19, pt.y - h / 2 - 1, pt.x + 23 + w, pt.y + h / 2 + 1] : [pt.x - 23 - w, pt.y - h / 2 - 1, pt.x - 19, pt.y + h / 2 + 1]
        fallback ??= { s, max, label }
        if (onControl(label)) continue
        clearOfControls ??= { s, max, label }
        if (!taken.some((b) => overlaps(b, label)) && !pins.some((o) => o.p.key !== p.key && overlaps(o.box, label))) {
          placed = { s, max, label }
          break
        }
      }
      // the selected place is always named: clear of the map controls if it can be, on its roomier side otherwise
      const use = placed ?? (isSel ? clearOfControls ?? fallback ?? { s: first, max: Math.max(56, Math.min(LABEL_MAX, roomOn(pt.x, first))), label: [pt.x, pt.y, pt.x, pt.y] as Box } : null)
      if (!use) continue
      side[p.key] = use.s
      width[p.key] = use.max
      keep.add(p.key)
      taken.push(use.label)
    }
    // the time pill: the first point along the route (middle first) where it covers no name or pin
    let pill: { at: [number, number]; below: boolean } | null = null
    if (route && route.path.length) {
      const path = route.path
      const pw = textWidth(route.text) + 40
      const a = at(...path[0])
      const b = at(...path[path.length - 1])
      for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
        const ll = path[Math.round(f * (path.length - 1))]
        const pt = at(...ll)
        const box: Box = [pt.x - pw / 2, pt.y - 13, pt.x + pw / 2, pt.y + 13]
        if (a.distanceTo(b) >= 90 && !onControl(box) && !taken.some((t) => overlaps(t, box)) && !pins.some((o) => overlaps(o.box, box))) {
          pill = { at: ll, below: false }
          break
        }
      }
      // a very short route, or no clear spot: under the selected place
      if (!pill && sel) pill = { at: [sel.lat, sel.lng], below: true }
    }
    return { labelled: keep, side, width, pill, propLabel }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zoom, view, items, properties, selected, names, origin, hideOriginName, route])

  return (
    <>
      {route && pill && <Marker position={pill.at} icon={pillIcon(route.text, route.mode, pill.below)} interactive={false} zIndexOffset={900} />}
      {items.map((p) => (
        <Marker key={p.key} position={[p.lat, p.lng]} icon={poiIcon(p, names[p.key], selected === p.key, labelled.has(p.key), side[p.key] ?? 'right', width[p.key])} eventHandlers={{ click: () => onSelect(p.key) }} zIndexOffset={selected === p.key ? 800 : 0} title={names[p.key]} keyboard />
      ))}
      {properties.map((p) => (
        <Marker
          key={p.key}
          position={[p.lat, p.lng]}
          icon={propertyIcon(p.name, p.key === 'aegealis' ? '#17677A' : '#A9532F', p.key === origin, !!propLabel[p.key], side[p.key] ?? 'right')}
          zIndexOffset={1000}
          eventHandlers={{ click: () => !lockOrigin && onOrigin(p.key) }}
          title={p.name}
        />
      ))}
    </>
  )
}

function ZoomButtons({ labels }: { labels: { in: string; out: string } }) {
  const map = useMap()
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control flex flex-col overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-ink/10">
        <button type="button" aria-label={labels.in} title={labels.in} onClick={() => map.zoomIn()} className="grid h-9 w-9 place-items-center text-lg text-ink hover:bg-sand">
          +
        </button>
        <span className="h-px bg-line" />
        <button type="button" aria-label={labels.out} title={labels.out} onClick={() => map.zoomOut()} className="grid h-9 w-9 place-items-center text-lg text-ink hover:bg-sand">
          −
        </button>
      </div>
    </div>
  )
}
