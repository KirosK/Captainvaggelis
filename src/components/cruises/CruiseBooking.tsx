'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarPlus, Check, CreditCard, Lock, MapPin, MessageCircle, Ship } from 'lucide-react'
import { SingleDateCalendar } from '@/components/ui/DateRange'
import { Stepper } from '@/components/ui/Popover'
import type { Cruise } from '@/data/cruises'
import { cruiseRules, cruises, sortWeekdays } from '@/data/cruises'
import { whatsappLink } from '@/data/site'
import enBooking from '@/content/en/booking.json'
import elBooking from '@/content/el/booking.json'
import itBooking from '@/content/it/booking.json'
import {
  departureState, isEmail, isPhone, makeRef, pickupTimes, readStore, sailingDates, useStore,
  type CruiseBooking as Booking, type CruiseRequestEntry,
} from '@/lib/cruiseStore'
import { fromISO, SEASON_END, SEASON_START, toISO } from '@/lib/dates'
import { fill, formatDate, formatPrice, href, listFormat, locales, tr, weekdayName, type Dict, type Locale } from '@/lib/i18n'
import { TicketCode } from './TicketCode'

type Step = 'select' | 'details' | 'pay' | 'done'
type Pickup = 'skala' | 'poros'

/** Cruise-booking strings that live in booking.json → "cruise" (the page passes only cruises.booking). */
const CRUISE_UI: Record<Locale, Dict> = { en: enBooking.cruise, el: elBooking.cruise, it: itBooking.cruise }

/**
 * The day picker's own stylesheet loads after globals.css and resets its colour variables to its default blue,
 * so the single-date calendars set the site colours here (and keep the selected sailing day's number white).
 */
const CAL_COLOURS =
  '[&_.cv-daypicker]:[--rdp-accent-color:#0f2430] [&_.cv-daypicker]:[--rdp-background-color:#e8f2f2] [&_.cv-daypicker]:[--rdp-outline:2px_solid_#17677a] [&_[aria-selected=true]]:!text-white'

/** "1 adult" / "2 adults" … from booking.json → cruise.count */
function people(ui: Dict, n: number, kind: 'adult' | 'child' | 'infant') {
  const plural = { adult: 'adults', child: 'children', infant: 'infants' }[kind]
  return tr(ui, `count.${n === 1 ? kind : plural}`, { count: n })
}
export function passengerLine(ui: Dict, b: { adults: number; children: number; infants: number }) {
  return [people(ui, b.adults, 'adult'), b.children ? people(ui, b.children, 'child') : '', b.infants ? people(ui, b.infants, 'infant') : ''].filter(Boolean).join(' · ')
}

// ----- Steps: focus and a draft that survives a language switch ---------------------------------

/**
 * Moves focus to the new step's heading once the step has finished coming in (AnimatePresence lets the old step leave first),
 * so keyboard and screen-reader users land on the new step instead of on <body>. Returns a cancel function for useEffect.
 */
