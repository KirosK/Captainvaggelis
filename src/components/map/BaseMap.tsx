'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// OpenFreeMap "positron" vector style (free, no key, no business/POI labels), recoloured to the site palette.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

type Layer = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }
type Style = { layers: Layer[]; [k: string]: unknown }

let stylePromise: Promise<Style> | null = null

function recolour(style: Style): Style {
  const set = (id: string, prop: string, value: unknown) => {
    const l = style.layers.find((x) => x.id === id)
    if (l) l.paint = { ...(l.paint ?? {}), [prop]: value }
  }
  set('background', 'background-color', '#F4EEE4')
  set('water', 'fill-color', '#CFE3E5')
  set('park', 'fill-color', '#E2E7D2')
  set('landcover_wood', 'fill-color', '#E2E7D2')
  set('landuse_residential', 'fill-color', '#EFE7DA')
  set('building', 'fill-color', '#E5DACA')
  set('building', 'fill-outline-color', '#D9CCB8')
  for (const l of style.layers) {
    if (l.type === 'line' && /^highway_(minor|path)/.test(l.id)) l.paint = { ...(l.paint ?? {}), 'line-color': '#FFFFFF' }
    if (l.type === 'line' && /^highway_major/.test(l.id)) l.paint = { ...(l.paint ?? {}), 'line-color': '#FFFFFF' }
    if (l.type === 'symbol' && l.paint) l.paint = { ...l.paint, 'text-color': '#5B6B73', 'text-halo-color': '#F4EEE4' }
  }
  // keep the map quiet: no road shields
  style.layers = style.layers.filter((l) => !/shield/.test(l.id))
  return style
}

function loadStyle() {
  if (!stylePromise) stylePromise = fetch(STYLE_URL).then((r) => r.json()).then(recolour)
  return stylePromise
}

/** A copy of the style without some layers: the cached style stays whole for the maps that keep everything. */
function slim(style: Style, labels: boolean, roads: boolean): Style {
  if (labels && roads) return style
  const copy: Style = {
    ...style,
    layers: style.layers.filter((l) => (labels || l.type !== 'symbol') && (roads || !/^(highway|road|railway|bridge|tunnel)/.test(l.id))),
  }
  if (!labels) delete copy.sprite // no icons are left to draw, so skip loading the sprite sheet
  return copy
}

/**
 * Adds the recoloured vector base map under the Leaflet markers.
 * `labels={false}` drops the map's own place, water and road names (the cruise route map writes its names in the page language);
 * `roads={false}` drops the road network, for the island-scale route maps where only the coastline matters.
 */
export function BaseMap({ labels = true, roads = true }: { labels?: boolean; roads?: boolean } = {}) {
  const map = useMap()
  useEffect(() => {
    let layer: ReturnType<typeof maplibreGL> | null = null
    let cancelled = false
    loadStyle()
      .then((style) => {
        if (cancelled) return
        layer = maplibreGL({ style: slim(style, labels, roads) as unknown as StyleSpecification })
        layer.addTo(map)
        // MapLibre labels its canvas role="region" aria-label="Map" in English; our map wrapper already carries a localised name
        const canvas = layer.getCanvas()
        canvas.removeAttribute('role')
        canvas.removeAttribute('aria-label')
        canvas.setAttribute('aria-hidden', 'true')
        // the style's own source credits OpenFreeMap, OpenMapTiles and OpenStreetMap; drop the "Leaflet" prefix to keep it to one line
        map.attributionControl?.setPrefix(false)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, labels, roads])
  return null
}
