'use client'

import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, BedDouble, Lock } from 'lucide-react'
import { DateRangeCalendar, type Range } from '@/components/ui/DateRange'
import { Stepper } from '@/components/ui/Popover'
import { properties, unitByKey } from '@/data/properties'
import { addDays, firstBookableDay, fromISO, MIN_NIGHTS, nightsBetween, ROOMS_LAST_CHECKOUT, SEASON_START, startOfToday, toISO, validStay } from '@/lib/dates'
import { countLabel, fill, formatDate, htmlLang, quote, tr, type Dict, type Locale } from '@/lib/i18n'
import { maxChildrenFor, PARTY_MAX_GUESTS, splitParty, vikbookingUrl, VIK_ROOM_NAMES, type VikProperty } from '@/lib/vikbooking'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))
/** No day is marked as today until the page runs in the browser (see `first` below). */
const NOT_YET = new Date(1970, 0, 1)

/**
 * Dates from the URL (booking bar, room cards, language switch): a check-in before `first`, or too late for the minimum
 * stay before the last check-out VikBooking accepts, is dropped; a check-out is kept only when the whole stay is valid.
 */
function initialRange(fromS: string | null | undefined, toS: string | null | undefined, first: Date): Range | undefined {
  const from = fromISO(fromS)
  const to = fromISO(toS)
  if (!from || from < first || from > addDays(ROOMS_LAST_CHECKOUT, -MIN_NIGHTS)) return undefined
  return { from, to: validStay(from, to, MIN_NIGHTS, first) ? to : undefined }
}

/**
 * The booking page: one step. The guest picks the property, the dates and the party here, sees a short summary and
 * continues to the family's booking engine (VikBooking on cptvangelis-apartments.com), which shows the live prices and
 * availability and takes the deposit. Every room link on the site lands here prefilled through the query string:
 * ?property=, from, to (YYYY-MM-DD), adults, children and unit (a room type key, shown as "You chose").
 */