export function focusStep(id: string, { scroll = false } = {}) {
  let raf = 0
  let tries = 0
  const tick = () => {
    const el = document.getElementById(id)
    const box = el?.closest<HTMLElement>('[data-step]')
    if (el && (!box || parseFloat(getComputedStyle(box).opacity) > 0.98 || tries > 90)) {
      el.focus({ preventScroll: true })
      if (scroll) el.scrollIntoView({ block: 'nearest' })
      return
    }
    if (++tries < 180) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

/** sessionStorage key for a booking in progress: the path without its language, so /en/… and /el/… share it. */
export function draftKey(prefix: string, pathname: string | null) {
  const path = (pathname ?? '').replace(new RegExp(`^/(${locales.join('|')})(?=/|$)`), '').replace(/\/$/, '')
  return `${prefix}:${path || '/'}`
}
export function readDraft<T>(key: string): Partial<T> | null {
  try {
    const raw = sessionStorage.getItem(key)
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return v && typeof v === 'object' ? (v as Partial<T>) : null
  } catch {
    return null
  }
}
/** Saves the draft, or removes it when `value` is null (after a successful booking). */
export function writeDraft(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
const int = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback)
const draftText = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '')

type CruiseDraft = {
  date: string
  adults: number
  children: number
  infants: number
  pickup: Pickup
  guest: boolean
  second: boolean
  form: Record<string, string>
  step: Step
}

// ----- iCalendar ------------------------------------------------------------------------------

const ATHENS_TZ = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Athens',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
/** Folds a content line at 75 octets (RFC 5545 §3.1); Greek letters take two octets each. */
function icsFold(line: string) {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let len = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (len + n > limit) {
      out.push(cur)
      cur = ''
      len = 0
      limit = 74 // continuation lines start with a space
    }
    cur += ch
    len += n
  }
  out.push(cur)
  return out.join('\r\n ')
}
function download(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoking straight away can cancel the download in Safari and Firefox
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// ----- Scheduled cruises ------------------------------------------------------------------------

export function CruiseBooking({ cruise, locale, t, common, name, pay, ui: uiProp }: { cruise: Cruise; locale: Locale; t: Dict; common: Dict; name: string; pay: Dict; ui?: Dict }) {
  const ui = uiProp ?? CRUISE_UI[locale]
  const { store, update, ready } = useStore()
  const cfg = store.config[cruise.key]
  const dates = useMemo(() => (ready ? sailingDates(store, cruise.key) : []), [store, cruise.key, ready])
  const states = useMemo(() => new Map(dates.map((d) => [toISO(d), departureState(store, cruise.key, d)])), [dates, store, cruise.key])
  const times = pickupTimes(cruise, cfg)

  const firstOpen = dates.find((d) => states.get(toISO(d))?.status === 'open')
  const [date, setDate] = useState<Date | undefined>()
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [pickup, setPickup] = useState<Pickup>('skala')
  const [guest, setGuest] = useState(false)
  const [second, setSecond] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [form, setForm] = useState({ name: '', email: '', phone: '', hotel: '', notes: '' })
  const [payMode, setPayMode] = useState<'card' | 'kiosk'>('card')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Booking | null>(null)
  const [stale, setStale] = useState(false)

  // what the guest has chosen and typed survives a language switch (the page reloads in the other language)
  const pathname = usePathname()
  const key = draftKey('cv-cruise', pathname)
  const [restored, setRestored] = useState(false)
  const quietFocus = useRef(false)
  useEffect(() => {
    const d = readDraft<CruiseDraft>(key)
    if (d) {
      const day = fromISO(d.date)
      if (day) setDate(day)
      setAdults(int(d.adults, 1, 20, 2))
      setChildren(int(d.children, 0, 10, 0))
      setInfants(int(d.infants, 0, 4, 0))
      if (d.pickup === 'skala' || d.pickup === 'poros') setPickup(d.pickup)
      setGuest(d.guest === true)
      setSecond(d.second === true)
      if (d.form) setForm({ name: draftText(d.form.name), email: draftText(d.form.email), phone: draftText(d.form.phone), hotel: draftText(d.form.hotel), notes: draftText(d.form.notes) })
      if (day && (d.step === 'details' || d.step === 'pay')) {
        quietFocus.current = true
        setStep(d.step)
      }
    }
    setRestored(true)
  }, [key])
  useEffect(() => {
    if (!restored) return
    if (step === 'done') writeDraft(key, null)
    else writeDraft(key, { date: date ? toISO(date) : undefined, adults, children, infants, pickup, guest, second, form, step: step === 'pay' ? 'pay' : step === 'details' ? 'details' : 'select' })
  }, [restored, key, date, adults, children, infants, pickup, guest, second, form, step])

  // each step change removes the button that was pressed: move focus to the new step's heading
  // (compared with the previous step rather than a "first run" flag, which React's development double run would trip)
  const prevStep = useRef(step)
  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step
    if (quietFocus.current) {
      quietFocus.current = false
      return
    }
    return focusStep(`cb-step-${step}`, { scroll: true })
  }, [step])

  const st = date ? states.get(toISO(date)) : undefined
  const adultPrice = cfg?.adult ?? cruise.prices!.adult
  const childPrice = cfg?.child ?? cruise.prices!.child
  const subtotal = adults * adultPrice + children * childPrice
  const rate = Math.max(guest ? cruiseRules.guestDiscount : 0, second ? cruiseRules.secondCruiseDiscount : 0)
  const discount = Math.round(subtotal * rate)
  const total = subtotal - discount
  // infants travel free but take a place on board (the boat's licence counts every passenger)
  const seats = adults + children + infants
  const isOpen = st?.status === 'open'
  const enough = st ? st.left >= seats : false
  // also blocked when the date is no longer on the schedule (the Captain changed the sailing days meanwhile)
  const blocked = !!date && ready && (!st || !isOpen || !enough)
  const where: Pickup = times.hasPoros ? pickup : 'skala'
  const notSailing = ready && (!cfg?.active || dates.length === 0)

  const isoSet = (status: string) => dates.filter((d) => states.get(toISO(d))?.status === status)
  const few = dates.filter((d) => {
    const s = states.get(toISO(d))
    return s?.status === 'open' && s.left < 25
  })
  const sailing = new Set(dates.map(toISO))

  // "Only 1 seat left", not "Only 1 seats left": the …One keys take the singular, the plural keys stay the fallback
  const notEnoughText = (left: number) => fill((left === 1 && ui.notEnoughOne) || ui.notEnough, { count: left })
  const seatsText = (left: number) => {
    const k = left < 25 ? 'fewLeft' : 'seatsLeft'
    return left === 1 && typeof t[`${k}One`] === 'string' ? fill(t[`${k}One`], { count: left }) : tr(t, k, { count: left })
  }
  const unavailableText = (s?: typeof st) => (s?.status === 'cancelled' ? t.cancelledNote : s?.status === 'soldout' ? t.soldOut : s?.status === 'closed' ? ui.closed : ui.unavailable)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = common.errors.required
    if (!isEmail(form.email)) e.email = common.errors.email
    if (!isPhone(form.phone)) e.phone = common.errors.phone
    setErrors(e)
    const first = (['name', 'email', 'phone'] as const).find((k) => e[k])
    if (first) requestAnimationFrame(() => document.getElementById(`cb-${first}`)?.focus())
    return !first
  }

  const confirm = () => {
    if (!date) return
    // the Captain may have cancelled or closed the departure, or changed the sailing days, while the guest was filling in the form
    const latest = readStore()
    const onSchedule = sailingDates(latest, cruise.key, date, date).length > 0
    const fresh = departureState(latest, cruise.key, date)
    if (!onSchedule || fresh.status !== 'open' || fresh.left < seats) {
      setStale(true)
      setStep('select')
      return
    }
    const b: Booking = {
      ref: makeRef('CV'),
      cruise: cruise.key,
      date: toISO(date),
      adults,
      children,
      infants,
      pickup: where,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      hotel: form.hotel.trim() || undefined,
      notes: form.notes.trim() || undefined,
      total,
      paid: payMode === 'card',
      guest,
      lang: locale,
      createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, bookings: [b, ...s.bookings] }))
    setDone(b)
    setStep('done')
  }

  const ics = () => {
    if (!done) return
    const tm = times[done.pickup]
    const day = done.date.replace(/-/g, '')
    const hms = (hhmm: string) => `${hhmm.replace(':', '')}00`
    const place = done.pickup === 'poros' ? ui.poros : ui.skala
    const description = [
      `${t.reference}: ${done.ref}`,
      passengerLine(ui, done),
      `${ui.boarding}: ${place}, ${tm.depart}`,
      done.pickup === 'poros' ? ui.icsPorosNote : ui.icsCheckIn,
      fill(ui.icsReturn, { place, time: tm.back }),
    ].join('\n')
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Captain Vangelis//Cruises//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...ATHENS_TZ,
      'BEGIN:VEVENT',
      `UID:${done.ref}@captain-vangelis`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Athens:${day}T${hms(tm.depart)}`,
      `DTEND;TZID=Europe/Athens:${day}T${hms(tm.back)}`,
      `SUMMARY:${icsText(`${name} · ${common.brand.name}`)}`,
      `LOCATION:${icsText(done.pickup === 'poros' ? ui.icsPoros : ui.icsSkala)}`,
      `DESCRIPTION:${icsText(description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
    download(`${done.ref}.ics`, lines.map(icsFold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8')
  }

  const days = listFormat(locale, sortWeekdays(cfg?.weekdays ?? cruise.weekdays).map((w) => weekdayName(locale, w)))
  const pickupLabel = (pk: Pickup) => `${ui[pk]} · ${times[pk].depart}`

  const blockedBanner = blocked && (
    <div className="rounded-xl bg-terra-light p-4 text-[0.88rem] text-terra-deep" role="alert">
      <p className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {isOpen ? notEnoughText(st!.left) : unavailableText(st)}
      </p>
      <button type="button" onClick={() => setStep('select')} className="btn btn-ghost mt-3 bg-white py-2.5">
        <ArrowLeft className="h-4 w-4" /> {ui.chooseAnother}
      </button>
    </div>
  )

  return (
    <div id="book" className="scroll-mt-32 overflow-hidden rounded-xl3 bg-white shadow-lift ring-1 ring-ink/5">
      <div className="flex items-center justify-between gap-4 bg-ink px-6 py-5 text-white">
        <div className="min-w-0">
          <p className="font-display text-xl">{t.title}</p>
          {!notSailing && days && <p className="text-[0.82rem] text-white/65">{fill(t.onlyDays, { days })}</p>}
        </div>
        <Ship className="h-6 w-6 shrink-0 text-sea-light" />
      </div>

      {notSailing ? (
        <div className="p-6 text-center sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sand text-ink-soft">
            <Ship className="h-6 w-6" />
          </span>
          <p className="mt-4 font-display text-2xl">{ui.notSailingTitle}</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.92rem] text-ink-soft">{ui.notSailingBody}</p>
          <a href={whatsappLink(fill(ui.askMessage, { name }))} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6">
            <MessageCircle className="h-4 w-4" /> {ui.ask}
          </a>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <m.div key="select" data-step initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 sm:p-6">
              {stale && (
                <p className="mb-4 flex gap-2 rounded-xl bg-terra-light px-4 py-3 text-[0.88rem] font-medium text-terra-deep" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ui.unavailable}
                </p>
              )}
              <p id="cb-step-select" tabIndex={-1} className="label outline-none">
                {t.date}
              </p>
              <div className={`-mx-2 flex justify-center max-[380px]:[&_.cv-daypicker]:[--rdp-cell-size:38px] ${CAL_COLOURS}`}>
                <SingleDateCalendar
                  locale={locale}
                  value={isOpen ? date : undefined}
                  onChange={(d) => {
                    setDate(d)
                    setStale(false)
                  }}
                  fromDate={SEASON_START}
                  toDate={SEASON_END}
                  defaultMonth={firstOpen ?? SEASON_START}
                  disabled={(d) => {
                    const s = states.get(toISO(d))
                    return !sailing.has(toISO(d)) || !s || s.status !== 'open'
                  }}
                  modifiers={{ sailing: dates, cancelled: isoSet('cancelled'), soldout: isoSet('soldout'), few }}
                  modifiersClassNames={{ sailing: 'day-sailing', cancelled: 'day-cancelled', few: 'day-few' }}
                  // the colours of few-seat, cancelled and full days are also read out
                  labels={{
                    labelDay: (day, mods) =>
                      [formatDate(locale, day, { weekday: 'long', day: 'numeric', month: 'long' }), mods.few && common.a11y.fewSeats, mods.cancelled && common.a11y.cancelled, mods.soldout && common.a11y.soldOut]
                        .filter(Boolean)
                        .join(', '),
                  }}
                />
              </div>
              {st &&
                (isOpen ? (
                  <p className={`mt-1 rounded-xl px-4 py-2.5 text-[0.88rem] font-medium ${!enough || st.left < 25 ? 'bg-terra-light text-terra-deep' : 'bg-sea-mist text-sea-deep'}`}>
                    {formatDate(locale, st.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {enough ? seatsText(st.left) : notEnoughText(st.left)}
                  </p>
                ) : (
                  <p className="mt-1 flex gap-2 rounded-xl bg-terra-light px-4 py-2.5 text-[0.88rem] font-medium text-terra-deep" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {formatDate(locale, st.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {unavailableText(st)}
                    </span>
                  </p>
                ))}
              {isoSet('cancelled').length > 0 && !(st && !isOpen) && (
                <p className="mt-3 flex gap-2 text-[0.8rem] text-ink-mute">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-terra" /> {t.cancelledNote}
                </p>
              )}

              <div className="mt-5 divide-y divide-line border-y border-line">
                <Stepper label={t.adults} hint={t.adultsHint} value={adults} min={1} max={20} onChange={setAdults} addLabel={common.a11y.addAdult} removeLabel={common.a11y.removeAdult} />
                <Stepper label={t.children} hint={t.childrenHint} value={children} min={0} max={10} onChange={setChildren} addLabel={common.a11y.addChild} removeLabel={common.a11y.removeChild} />
                <Stepper label={t.infants} hint={t.infantsHint} value={infants} min={0} max={4} onChange={setInfants} addLabel={common.a11y.addInfant} removeLabel={common.a11y.removeInfant} />
              </div>

              {times.hasPoros && (
                <fieldset className="mt-5 min-w-0">
                  <legend className="label">{t.pickup}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(['skala', 'poros'] as const).map((pk) => (
                      <button
                        key={pk}
                        type="button"
                        onClick={() => setPickup(pk)}
                        aria-pressed={pickup === pk}
                        className={`flex min-w-0 items-start gap-2 rounded-xl px-3 py-3 text-left text-[0.86rem] ring-1 transition ${pickup === pk ? 'bg-sea-mist ring-sea' : 'ring-ink/10 hover:bg-sand'}`}
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sea" />
                        <span className="min-w-0">
                          <span className="block font-medium leading-tight">{ui[pk]}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.78rem] tabular-nums text-ink-mute">
                            {times[pk].depart}
                            {pk === 'poros' && <span className="whitespace-nowrap rounded-full bg-sun-light px-1.5 py-0.5 text-[0.68rem] font-semibold text-ink">{ui.onRequest}</span>}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {pickup === 'poros' && <p className="mt-2 rounded-xl bg-sun-light/60 px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-ink-soft">{ui.porosNote}</p>}
                </fieldset>
              )}

              <div className="mt-5 space-y-2">
                {[
                  { on: guest, set: setGuest, label: t.guest, hint: t.guestHint },
                  { on: second, set: setSecond, label: t.second, hint: t.secondHint },
                ].map((o) => (
                  <label key={o.label} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${o.on ? 'bg-sun-light/60 ring-sun' : 'ring-ink/10 hover:bg-sand'}`}>
                    <input type="checkbox" checked={o.on} onChange={(e) => o.set(e.target.checked)} className="mt-1 h-4 w-4 accent-[#0F2430]" />
                    <span>
                      <span className="block text-[0.9rem] font-semibold">{o.label}</span>
                      <span className="block text-[0.8rem] text-ink-mute">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <dl className="mt-6 space-y-2 text-[0.92rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-mute">
                    {adults} × {formatPrice(locale, adultPrice)}
                    {children ? ` + ${children} × ${formatPrice(locale, childPrice)}` : ''}
                  </dt>
                  <dd className="tabular-nums">{formatPrice(locale, subtotal)}</dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between gap-4 text-sea">
                    <dt>
                      {t.discount} −{Math.round(rate * 100)}%
                    </dt>
                    <dd className="tabular-nums">−{formatPrice(locale, discount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                  <dt className="font-semibold">{t.total}</dt>
                  <dd className="font-display text-3xl tabular-nums">{formatPrice(locale, total)}</dd>
                </div>
              </dl>
              <button type="button" disabled={!date || !isOpen || !enough} onClick={() => setStep('details')} className="btn btn-primary mt-5 w-full py-4">
                {t.next} <ArrowRight className="h-4 w-4" />
              </button>
            </m.div>
          )}

          {step === 'details' && (
            <m.form
              key="details"
              data-step
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 p-5 sm:p-6"
              onSubmit={(e) => {
                e.preventDefault()
                if (validate()) setStep('pay')
              }}
              noValidate
            >
              <button type="button" onClick={() => setStep('select')} className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-mute hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> {common.cta.back}
              </button>
              {blockedBanner}
              <h2 id="cb-step-details" tabIndex={-1} className="font-display text-2xl outline-none">
                {t.yourDetails}
              </h2>
              {(
                [
                  ['name', t.name, 'text', 'name'],
                  ['email', t.email, 'email', 'email'],
                  ['phone', t.phone, 'tel', 'tel'],
                  ['hotel', t.hotel, 'text', 'off'],
                ] as const
              ).map(([k, label, type, ac]) => (
                <div key={k}>
                  <label className="label" htmlFor={`cb-${k}`}>
                    {label}
                  </label>
                  <input
                    id={`cb-${k}`}
                    type={type}
                    autoComplete={ac}
                    className={`field ${errors[k] ? 'ring-2 ring-terra' : ''}`}
                    value={form[k]}
                    onChange={(e) => {
                      setForm({ ...form, [k]: e.target.value })
                      if (errors[k]) setErrors({ ...errors, [k]: '' })
                    }}
                    aria-invalid={!!errors[k]}
                    aria-describedby={errors[k] ? `cb-${k}-err` : undefined}
                  />
                  {errors[k] && (
                    <p id={`cb-${k}-err`} className="mt-1 text-[0.8rem] text-terra-deep">
                      {errors[k]}
                    </p>
                  )}
                </div>
              ))}
              <div>
                <label className="label" htmlFor="cb-notes">
                  {t.notes}
                </label>
                <textarea id="cb-notes" rows={3} className="field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary w-full py-4">
                {t.next} <ArrowRight className="h-4 w-4" />
              </button>
            </m.form>
          )}

          {step === 'pay' && date && (
            <m.div key="pay" data-step initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-5 sm:p-6">
              <button type="button" onClick={() => setStep('details')} className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-mute hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> {common.cta.back}
              </button>
              {blockedBanner}
              <div className="rounded-xl bg-sand p-4 text-[0.9rem]">
                {/* focus lands here, so the step opens with a read-back of the booking */}
                <h2 id="cb-step-pay" tabIndex={-1} className="font-semibold outline-none">
                  {name}
                </h2>
                <p className="text-ink-mute">
                  {formatDate(locale, date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {pickupLabel(where)}
                </p>
                <p className="mt-1 text-ink-mute">{passengerLine(ui, { adults, children, infants })}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['card', 'kiosk'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setPayMode(mode)} aria-pressed={payMode === mode} className={`rounded-xl px-3 py-3 text-[0.86rem] font-semibold ring-1 transition ${payMode === mode ? 'bg-ink text-white ring-ink' : 'ring-ink/10 hover:bg-sand'}`}>
                    {mode === 'card' ? (
                      <span className="inline-flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> {pay.card}
                      </span>
                    ) : (
                      t.payLater
                    )}
                  </button>
                ))}
              </div>
              {payMode === 'card' && <DemoCard pay={pay} />}
              <button type="button" onClick={confirm} disabled={blocked} className="btn btn-sea w-full py-4">
                <Lock className="h-4 w-4" /> {payMode === 'card' ? fill(t.pay, { amount: formatPrice(locale, total) }) : t.payLater}
              </button>
              <p className="text-center text-[0.75rem] text-ink-mute">
                <TermsLink locale={locale} sentence={t.terms} phrase={t.termsLink} external={common.a11y.external} />
              </p>
            </m.div>
          )}

          {step === 'done' && done && (
            <m.div key="done" data-step initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="p-5 sm:p-6">
              <m.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sea text-white">
                <Check className="h-8 w-8" />
              </m.div>
              <h2 id="cb-step-done" tabIndex={-1} className="mt-5 text-center font-display text-3xl outline-none">
                {t.confirmTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-center text-[0.95rem] text-ink-soft">
                {done.paid
                  ? done.pickup === 'poros'
                    ? fill(ui.paidBodyPoros, { time: times.poros.depart })
                    : ui.paidBody
                  : fill(done.pickup === 'poros' ? ui.kioskBodyPoros : ui.kioskBody, { amount: formatPrice(locale, done.total) })}
              </p>
              {done.paid && done.pickup === 'poros' && <p className="mx-auto mt-2 max-w-sm text-center text-[0.85rem] text-ink-mute">{ui.porosConfirm}</p>}
              <div className="relative mt-6 overflow-hidden rounded-2xl bg-sand">
                <div className="flex items-center gap-4 p-5">
                  <TicketCode value={done.ref} label={`${t.ticket} ${done.ref}`} />
                  <div className="min-w-0 text-[0.88rem]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.ticket}</p>
                    <p className="font-display text-xl leading-tight">{name}</p>
                    <p className="text-ink-mute">
                      {formatDate(locale, date!, { weekday: 'short', day: 'numeric', month: 'short' })} · {pickupLabel(done.pickup)}
                    </p>
                    <p className="mt-1 font-mono text-[0.95rem] font-semibold tracking-wider">{done.ref}</p>
                  </div>
                </div>
                <div className="relative border-t border-dashed border-ink/15 px-5 py-4">
                  <span aria-hidden="true" className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-white" />
                  <span aria-hidden="true" className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-white" />
                  <dl className="space-y-1.5 text-[0.86rem]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-mute">{ui.passengers}</dt>
                      <dd className="text-right">{passengerLine(ui, done)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-mute">{ui.boarding}</dt>
                      <dd className="text-right">
                        {pickupLabel(done.pickup)}
                        {done.pickup === 'poros' && <span className="text-ink-mute"> ({ui.onRequest})</span>}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-mute">{ui.return}</dt>
                      <dd className="text-right tabular-nums">
                        {ui[done.pickup]} · {times[done.pickup].back}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
                      <dt className="font-semibold">{done.paid ? ui.paid : ui.dueKiosk}</dt>
                      <dd className="font-display text-xl tabular-nums">{formatPrice(locale, done.total)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={ics} className="btn btn-ghost w-full">
                  <CalendarPlus className="h-4 w-4" /> {t.addToCalendar}
                </button>
                <Link href={href(locale, '/cruises')} className="btn btn-primary w-full">
                  {ui.another} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

/**
 * Card fields (nothing is sent anywhere): each field has a visible label, because a placeholder disappears as soon as you type.
 * The number placeholder is a neutral sequence, not a well-known test card; the expiry placeholder follows the language (ΜΜ / ΕΕ, MM / AA).
 */
export function DemoCard({ pay }: { pay: Dict }) {
  const id = useId()
  return (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-ink/10">
      <div className="flex items-center justify-between">
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">Visa · Mastercard · Apple Pay</span>
        <Lock className="h-4 w-4 text-ink-mute" aria-hidden="true" />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-number`}>
          {pay.number}
        </label>
        <input id={`${id}-number`} className="field" inputMode="numeric" placeholder={pay.numberPlaceholder ?? '1234 5678 9012 3456'} autoComplete="off" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-expiry`}>
            {pay.expiry}
          </label>
          <input id={`${id}-expiry`} className="field" inputMode="numeric" placeholder={pay.expiryPlaceholder ?? 'MM / YY'} autoComplete="off" />
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-cvc`}>
            {pay.cvc}
          </label>
          <input id={`${id}-cvc`} className="field" inputMode="numeric" placeholder="123" autoComplete="off" />
        </div>
      </div>
      <p className="text-[0.75rem] text-ink-mute">{pay.secure}</p>
    </div>
  )
}

/** The words of the terms sentence that link to /terms when no termsLink key gives them. */
const TERMS_PHRASE: Record<Locale, string> = { en: 'booking terms', el: 'όρους μας', it: 'condizioni di prenotazione' }

/** "By booking, you accept our booking terms." with the terms words linked (or the whole sentence when they are not found). */
export function TermsLink({ locale, sentence, phrase, external }: { locale: Locale; sentence: string; phrase?: string; external: string }) {
  const words = phrase || TERMS_PHRASE[locale]
  const at = words ? sentence.indexOf(words) : -1
  const link = (label: string) => (
    <Link href={href(locale, '/terms')} target="_blank" rel="noopener" className="font-semibold text-ink-soft underline decoration-ink/30 underline-offset-2 hover:text-ink">
      {label}
      <span className="sr-only"> {external}</span>
    </Link>
  )
  if (at < 0) return link(sentence)
  return (
    <>
      {sentence.slice(0, at)}
      {link(words)}
      {sentence.slice(at + words.length)}
    </>
  )
}

// ----- Cruises on request (BBQ, private, wedding) -----------------------------------------------

/** Request form for cruises that only run on request. Requests are stored for the admin and can also go straight to WhatsApp. */
export function CruiseRequest({ locale, t, common, contact, cruise: cruiseProp, ui: uiProp }: { locale: Locale; t: Dict; common: Dict; contact: Dict; cruise?: Cruise; ui?: Dict }) {
  const ui = uiProp ?? CRUISE_UI[locale]
  const pathname = usePathname()
  const cruiseKey = cruiseProp?.key ?? cruises.find((c) => pathname?.replace(/\/$/, '').endsWith(`/${c.slug}`))?.key ?? 'private'
  const { update } = useStore()
  const [sent, setSent] = useState<CruiseRequestEntry | null>(null)
  const [date, setDate] = useState<Date | undefined>()
  const [count, setCount] = useState(10)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const kind: string = (ui.request.kinds as Record<string, string>)[cruiseKey] ?? ui.request.kinds.private
  const dateLong = date ? formatDate(locale, date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const waText = date ? fill(ui.request.message, { kind, date: dateLong, count }) : fill(ui.request.messageNoDate, { kind, count })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!date) e.date = ui.request.dateError
    if (!form.name.trim()) e.name = common.errors.required
    if (!isEmail(form.email)) e.email = common.errors.email
    if (!isPhone(form.phone)) e.phone = common.errors.phone
    setErrors(e)
    const first = (['date', 'name', 'email', 'phone'] as const).find((k) => e[k])
    if (first) {
      requestAnimationFrame(() => {
        const el = first === 'date' ? document.getElementById('cr-date') : document.getElementById(`cr-${first}`)
        el?.focus()
        if (first === 'date') el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    const r: CruiseRequestEntry = {
      ref: makeRef('RQ'),
      cruise: cruiseKey,
      date: date ? toISO(date) : undefined,
      people: count,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      message: form.message.trim() || undefined,
      lang: locale,
      createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, requests: [r, ...(s.requests ?? [])] }))
    setSent(r)
  }

  return (
    <div id="book" className="scroll-mt-32 overflow-hidden rounded-xl3 bg-white shadow-lift ring-1 ring-ink/5">
      <div className="bg-ink px-6 py-5 text-white">
        <p className="font-display text-xl">{common.cta.sendRequest}</p>
        <p className="text-[0.85rem] text-white/65">{t.requestOnly}</p>
      </div>
      {sent ? (
        <div className="p-6 text-center sm:p-8">
          <m.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sea text-white">
            <Check className="h-7 w-7" />
          </m.div>
          <p className="mx-auto mt-4 max-w-sm text-[0.98rem] text-ink-soft">{fill(ui.request.sent, { date: dateLong })}</p>
          <p className="mt-4 inline-block rounded-full bg-sand px-4 py-2 font-mono text-[0.9rem] font-semibold tracking-wider">
            {ui.request.reference} {sent.ref}
          </p>
          <div className="mt-6">
            <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <MessageCircle className="h-4 w-4" /> {common.cta.whatsapp}
            </a>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4 p-5 sm:p-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div>
            <p className="label" id="cr-date-label">
              {ui.request.date}
            </p>
            <div
              id="cr-date"
              tabIndex={-1}
              role="group"
              aria-labelledby="cr-date-label"
              aria-describedby={errors.date ? 'cr-date-err' : undefined}
              className={`-mx-2 flex justify-center rounded-2xl outline-none max-[380px]:[&_.cv-daypicker]:[--rdp-cell-size:38px] ${CAL_COLOURS} ${errors.date ? 'ring-2 ring-terra' : ''}`}
            >
              <SingleDateCalendar
                locale={locale}
                value={date}
                onChange={(d) => {
                  setDate(d)
                  if (d) setErrors((x) => ({ ...x, date: '' }))
                }}
                fromDate={SEASON_START}
                toDate={SEASON_END}
              />
            </div>
            {errors.date && (
              <p id="cr-date-err" className="mt-1 text-[0.8rem] text-terra-deep">
                {errors.date}
              </p>
            )}
          </div>
          <div className="border-y border-line">
            <Stepper
              label={ui.request.people}
              value={count}
              min={2}
              max={200}
              onChange={setCount}
              addLabel={`${common.a11y.increase}: ${ui.request.people}`}
              removeLabel={`${common.a11y.decrease}: ${ui.request.people}`}
            />
          </div>
          {(
            [
              ['name', contact.form.name, 'text', 'name'],
              ['email', contact.form.email, 'email', 'email'],
              ['phone', ui.request.phone, 'tel', 'tel'],
            ] as const
          ).map(([k, label, type, ac]) => (
            <div key={k}>
              <label className="label" htmlFor={`cr-${k}`}>
                {label}
              </label>
              <input
                id={`cr-${k}`}
                type={type}
                autoComplete={ac}
                className={`field ${errors[k] ? 'ring-2 ring-terra' : ''}`}
                value={form[k]}
                onChange={(e) => {
                  setForm({ ...form, [k]: e.target.value })
                  if (errors[k]) setErrors({ ...errors, [k]: '' })
                }}
                aria-invalid={!!errors[k]}
                aria-describedby={errors[k] ? `cr-${k}-err` : undefined}
              />
              {errors[k] && (
                <p id={`cr-${k}-err`} className="mt-1 text-[0.8rem] text-terra-deep">
                  {errors[k]}
                </p>
              )}
            </div>
          ))}
          <div>
            <label className="label" htmlFor="cr-message">
              {contact.form.message}
            </label>
            <textarea id="cr-message" rows={3} className="field resize-none" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary w-full py-4">
            {common.cta.sendRequest} <ArrowRight className="h-4 w-4" />
          </button>
          <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-[0.88rem] font-semibold text-sea-deep hover:text-ink">
            <MessageCircle className="h-4 w-4" /> {ui.request.whatsapp}
          </a>
        </form>
      )}
    </div>
  )
}
