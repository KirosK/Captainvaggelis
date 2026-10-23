'use client'

// Small client pieces that show a cruise's days, times and prices as edited in /admin
// (demo store in localStorage). Before hydration the store holds the static data, so the
// server HTML and the first client render are identical.

import { CalendarDays, Clock, Euro, Sailboat } from 'lucide-react'
import { cruiseRules, sortWeekdays, type Cruise } from '@/data/cruises'
import { pickupTimes, useStore } from '@/lib/cruiseStore'
import { formatPrice, listFormat, weekdayName, type Locale } from '@/lib/i18n'

/** The fields these components need; pass scheduleOf(cruise) so the photos are not sent to the client. */
export type LiveInput = Pick<Cruise, 'key' | 'weekdays' | 'depart' | 'returnSkala' | 'prices'>

type Live = { weekdays: number[]; depart?: string; returnSkala?: string; adult?: number; child?: number; active: boolean }

/** The cruise's current schedule and prices: admin overrides when present, the static data otherwise. */
export function useLiveCruise(cruise: LiveInput): Live {
  const { store } = useStore()
  const cfg = store.config[cruise.key]
  return {
    weekdays: sortWeekdays(cfg?.weekdays ?? cruise.weekdays),
    depart: cfg?.depart ?? cruise.depart,
    returnSkala: cfg?.returnSkala ?? cruise.returnSkala,
    adult: cfg?.adult ?? cruise.prices?.adult,
    child: cfg?.child ?? cruise.prices?.child,
    active: cfg?.active ?? true,
  }
}

/**
 * Copy that quotes the standard times (such as "Pick-up at 09:20" or "back in Poros at 17:30") with the times set in /admin:
 * each time in the text that matches the cruise's standard departure, Poros pick-up or return is swapped for the live one.
 * `times` are the live boarding and return times at each pick-up point (pickupTimes in src/lib/cruiseStore.ts).
 */
export function useLiveTimes(cruise: LiveInput & Pick<Cruise, 'stops'>) {
  const { store } = useStore()
  const from = pickupTimes(cruise)
  const to = pickupTimes(cruise, store.config[cruise.key])
  const swap: Record<string, string> = {
    [from.skala.depart]: to.skala.depart,
    [from.skala.back]: to.skala.back,
    ...(from.hasPoros ? { [from.poros.depart]: to.poros.depart, [from.poros.back]: to.poros.back } : {}),
  }
  return { times: to, text: (text: string) => text.replace(/\b\d{2}:\d{2}\b/g, (t) => swap[t] ?? t) }
}

/** A sentence with the standard times replaced by the ones set in /admin (see useLiveTimes). */
export function LiveText({ cruise, text }: { cruise: LiveInput & Pick<Cruise, 'stops'>; text: string }) {
  const live = useLiveTimes(cruise)
  return <>{live.text(text)}</>
}

/**
 * Copy that speaks for several cruises at once, such as the timetable intro ("Every scheduled cruise leaves Skala at 09:00…"):
 * each standard time is swapped for the live time most of those cruises now use (they normally all agree).
 */
export function LiveTextMany({ cruises, text }: { cruises: (LiveInput & Pick<Cruise, 'stops'>)[]; text: string }) {
  const { store } = useStore()
  const votes: Record<string, Record<string, number>> = {}
  for (const c of cruises) {
    const from = pickupTimes(c)
    const to = pickupTimes(c, store.config[c.key])
    const pairs: [string, string][] = [
      [from.skala.depart, to.skala.depart],
      [from.skala.back, to.skala.back],
      ...(from.hasPoros ? ([[from.poros.depart, to.poros.depart], [from.poros.back, to.poros.back]] as [string, string][]) : []),
    ]
    for (const [std, live] of pairs) {
      const v = (votes[std] ??= {})
      v[live] = (v[live] ?? 0) + 1
    }
  }
  const swap = Object.fromEntries(Object.entries(votes).map(([std, v]) => [std, Object.entries(v).sort((x, y) => y[1] - x[1])[0][0]]))
  return <>{text.replace(/\b\d{2}:\d{2}\b/g, (t) => swap[t] ?? t)}</>
}

/** "Wednesday and Sunday"; capitalised because it stands alone as a label (Italian weekdays are lowercase otherwise). */
export function daysLabel(locale: Locale, weekdays: number[], fallback = '') {
  if (!weekdays.length) return fallback
  const s = listFormat(locale, weekdays.map((w) => weekdayName(locale, w)))
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

/** "Wednesday and Sunday", or `paused` ("Not sailing at the moment") while the cruise is switched off in /admin. */
export function CruiseDays({ cruise, locale, fallback, paused }: { cruise: LiveInput; locale: Locale; fallback?: string; paused?: string }) {
  const live = useLiveCruise(cruise)
  return <>{!live.active && paused ? paused : daysLabel(locale, live.weekdays, fallback)}</>
}

/** "09:00–17:45" */
export function CruiseTimes({ cruise }: { cruise: LiveInput }) {
  const live = useLiveCruise(cruise)
  return (
    <>
      {live.depart}–{live.returnSkala}
    </>
  )
}

/** "€55" (adult fare) */
export function CruisePrice({ cruise, locale, which = 'adult' }: { cruise: LiveInput; locale: Locale; which?: 'adult' | 'child' }) {
  const live = useLiveCruise(cruise)
  const v = live[which]
  return <>{v != null ? formatPrice(locale, v) : ''}</>
}

/** Fact chips under the cruise title: days, departure, return and both fares, each with a visible label. */
export function CruiseHeroFacts({
  cruise,
  locale,
  labels,
}: {
  cruise: LiveInput
  locale: Locale
  labels: { days: string; depart: string; back: string; price: string; skala: string; adult: string; child: string; paused?: string }
}) {
  const live = useLiveCruise(cruise)
  const [minAge, maxAge] = cruiseRules.childAges
  const facts = [
    { icon: CalendarDays, label: labels.days, value: !live.active && labels.paused ? labels.paused : daysLabel(locale, live.weekdays), hidden: true },
    { icon: Sailboat, label: labels.depart, value: `${live.depart} · ${labels.skala}` },
    { icon: Clock, label: labels.back, value: live.returnSkala ?? '' },
    {
      icon: Euro,
      label: labels.price,
      value: `${formatPrice(locale, live.adult ?? 0)} ${labels.adult} · ${formatPrice(locale, live.child ?? 0)} ${labels.child} (${minAge}–${maxAge})`,
      hidden: true,
    },
  ]
  return (
    <dl className="flex flex-wrap gap-2">
      {facts.map((f) => (
        <div key={f.label} className="flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-2 text-[0.88rem] ring-1 ring-white/25 backdrop-blur">
          <f.icon className="h-4 w-4 shrink-0 text-white/75" aria-hidden="true" />
          <dt className={f.hidden ? 'sr-only' : 'text-white/70'}>{f.label}</dt>
          <dd className="font-medium tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
