'use client'

import { useEffect, useState } from 'react'
import { Check, Clock, Copy, Navigation, Sunset, Thermometer, Waves } from 'lucide-react'
import { properties } from '@/data/properties'
import type { PropertyKey } from '@/data/types'
import { fill, htmlLang, type Dict, type Locale } from '@/lib/i18n'

// Approximate monthly average sea temperature off south-east Kefalonia (°C), January → December.
const SEA = [16, 15, 15, 16, 19, 23, 25, 26, 25, 22, 20, 17]
// Greek month names in the accusative ("τον Οκτώβριο"), which Intl does not provide.
const EL_ACC = ['Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο']

// Fallback instant before the client clock is known: mid-October at noon UTC is the same month in every
// time zone, so the server HTML and the first client render agree (no hydration mismatch).
const FALLBACK = new Date(Date.UTC(2026, 9, 15, 12))

const ADDRESS: Record<PropertyKey, string> = {
  aegealis: 'Aegealis Studios, Skala 280 86, Kefalonia, Greece',
  theodora: 'Theodora Studios & Apartments, Skala 280 86, Kefalonia, Greece',
}

/** "Skala now": local time, live temperature and sunset (Open-Meteo, no key), average sea temperature. */
export function SkalaNow({ locale, g, property = 'aegealis' }: { locale: Locale; g: Dict; property?: PropertyKey }) {
  const t = g.map
  const [now, setNow] = useState<Date | null>(null)
  const [temp, setTemp] = useState<number | null>(null)
  const [sunset, setSunset] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    const ctrl = new AbortController()
    fetch('https://api.open-meteo.com/v1/forecast?latitude=38.0776&longitude=20.7980&current=temperature_2m&daily=sunset&timezone=Europe%2FAthens&forecast_days=1', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        if (typeof j.current?.temperature_2m === 'number') setTemp(Math.round(j.current.temperature_2m))
        const s: string | undefined = j.daily?.sunset?.[0]
        if (s) setSunset(s.slice(11, 16))
      })
      .catch(() => {})
    return () => {
      clearInterval(id)
      ctrl.abort()
    }
  }, [])

  const time = now ? new Intl.DateTimeFormat(htmlLang[locale], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Athens' }).format(now) : '––:––'
  const monthIdx = Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Europe/Athens' }).format(now ?? FALLBACK)) - 1
  const monthName = locale === 'el' ? EL_ACC[monthIdx] : new Intl.DateTimeFormat(htmlLang[locale], { month: 'long', timeZone: 'Europe/Athens' }).format(now ?? FALLBACK)
  const prop = properties[property]
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${prop.geo.lat},${prop.geo.lng}`

  const cells = [
    { icon: Clock, label: t.localTime, value: time },
    { icon: Thermometer, label: t.temperature, value: temp != null ? `${temp} °C` : '–' },
    { icon: Sunset, label: t.sunset, value: sunset ?? '–' },
    { icon: Waves, label: t.sea, value: `≈ ${SEA[monthIdx]} °C` },
  ]

  return (
    <div className="rounded-xl3 bg-ink p-6 text-white shadow-lift md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/60">{t.now}</p>
        <p className="text-[0.82rem] text-white/60">{t.place ?? 'Skala, Kefalonia 280 86'}</p>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/55">
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </dt>
            <dd className="mt-1.5 font-display text-[1.7rem] font-light tabular-nums leading-none">{c.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[0.78rem] text-white/50">{fill(t.seaNote, { temp: SEA[monthIdx], month: monthName })}</p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
        <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-light py-2.5 text-[0.88rem]">
          <Navigation className="h-4 w-4" /> {t.mapsLink}
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(t.copyValue?.[property] ?? ADDRESS[property]).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }}
          className="btn btn-ghost-light py-2.5 text-[0.88rem]"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t.copied : t.copyAddress}
        </button>
        {/* always in the page, so screen readers announce the change when the address has been copied */}
        <span role="status" className="sr-only">
          {copied ? t.copied : ''}
        </span>
      </div>
    </div>
  )
}