export function BookingFlow({ locale, t, common, units, bothLabel }: { locale: Locale; t: Dict; common: Dict; units: Dict; bothLabel: string }) {
  const sp = useSearchParams()
  const q = (k: string) => sp?.get(k) ?? undefined
  // the room type chosen on a room card or in the room finder, kept for the whole visit (see `unit` below)
  const [chosen] = useState(() => (q('unit') ? unitByKey(q('unit')!) : undefined))
  const qProperty = q('property')
  const [property, setProperty] = useState<VikProperty>(() => chosen?.property ?? (qProperty === 'aegealis' || qProperty === 'theodora' ? qProperty : 'both'))
  // "Today" can differ between the server and the visitor's device, so the first render (server and hydration) starts
  // from the first day of the season; the real first bookable day is set once the page runs in the browser.
  const [first, setFirst] = useState(SEASON_START)
  const [today, setToday] = useState(NOT_YET)
  const [range, setRange] = useState<Range | undefined>(() => initialRange(q('from'), q('to'), SEASON_START))
  const [adults, setAdults] = useState(() => clamp(Number(q('adults')) || 2, 1, PARTY_MAX_GUESTS))
  // each VikBooking room needs an adult and takes up to 4 children (maxChildrenFor), so the URL's children are capped too
  const [children, setChildren] = useState(() => clamp(Number(q('children')) || 0, 0, maxChildrenFor(clamp(Number(q('adults')) || 2, 1, PARTY_MAX_GUESTS))))
  // set when Continue is pressed before the dates are complete, so the reason is shown
  const [tried, setTried] = useState(false)

  useEffect(() => {
    setToday(startOfToday())
    const f = firstBookableDay()
    if (f.getTime() === SEASON_START.getTime()) return
    setFirst(f)
    // a check-in from the URL that has passed in the meantime is dropped
    setRange((r) => (r?.from && r.from < f ? undefined : r))
  }, [])

  // the chosen room type counts only while its property is selected and the party fits in it (otherwise the search
  // cannot list it); it comes back if the party shrinks again
  const unit = chosen && chosen.property === property && adults + children <= chosen.maxGuests ? chosen : undefined
  const valid = validStay(range?.from, range?.to, MIN_NIGHTS, first)
  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0
  const guests = adults + children
  const rooms = splitParty(adults, children, property)
  const url = valid && range?.from && range?.to ? vikbookingUrl({ locale, from: range.from, to: range.to, adults, children, property }) : undefined

  // Mirror the choices into the URL, so the language switcher (which keeps the query string) and a reload keep them.
  useEffect(() => {
    const p = new URLSearchParams()
    if (property !== 'both') p.set('property', property)
    if (range?.from) p.set('from', toISO(range.from))
    if (range?.to) p.set('to', toISO(range.to))
    p.set('adults', String(adults))
    if (children) p.set('children', String(children))
    if (unit) p.set('unit', unit.key)
    const qs = p.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      try {
        window.history.replaceState(window.history.state, '', next)
      } catch {}
    }
  }, [property, range?.from, range?.to, adults, children, unit])

  /** "2 adults · 1 child", or "2 guests" without children */
  const people = (n: number, kind: 'adult' | 'child') => tr(t, `party.${n === 1 ? kind : kind === 'adult' ? 'adults' : 'children'}`, { count: n })
  const guestsText = children ? `${people(adults, 'adult')} · ${people(children, 'child')}` : countLabel(common, 'guest', guests)
  const datesText =
    range?.from && range?.to
      ? `${formatDate(locale, range.from, { day: 'numeric', month: 'short' })} – ${formatDate(locale, range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : range?.from
        ? `${formatDate(locale, range.from, { day: 'numeric', month: 'short', year: 'numeric' })} – …`
        : t.summary.noDates
  const propertyName = property === 'both' ? bothLabel : properties[property].name
  // the booking engine lists its rooms by their English names in every language, so the guest is told what to look for
  const vikList = unit ? VIK_ROOM_NAMES[unit.key] : undefined
  const vikNames = vikList?.length ? new Intl.ListFormat(htmlLang[locale], { type: 'disjunction' }).format(vikList.map((n) => quote(locale, n))) : ''

  const goToDates = () => {
    setTried(true)
    const box = document.getElementById('bf-dates')
    box?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    box?.querySelector<HTMLElement>('.rdp-day[tabindex="0"]')?.focus({ preventScroll: true })
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-mute">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )

  return (
    <div className="container pb-24 pt-[calc(var(--header-h)+var(--banner-h,0px)+2.5rem)]">
      <div className="max-w-3xl">
        <h1 className="font-display text-display-lg font-light">{t.title}</h1>
        <p className="mt-3 text-[1.05rem] text-ink-soft text-pretty">{t.intro}</p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        {/* the room chosen on a room card or in the room finder: what to pick on the next page */}
        {unit && (
          <div className="flex gap-4 rounded-xl3 bg-white p-4 shadow-soft ring-1 ring-ink/5 sm:p-5 lg:col-span-2">
            <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-28">
              <Image src={(unit.photos[0] ?? properties[unit.property].hero).src} alt="" fill sizes="112px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.chosen.label}</p>
              <p className="mt-0.5 font-display text-xl leading-tight">
                {units[unit.key].name} <span className="text-[0.95rem] text-ink-mute">· {properties[unit.property].shortName}</span>
              </p>
              {vikNames && <p className="mt-1.5 text-[0.88rem] leading-snug text-ink-soft">{fill(t.chosen.next, { names: vikNames })}</p>}
            </div>
          </div>
        )}

        {/* self-start: the card hugs the calendar instead of stretching to the height of the side column */}
        <div id="bf-dates" className="min-w-0 self-start rounded-xl3 bg-white p-4 shadow-soft ring-1 ring-ink/5 sm:p-6 md:p-8">
          <p className="label">{t.stay.dates}</p>
          {/* two months only where they fit beside the side column (xl and up) */}
          <div className="hidden justify-center xl:flex [&_.cv-daypicker]:[--rdp-cell-size:44px] 2xl:[&_.cv-daypicker]:[--rdp-cell-size:50px]">
            <DateRangeCalendar key={first.getTime()} locale={locale} value={range} onChange={setRange} months={2} fromDate={first} today={today} />
          </div>
          <div className="flex justify-center xl:hidden md:[&_.cv-daypicker]:[--rdp-cell-size:52px] max-[380px]:[&_.cv-daypicker]:[--rdp-cell-size:38px] max-[340px]:[&_.cv-daypicker]:[--rdp-cell-size:34px]">
            <DateRangeCalendar key={first.getTime()} locale={locale} value={range} onChange={setRange} months={1} fromDate={first} today={today} />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
            <p className="label">{t.stay.property}</p>
            <div className="mt-2 space-y-2">
              {(['both', 'aegealis', 'theodora'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setProperty(p)} aria-pressed={property === p} className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${property === p ? 'bg-sea-mist ring-sea' : 'ring-ink/10 hover:bg-sand'}`}>
                  <span className="block font-semibold">{p === 'both' ? bothLabel : properties[p].name}</span>
                  {p !== 'both' && <span className="block text-[0.82rem] text-ink-mute">{common.nav.stayDesc[p]}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
            <Stepper
              label={t.stay.adults}
              value={adults}
              min={1}
              max={PARTY_MAX_GUESTS - children}
              onChange={(n) => {
                setAdults(n)
                setChildren((c) => Math.min(c, maxChildrenFor(n)))
              }}
              addLabel={common.a11y.addAdult}
              removeLabel={common.a11y.removeAdult}
            />
            <div className="hairline" />
            <Stepper label={t.stay.children} value={children} min={0} max={maxChildrenFor(adults)} onChange={setChildren} addLabel={common.a11y.addChild} removeLabel={common.a11y.removeChild} />
            {rooms.length > 1 && <p className="mt-3 rounded-xl bg-sun-light/70 px-3.5 py-2.5 text-[0.82rem] leading-snug text-ink-soft">{fill(t.stay.split, { count: guests, rooms: rooms.length })}</p>}
          </div>

          <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.summary.title}</p>
            <dl className="mt-4 space-y-2 text-[0.92rem]">
              {row(t.summary.property, propertyName)}
              {unit && row(t.summary.room, units[unit.key].name)}
              {row(t.summary.dates, <span className={range?.from ? '' : 'font-normal text-ink-mute'}>{datesText}</span>)}
              {valid && row(t.summary.nights, <span className="tabular-nums">{nights}</span>)}
              {row(t.summary.guests, guestsText)}
              {rooms.length > 1 && row(t.summary.rooms, <span className="tabular-nums">{rooms.length}</span>)}
            </dl>

            {url ? (
              <a href={url} className="btn btn-primary mt-6 w-full py-4">
                {t.continue} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <button type="button" onClick={goToDates} aria-describedby="bf-why" className="btn btn-primary mt-6 w-full py-4 opacity-60">
                {t.continue} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {/* why the button does not go anywhere yet; a live region, so the change is read out */}
            <div id="bf-why" role="status" className="text-center text-[0.85rem]">
              {!url && (tried || range?.from) && <p className="mt-2 font-medium text-terra-deep">{range?.from ? fill(t.stay.pickCheckOut, { count: MIN_NIGHTS }) : t.stay.pickDates}</p>}
            </div>

            <p className="mt-4 flex gap-2 text-[0.84rem] leading-snug text-ink-soft">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sea" aria-hidden="true" /> {t.terms}
            </p>
            <p className="mt-2 flex gap-2 text-[0.8rem] leading-snug text-ink-mute">
              <BedDouble className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t.handoff}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
