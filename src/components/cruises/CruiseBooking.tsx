'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, FlaskConical, Loader2, Lock, MapPin, MessageCircle, Ship, Ticket, X } from 'lucide-react'
import { SingleDateCalendar } from '@/components/ui/DateRange'
import { Stepper } from '@/components/ui/Popover'
import type { Cruise } from '@/data/cruises'
import { cruises, sortWeekdays } from '@/data/cruises'
import { whatsappLink } from '@/data/site'
import enBooking from '@/content/en/booking.json'
import elBooking from '@/content/el/booking.json'
import itBooking from '@/content/it/booking.json'
import enPayments from '@/content/en/payments.json'
import elPayments from '@/content/el/payments.json'
import itPayments from '@/content/it/payments.json'
import { isEmail, isPhone, pickupTimes, postJson, refreshSchedule, useAvailability, useSchedule, type ApiError } from '@/lib/cruiseStore'
import { fromISO, SEASON_END, SEASON_START, toISO } from '@/lib/dates'
import { fill, formatDate, formatPrice, href, listFormat, locales, tr, weekdayName, type Dict, type Locale } from '@/lib/i18n'
import { quoteEuros } from '@/server/cruises/pricing'

type Step = 'select' | 'details' | 'pay'
type Pickup = 'skala' | 'poros'

/** Cruise-booking strings that live in booking.json → "cruise" (the page passes only cruises.booking). */
const CRUISE_UI: Record<Locale, Dict> = { en: enBooking.cruise, el: elBooking.cruise, it: itBooking.cruise }
/** Pay-step strings and API error messages (payments.json → checkout, errors, labels). */
const PAY_UI: Record<Locale, Dict> = {
  en: { checkout: enPayments.checkout, errors: enPayments.errors, labels: enPayments.labels },
  el: { checkout: elPayments.checkout, errors: elPayments.errors, labels: elPayments.labels },
  it: { checkout: itPayments.checkout, errors: itPayments.errors, labels: itPayments.labels },
}

/** The cards Alpha Bank e-Commerce accepts (facts.md, "Booking engine and payments"). */
const CARDS = 'Visa · Mastercard · Maestro · American Express · Diners · Discover'

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

/** API error → sentence from payments.json → errors (the table in src/server/README.md). */
export function apiErrorText(errors: Dict, body: ApiError | null) {
  switch (body?.error) {
    case 'not_enough_seats':
      return body.left === 1 ? errors.notEnoughSeatsOne : fill(errors.notEnoughSeats, { count: body.left ?? 0 })
    case 'departure_unavailable':
      return body.status === 'soldout' ? errors.soldOut : body.status === 'cancelled' ? errors.cancelled : body.status === 'closed' ? errors.closed : errors.unavailable
    case 'pickup_unavailable':
      return errors.pickupUnavailable
    case 'validation':
      return body.fields?.includes('acceptTerms') ? errors.termsRequired : errors.validation
    case 'rate_limited':
      return errors.rateLimited
    case 'payments_unavailable':
      return errors.paymentsUnavailable
    case 'already_paid':
      return errors.alreadyPaid
    case 'not_payable':
      return errors.notPayable
    default:
      return errors.generic
  }
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
/** Saves the draft, or removes it when `value` is null. */
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

/**
 * The last booking this visitor started (this tab only): if they come back from the payment page, or open the cruise
 * again, they can go straight to it. The ticket page shows whatever state it is in (paid, waiting for payment, expired).
 */
type Pending = { cruise: string; ref: string; date: string; ticketUrl: string; at: number }
/** 201 answer of POST /api/cruises/bookings */
type Created = { ref: string; ticketUrl: string; payment: { provider: string; redirectUrl: string } }
const PENDING_KEY = 'cv-cruise-booking'
function readPending(cruise: string): Pending | null {
  const p = readDraft<Pending>(PENDING_KEY)
  if (!p || p.cruise !== cruise || typeof p.ref !== 'string' || typeof p.ticketUrl !== 'string' || !p.ticketUrl.startsWith('/')) return null
  if (typeof p.at !== 'number' || Date.now() - p.at > 24 * 3600 * 1000) return null
  return p as Pending
}

// ----- Scheduled cruises ------------------------------------------------------------------------

export function CruiseBooking({ cruise, locale, t, common, name, ui: uiProp }: { cruise: Cruise; locale: Locale; t: Dict; common: Dict; name: string; ui?: Dict }) {
  const ui = uiProp ?? CRUISE_UI[locale]
  const p = PAY_UI[locale]
  const schedule = useSchedule()
  const { departures, ready, refresh } = useAvailability(cruise.key, schedule)
  const cfg = schedule.config[cruise.key]
  const byIso = useMemo(() => new Map(departures.map((d) => [d.iso, d])), [departures])
  const dates = useMemo(() => departures.map((d) => d.date), [departures])
  const times = pickupTimes(cruise, cfg)
  const seasonStart = fromISO(schedule.season.start) ?? SEASON_START
  const seasonEnd = fromISO(schedule.season.end) ?? SEASON_END

  const firstOpen = departures.find((d) => d.status === 'open')?.date
  const [date, setDate] = useState<Date | undefined>()
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [pickup, setPickup] = useState<Pickup>('skala')
  const [guest, setGuest] = useState(false)
  const [second, setSecond] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [form, setForm] = useState({ name: '', email: '', phone: '', hotel: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [accepted, setAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)
  const [busy, setBusy] = useState(false)
  /** an answer from the server that the guest must read: { text, back: offer "choose another date" } */
  const [notice, setNotice] = useState<{ text: string; back?: boolean } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  // the month the guest paged the calendar to (null: the month it opened on), for the legend under the calendar
  const [viewMonth, setViewMonth] = useState<Date | null>(null)
  useEffect(() => setViewMonth(null), [ready])

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
    setPending(readPending(cruise.key))
    setRestored(true)
  }, [key, cruise.key])
  useEffect(() => {
    if (!restored) return
    writeDraft(key, { date: date ? toISO(date) : undefined, adults, children, infants, pickup, guest, second, form, step })
  }, [restored, key, date, adults, children, infants, pickup, guest, second, form, step])

  // back from the payment page through the browser's back button: the page may come back from the cache as it was left
  useEffect(() => {
    const on = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setBusy(false)
      setPending(readPending(cruise.key))
      refresh()
    }
    window.addEventListener('pageshow', on)
    return () => window.removeEventListener('pageshow', on)
  }, [cruise.key, refresh])

  // each step change removes the button that was pressed: move focus to the new step's heading
  // (compared with the previous step rather than a "first run" flag, which React's development double run would trip)
  const prevStep = useRef(step)
  useEffect(() => {
    if (prevStep.current === step) return
    prevStep.current = step
    // the seats may have changed while the guest was reading: check again on every step
    refresh()
    if (quietFocus.current) {
      quietFocus.current = false
      return
    }
    return focusStep(`cb-step-${step}`, { scroll: true })
  }, [step, refresh])

  // an answer from the server appears above the summary: bring it into view, as the guest's eyes are on the pay button
  useEffect(() => {
    if (!notice) return
    const id = requestAnimationFrame(() => {
      const el = document.getElementById('cb-notice')
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [notice])

  const st = date ? byIso.get(toISO(date)) : undefined
  const prices = { adult: cfg?.adult ?? cruise.prices!.adult, child: cfg?.child ?? cruise.prices!.child }
  // the same rounding as the server (src/server/cruises/pricing.ts): the larger discount applies, never both
  const quote = quoteEuros(prices, { adults, children }, guest, second)
  const discountLabel = guest ? p.labels.discount.guest20 : p.labels.discount.second15
  // infants travel free but take a place on board (the boat's licence counts every passenger)
  const seats = adults + children + infants
  const isOpen = st?.status === 'open'
  // seats are unknown (null) only when the API could not be reached: the server checks them when the guest pays
  const enough = st ? st.left == null || st.left >= seats : false
  // also blocked when the date is no longer on the schedule (the Captain changed the sailing days meanwhile)
  const blocked = !!date && ready && (!st || !isOpen || !enough)
  const where: Pickup = times.hasPoros ? pickup : 'skala'
  const notSailing = ready && (!cfg?.active || departures.length === 0)
  const paymentsOff = schedule.payments === null

  const isoSet = (status: string) => departures.filter((d) => d.status === status).map((d) => d.date)
  const few = departures.filter((d) => d.status === 'open' && d.left != null && d.left < 25).map((d) => d.date)
  // the calendar opens on the chosen date, else the first day with seats (it is re-created once the departures load)
  const openingMonth = (isOpen && date) || firstOpen || seasonStart
  const shownMonth = viewMonth ?? openingMonth
  const inShownMonth = (d: Date) => d.getFullYear() === shownMonth.getFullYear() && d.getMonth() === shownMonth.getMonth()
  // a legend only for what the month on screen shows: red strike-through (cancelled) and red (fully booked) days
  const legend = [isoSet('cancelled').some(inShownMonth) && p.checkout.cancelledLegend, isoSet('soldout').some(inShownMonth) && p.checkout.soldOutLegend].filter(Boolean) as string[]

  // "Only 1 seat left", not "Only 1 seats left": the …One keys take the singular, the plural keys stay the fallback
  const notEnoughText = (left: number) => fill((left === 1 && ui.notEnoughOne) || ui.notEnough, { count: left })
  const seatsText = (left: number) => {
    const k = left < 25 ? 'fewLeft' : 'seatsLeft'
    return left === 1 && typeof t[`${k}One`] === 'string' ? fill(t[`${k}One`], { count: left }) : tr(t, k, { count: left })
  }
  const unavailableText = (s?: typeof st) => (s?.status === 'cancelled' ? t.cancelledNote : s?.status === 'soldout' ? t.soldOut : s?.status === 'closed' ? ui.closed : ui.unavailable)

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = common.errors.required
    if (!isEmail(form.email)) e.email = common.errors.email
    if (!isPhone(form.phone)) e.phone = common.errors.phone
    setErrors(e)
    const first = (['name', 'email', 'phone'] as const).find((k) => e[k])
    if (first) requestAnimationFrame(() => document.getElementById(`cb-${first}`)?.focus())
    return !first
  }

  const chooseAnother = () => {
    setNotice(null)
    setStep('select')
  }

  /** Creates the booking (the server holds the seats for 15 minutes) and goes to the payment page. */
  const pay = async () => {
    if (!date || busy) return
    if (!accepted) {
      setTermsError(true)
      requestAnimationFrame(() => document.getElementById('cb-terms')?.focus())
      return
    }
    setBusy(true)
    setNotice(null)
    let res: Awaited<ReturnType<typeof postJson<Created>>>
    try {
      res = await postJson<Created>('/api/cruises/bookings', {
        cruise: cruise.key,
        date: toISO(date),
        adults,
        children,
        infants,
        pickup: where,
        guest,
        second,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        hotel: form.hotel.trim() || null,
        notes: form.notes.trim() || null,
        lang: locale,
        acceptTerms: true,
        expectedTotal: quote.total,
      })
    } catch {
      setNotice({ text: p.errors.generic })
      setBusy(false)
      return
    }
    const body = res.body
    if (res.ok && body?.payment?.redirectUrl && body.ticketUrl) {
      const entry: Pending = { cruise: cruise.key, ref: body.ref, date: toISO(date), ticketUrl: body.ticketUrl, at: Date.now() }
      writeDraft(PENDING_KEY, entry)
      // coming back to this page later starts from the first step, with the guest's choices and details kept
      writeDraft(key, { date: toISO(date), adults, children, infants, pickup, guest, second, form, step: 'select' })
      window.location.assign(body.payment.redirectUrl)
      return
    }
    setBusy(false)
    const code = body?.error
    if (code === 'not_enough_seats' || code === 'departure_unavailable') {
      refresh()
      setNotice({ text: apiErrorText(p.errors, body), back: true })
    } else if (code === 'price_changed') {
      // load the new fares: the total on the button follows, and the guest presses pay again
      refreshSchedule(0)
      setNotice({ text: fill(p.errors.priceChanged, { amount: formatPrice(locale, body?.total ?? quote.total) }) })
    } else if (code === 'pickup_unavailable') {
      setPickup('skala')
      setNotice({ text: p.errors.pickupUnavailable })
    } else if (code === 'validation' && body?.fields?.some((f) => f === 'name' || f === 'email' || f === 'phone')) {
      const e: Record<string, string> = {}
      if (body.fields.includes('name')) e.name = common.errors.required
      if (body.fields.includes('email')) e.email = common.errors.email
      if (body.fields.includes('phone')) e.phone = common.errors.phone
      setErrors(e)
      setStep('details')
    } else if (code === 'validation' && body?.fields?.includes('acceptTerms')) {
      setTermsError(true)
    } else {
      setNotice({ text: apiErrorText(p.errors, body) })
    }
  }

  const days = listFormat(locale, sortWeekdays(cfg?.weekdays ?? cruise.weekdays).map((w) => weekdayName(locale, w)))
  const pickupLabel = (pk: Pickup) => `${ui[pk]} · ${times[pk].depart}`

  const blockedBanner = (blocked || notice) && (
    <div id={notice ? 'cb-notice' : undefined} tabIndex={notice ? -1 : undefined} className="rounded-xl bg-terra-light p-4 text-[0.88rem] text-terra-deep outline-none" role="alert">
      <p className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {notice ? notice.text : isOpen ? notEnoughText(st!.left ?? 0) : unavailableText(st)}
      </p>
      {(!notice || notice.back) && (
        <button type="button" onClick={chooseAnother} className="btn btn-ghost mt-3 bg-white py-2.5">
          <ArrowLeft className="h-4 w-4" /> {ui.chooseAnother}
        </button>
      )}
    </div>
  )

  const pendingBanner = pending && (
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-sea-mist px-4 py-3 text-[0.88rem] text-sea-deep">
      <Ticket className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>{fill(p.checkout.inProgress, { ref: pending.ref, date: fromISO(pending.date) ? formatDate(locale, fromISO(pending.date)!, { weekday: 'long', day: 'numeric', month: 'long' }) : pending.date })}</p>
        <a href={pending.ticketUrl} className="mt-1 inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
          {p.checkout.openBooking} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          writeDraft(PENDING_KEY, null)
          setPending(null)
        }}
        aria-label={p.checkout.dismiss}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/60"
      >
        <X className="h-4 w-4" />
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
              {pendingBanner}
              {notice && (
                <p id="cb-notice" tabIndex={-1} className="mb-4 flex gap-2 rounded-xl bg-terra-light px-4 py-3 text-[0.88rem] font-medium text-terra-deep outline-none" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {notice.text}
                </p>
              )}
              <p id="cb-step-select" tabIndex={-1} className="label outline-none">
                {t.date}
              </p>
              <div className={`-mx-2 flex justify-center max-[380px]:[&_.cv-daypicker]:[--rdp-cell-size:38px] ${CAL_COLOURS}`}>
                <SingleDateCalendar
                  // opens on the first sailing day with seats once the departures have loaded
                  key={ready ? 'ready' : 'loading'}
                  locale={locale}
                  value={isOpen ? date : undefined}
                  onChange={(d) => {
                    setDate(d)
                    setNotice(null)
                  }}
                  fromDate={seasonStart}
                  toDate={seasonEnd}
                  defaultMonth={openingMonth}
                  onMonthChange={setViewMonth}
                  disabled={(d) => byIso.get(toISO(d))?.status !== 'open'}
                  modifiers={{ sailing: dates, cancelled: isoSet('cancelled'), soldout: isoSet('soldout'), few }}
                  modifiersClassNames={{ sailing: 'day-sailing', cancelled: 'day-cancelled', soldout: 'day-soldout', few: 'day-few' }}
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
                  <p className={`mt-1 rounded-xl px-4 py-2.5 text-[0.88rem] font-medium ${!enough || (st.left != null && st.left < 25) ? 'bg-terra-light text-terra-deep' : 'bg-sea-mist text-sea-deep'}`}>
                    {formatDate(locale, st.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                    {st.left != null && <> · {enough ? seatsText(st.left) : notEnoughText(st.left)}</>}
                  </p>
                ) : (
                  <p className="mt-1 flex gap-2 rounded-xl bg-terra-light px-4 py-2.5 text-[0.88rem] font-medium text-terra-deep" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {formatDate(locale, st.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {unavailableText(st)}
                    </span>
                  </p>
                ))}
              {/* a selected cancelled or full day already gets its own alert above; this only explains the colours */}
              {legend.length > 0 && (
                <p className="mt-3 flex gap-2 text-[0.8rem] text-ink-mute">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-terra" aria-hidden="true" /> <span>{legend.join(' ')}</span>
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
                    {adults} × {formatPrice(locale, prices.adult)}
                    {children ? ` + ${children} × ${formatPrice(locale, prices.child)}` : ''}
                  </dt>
                  <dd className="tabular-nums">{formatPrice(locale, quote.subtotal)}</dd>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between gap-4 text-sea">
                    <dt>
                      {t.discount} −{quote.percent}%
                    </dt>
                    <dd className="tabular-nums">−{formatPrice(locale, quote.discount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                  <dt className="font-semibold">{t.total}</dt>
                  <dd className="font-display text-3xl tabular-nums">{formatPrice(locale, quote.total)}</dd>
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
                    maxLength={k === 'email' ? 160 : 120}
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
                <textarea id="cb-notes" rows={3} maxLength={1000} className="field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary w-full py-4">
                {t.next} <ArrowRight className="h-4 w-4" />
              </button>
            </m.form>
          )}

          {step === 'pay' && date && (
            <m.div key="pay" data-step initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 p-5 sm:p-6">
              <button type="button" onClick={() => setStep('details')} disabled={busy} className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-ink-mute hover:text-ink">
                <ArrowLeft className="h-4 w-4" /> {common.cta.back}
              </button>
              {pendingBanner}
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
                <dl className="mt-3 space-y-1 border-t border-ink/10 pt-3">
                  {quote.discount > 0 && (
                    <div className="flex justify-between gap-4 text-sea">
                      <dt>{discountLabel}</dt>
                      <dd className="tabular-nums">−{formatPrice(locale, quote.discount)}</dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-semibold">{t.total}</dt>
                    <dd className="font-display text-2xl tabular-nums">{formatPrice(locale, quote.total)}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2.5 rounded-2xl p-4 text-[0.82rem] text-ink-soft ring-1 ring-ink/10">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-mute">{CARDS}</span>
                  <Lock className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />
                </div>
                <p>{p.checkout.secure}</p>
                <p className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" /> {p.checkout.hold}
                </p>
              </div>

              {schedule.payments === 'mock' && (
                <p className="flex items-start gap-2 rounded-xl bg-sun-light px-3.5 py-2.5 text-[0.82rem] font-medium text-ink">
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {p.checkout.testMode}
                </p>
              )}

              {paymentsOff ? (
                <div className="rounded-xl bg-terra-light p-4 text-[0.88rem] text-terra-deep" role="alert">
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {p.errors.paymentsUnavailable}
                  </p>
                  <a href={whatsappLink(fill(ui.askMessage, { name }))} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-3 bg-white py-2.5">
                    <MessageCircle className="h-4 w-4" /> {common.cta.whatsapp}
                  </a>
                </div>
              ) : (
                <>
                  <div>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${termsError ? 'ring-2 ring-terra' : accepted ? 'bg-sea-mist/60 ring-sea/40' : 'ring-ink/10 hover:bg-sand'}`}>
                      <input
                        id="cb-terms"
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => {
                          setAccepted(e.target.checked)
                          if (e.target.checked) setTermsError(false)
                        }}
                        aria-invalid={termsError}
                        aria-describedby={termsError ? 'cb-terms-err' : undefined}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F2430]"
                      />
                      <span className="text-[0.86rem] text-ink-soft">
                        <TermsLink locale={locale} sentence={p.checkout.acceptTerms} phrase={p.checkout.termsLink} external={common.a11y.external} />
                      </span>
                    </label>
                    {termsError && (
                      <p id="cb-terms-err" className="mt-1 text-[0.8rem] text-terra-deep">
                        {p.errors.termsRequired}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={pay} disabled={blocked || busy} aria-busy={busy} className="btn btn-sea w-full py-4">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    {busy ? p.checkout.redirecting : fill(p.checkout.pay, { amount: formatPrice(locale, quote.total) })}
                  </button>
                  {busy && (
                    <p className="sr-only" role="status">
                      {p.checkout.redirecting}
                    </p>
                  )}
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

/** The words of the terms sentence that link to /terms when no termsLink key gives them. */
const TERMS_PHRASE: Record<Locale, string> = { en: 'booking terms', el: 'όρους κράτησης', it: 'condizioni di prenotazione' }

/** "I have read and accept the booking terms." with the terms words linked (or the whole sentence when they are not found). */
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

const ON_REQUEST = ['bbq', 'private', 'wedding'] as const
type OnRequest = (typeof ON_REQUEST)[number]

/**
 * Request form for cruises that only run on request. The request goes to the booking API (the owner sees it in /admin,
 * the guest gets an acknowledgement e-mail in their language) and can also go straight to WhatsApp.
 */
export function CruiseRequest({ locale, t, common, contact, cruise: cruiseProp, ui: uiProp }: { locale: Locale; t: Dict; common: Dict; contact: Dict; cruise?: Cruise; ui?: Dict }) {
  const ui = uiProp ?? CRUISE_UI[locale]
  const p = PAY_UI[locale]
  const pathname = usePathname()
  const found = cruiseProp?.key ?? cruises.find((c) => pathname?.replace(/\/$/, '').endsWith(`/${c.slug}`))?.key
  const cruiseKey: OnRequest = (ON_REQUEST as readonly string[]).includes(found ?? '') ? (found as OnRequest) : 'private'
  const [sent, setSent] = useState<{ ref: string } | null>(null)
  const [date, setDate] = useState<Date | undefined>()
  const [count, setCount] = useState(10)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const kind: string = (ui.request.kinds as Record<string, string>)[cruiseKey] ?? ui.request.kinds.private
  const dateLong = date ? formatDate(locale, date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const waText = date ? fill(ui.request.message, { kind, date: dateLong, count }) : fill(ui.request.messageNoDate, { kind, count })

  const submit = async () => {
    if (busy) return
    const e: Record<string, string> = {}
    if (!date) e.date = ui.request.dateError
    if (form.name.trim().length < 2) e.name = common.errors.required
    if (!isEmail(form.email)) e.email = common.errors.email
    if (!isPhone(form.phone)) e.phone = common.errors.phone
    setErrors(e)
    setFailure('')
    const first = (['date', 'name', 'email', 'phone'] as const).find((k) => e[k])
    if (first) {
      requestAnimationFrame(() => {
        const el = first === 'date' ? document.getElementById('cr-date') : document.getElementById(`cr-${first}`)
        el?.focus()
        if (first === 'date') el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    setBusy(true)
    try {
      const res = await postJson<{ ref: string }>('/api/cruises/requests', {
        cruise: cruiseKey,
        date: date ? toISO(date) : null,
        people: count,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim() || null,
        lang: locale,
      })
      if (res.ok && res.body?.ref) setSent({ ref: res.body.ref })
      else setFailure(apiErrorText(p.errors, res.body))
    } catch {
      setFailure(p.errors.generic)
    }
    setBusy(false)
  }

  return (
    <div id="book" className="scroll-mt-32 overflow-hidden rounded-xl3 bg-white shadow-lift ring-1 ring-ink/5">
      <div className="bg-ink px-6 py-5 text-white">
        <p className="font-display text-xl">{common.cta.sendRequest}</p>
        <p className="text-[0.85rem] text-white/65">{t.requestOnly}</p>
      </div>
      {sent ? (
        <div className="p-6 text-center sm:p-8" role="status">
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
                maxLength={k === 'email' ? 160 : 120}
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
            <textarea id="cr-message" rows={3} maxLength={2000} className="field resize-none" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          {failure && (
            <p className="flex gap-2 rounded-xl bg-terra-light px-4 py-3 text-[0.88rem] font-medium text-terra-deep" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {failure}
            </p>
          )}
          <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary w-full py-4">
            {common.cta.sendRequest} {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" />}
          </button>
          <a href={whatsappLink(waText)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-[0.88rem] font-semibold text-sea-deep hover:text-ink">
            <MessageCircle className="h-4 w-4" /> {ui.request.whatsapp}
          </a>
        </form>
      )}
    </div>
  )
}
