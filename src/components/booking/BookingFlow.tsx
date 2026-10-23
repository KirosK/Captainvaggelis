'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowLeft, ArrowRight, BedDouble, Car, Check, ChevronDown, Lock, MessageCircle, ShieldCheck, Users } from 'lucide-react'
import { DateRangeCalendar, type Range } from '@/components/ui/DateRange'
import { Stepper } from '@/components/ui/Popover'
import { DemoCard, draftKey, focusStep, readDraft, writeDraft } from '@/components/cruises/CruiseBooking'
import { featureIcon } from '@/components/ui/featureIcons'
import { altFor } from '@/data/alts'
import { priceStay, properties, unitByKey, unitGroups } from '@/data/properties'
import { whatsappLink } from '@/data/site'
import type { PropertyKey, UnitGroup } from '@/data/types'
import { isEmail, isPhone, makeRef, useStore, type StayRequest } from '@/lib/cruiseStore'
import { fromISO, nightsBetween, SEASON_END, SEASON_START, seeded, toISO } from '@/lib/dates'
import { countLabel, fill, formatDate, formatPrice, href, tr, type Dict, type Locale } from '@/lib/i18n'

type Step = 'stay' | 'room' | 'details' | 'payment' | 'done'
const STEPS: Step[] = ['stay', 'room', 'details', 'payment', 'done']
const MAX_ADULTS = 6
const MAX_CHILDREN = 4
/** The largest unit (Theodora's two-bedroom apartment) and the most adults a Theodora unit takes. */
const LARGEST = Math.max(...unitGroups.map((u) => u.maxGuests))
const MOST_ADULTS_THEODORA = Math.max(...unitGroups.filter((u) => u.property === 'theodora').map((u) => u.maxAdults))

/** DEMO availability: a stable share of room types is "full" for some dates. */
function available(u: UnitGroup, from: Date) {
  return seeded(`${u.key}:${toISO(from)}`) > 0.18
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

/** The first day a stay can start: today or the first day of the season, whichever is later. */
function firstBookable() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today > SEASON_START ? today : SEASON_START
}

/** A stay is bookable when it starts on or after the first bookable day, ends inside the season and lasts at least one night. */
function validStay(from?: Date, to?: Date) {
  return !!(from && to && from >= firstBookable() && to <= SEASON_END && to > from)
}

/** Dates from the URL (home booking bar, language switch): anything outside the season, in the past or reversed is dropped. */
function initialRange(fromS?: string | null, toS?: string | null): Range | undefined {
  const from = fromISO(fromS)
  const to = fromISO(toS)
  if (!from || from < firstBookable() || from >= SEASON_END) return undefined
  return { from, to: validStay(from, to) ? to : undefined }
}

const FORM_KEYS = ['firstName', 'lastName', 'email', 'phone'] as const
type Form = { firstName: string; lastName: string; email: string; phone: string; country: string; arrival: string; requests: string; taxi: boolean }
type StayDraft = { form: Partial<Form>; step: Step; payPlan: 'deposit' | 'full' }

export function BookingFlow({ locale, t, common, units, bothLabel }: { locale: Locale; t: Dict; common: Dict; units: Dict; bothLabel: string }) {
  const sp = useSearchParams()
  const q = (k: string) => sp?.get(k) ?? undefined
  const preUnit = q('unit') ? unitByKey(q('unit')!) : undefined
  const qProperty = q('property')
  const [property, setProperty] = useState<PropertyKey | 'both'>(
    qProperty === 'aegealis' || qProperty === 'theodora' || qProperty === 'both' ? qProperty : preUnit?.property ?? 'both',
  )
  const [range, setRange] = useState<Range | undefined>(() => initialRange(q('from'), q('to')))
  const [adults, setAdults] = useState(() => clamp(Number(q('adults')) || 2, 1, MAX_ADULTS))
  const [children, setChildren] = useState(() => clamp(Number(q('children')) || 0, 0, MAX_CHILDREN))
  const [unitKey, setUnitKey] = useState<string | undefined>(preUnit?.key)
  const [step, setStep] = useState<Step>(() => {
    const r = initialRange(q('from'), q('to'))
    return q('step') === 'room' && validStay(r?.from, r?.to) ? 'room' : 'stay'
  })
  const [form, setForm] = useState<Form>({ firstName: '', lastName: '', email: '', phone: '', country: '', arrival: '', requests: '', taxi: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [payPlan, setPayPlan] = useState<'deposit' | 'full'>('deposit')
  const [done, setDone] = useState<StayRequest | null>(null)
  const { update } = useStore()

  // each step change removes the button that was pressed: scroll up and move focus to the new step's heading
  // (compared with the previous step rather than a "first run" flag, which React's development double run would trip)
  const prevStep = useRef(step)
  const quietFocus = useRef(false)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (prevStep.current === step) return
    prevStep.current = step
    if (quietFocus.current) {
      quietFocus.current = false
      return
    }
    return focusStep(`bf-step-${step}`)
  }, [step])

  const guests = adults + children
  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0
  const canSearch = validStay(range?.from, range?.to)

  const options = useMemo(
    () =>
      unitGroups
        .filter((u) => (property === 'both' ? true : u.property === property))
        .map((u) => {
          const fitsTotal = u.maxGuests >= guests
          const fitsAdults = adults <= u.maxAdults
          return {
            u,
            fits: fitsTotal && fitsAdults,
            reason: !fitsTotal ? ('tooMany' as const) : !fitsAdults ? ('adults' as const) : null,
            free: range?.from ? available(u, range.from) : true,
          }
        })
        .sort((a, b) => Number(b.fits && b.free) - Number(a.fits && a.free) || a.u.demoRates.low - b.u.demoRates.low),
    [property, guests, adults, range?.from],
  )

  // The chosen unit only counts while it still matches the property, the group and the dates.
  const unit = options.find((o) => o.u.key === unitKey && o.fits && o.free)?.u
  const price = unit && range?.from && range?.to ? priceStay(unit, range.from, range.to) : null
  const deposit = price ? Math.round(price.total * 0.3) : 0
  const noneFit = options.every((o) => !o.fits)

  // The details typed in (and the step) survive a language switch, which reloads the page with the same query string.
  // Card fields are never kept. The draft is cleared once the booking is made.
  const pathname = usePathname()
  const key = draftKey('cv-stay', pathname)
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    const d = readDraft<StayDraft>(key)
    if (d) {
      const f = d.form ?? {}
      const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : '')
      setForm({
        firstName: str(f.firstName), lastName: str(f.lastName), email: str(f.email), phone: str(f.phone), country: str(f.country),
        arrival: /^\d{2}:\d{2}$/.test(str(f.arrival)) ? str(f.arrival) : '', requests: str(f.requests), taxi: f.taxi === true,
      })
      if (d.payPlan === 'deposit' || d.payPlan === 'full') setPayPlan(d.payPlan)
      // back to the details or payment step only while the room and dates in the URL still hold
      if ((d.step === 'details' || d.step === 'payment') && unit && price) {
        quietFocus.current = true
        setStep(d.step)
      }
    }
    setRestored(true)
    // runs once on arrival; unit and price come from the URL at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    if (!restored) return
    if (step === 'done') writeDraft(key, null)
    else writeDraft(key, { form, step, payPlan } satisfies StayDraft)
  }, [restored, key, form, step, payPlan])

  // Mirror the choices into the URL, so the language switcher (which keeps the query string) and a reload keep them.
  useEffect(() => {
    const p = new URLSearchParams()
    if (step !== 'done') {
      // "both" is written only next to a chosen room, which would otherwise preselect that room's property
      if (property !== 'both' || unit) p.set('property', property)
      if (range?.from) p.set('from', toISO(range.from))
      if (range?.to) p.set('to', toISO(range.to))
      p.set('adults', String(adults))
      if (children) p.set('children', String(children))
      if (unit) p.set('unit', unit.key)
      if (step !== 'stay' && canSearch) p.set('step', 'room')
    }
    const qs = p.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      try {
        window.history.replaceState(window.history.state, '', next)
      } catch {}
    }
  }, [property, range?.from, range?.to, adults, children, unit, step, canSearch])

  const stepIndex = STEPS.indexOf(step)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = common.errors.required
    if (!form.lastName.trim()) e.lastName = common.errors.required
    if (!isEmail(form.email)) e.email = common.errors.email
    if (!isPhone(form.phone)) e.phone = common.errors.phone
    setErrors(e)
    const first = FORM_KEYS.find((k) => e[k])
    if (first) requestAnimationFrame(() => document.getElementById(`bf-${first}`)?.focus())
    return !first
  }

  const finish = () => {
    if (!unit || !range?.from || !range?.to || !price) return
    const paidNow = payPlan === 'deposit' ? deposit : price.total
    const r: StayRequest = {
      ref: makeRef(unit.property === 'aegealis' ? 'AG' : 'TH'),
      property: unit.property,
      unit: unit.key,
      from: toISO(range.from),
      to: toISO(range.to),
      adults,
      children,
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      email: form.email.trim(),
      phone: form.phone.trim(),
      total: price.total,
      country: form.country.trim() || undefined,
      arrival: form.arrival || undefined,
      requests: form.requests.trim() || undefined,
      taxi: form.taxi,
      payPlan,
      paidNow,
      lang: locale,
      createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, stays: [r, ...s.stays] }))
    setDone(r)
    setStep('done')
  }

  /** "1 adult" / "2 adults", "1 child" / "3 children" */
  const people = (n: number, kind: 'adult' | 'child') => tr(t, `cruise.count.${n === 1 ? kind : kind === 'adult' ? 'adults' : 'children'}`, { count: n })

  const dateText = (from: Date, to: Date) =>
    `${formatDate(locale, from, { day: 'numeric', month: 'short' })} – ${formatDate(locale, to, { day: 'numeric', month: 'short', year: 'numeric' })}`

  /** Booking summary: dates, nights and guests always; the room and the price once a room is chosen. */
  const summaryRows = (opts: { paid?: boolean } = {}) => (
    <dl className="space-y-2 text-[0.9rem]">
      {range?.from && range?.to && (
        <div className="flex justify-between gap-4">
          <dt className="text-ink-mute">{t.summary.dates}</dt>
          <dd className="text-right">{dateText(range.from, range.to)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-ink-mute">{t.summary.nights}</dt>
        <dd className="tabular-nums">{nights}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-mute">{t.summary.guests}</dt>
        <dd className="text-right">
          {children ? `${people(adults, 'adult')} · ${people(children, 'child')}` : countLabel(common, 'guest', guests)}
        </dd>
      </div>
      {price && (
        <>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold">{t.summary.total}</dt>
            <dd className="font-display text-2xl tabular-nums">{formatPrice(locale, price.total)}</dd>
          </div>
          {(payPlan === 'deposit' || opts.paid) && (
            <>
              <div className="flex justify-between gap-4 text-sea">
                <dt>{opts.paid ? t.summary.paid : t.summary.deposit}</dt>
                <dd className="tabular-nums">{formatPrice(locale, payPlan === 'deposit' ? deposit : price.total)}</dd>
              </div>
              {payPlan === 'deposit' && (
                <div className="flex justify-between gap-4 text-ink-mute">
                  <dt>{t.summary.onArrival}</dt>
                  <dd className="tabular-nums">{formatPrice(locale, price.total - deposit)}</dd>
                </div>
              )}
            </>
          )}
        </>
      )}
    </dl>
  )

  const unitHeader = (u: UnitGroup, size: 'sm' | 'md' = 'md') => (
    <div className="flex gap-4">
      <span className={`relative shrink-0 overflow-hidden rounded-xl ${size === 'sm' ? 'h-14 w-16' : 'h-20 w-24'}`}>
        <Image src={(u.photos[0] ?? properties[u.property].hero).src} alt="" fill sizes="96px" className="object-cover" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight">{units[u.key].name}</p>
        <p className="text-[0.85rem] text-ink-mute">{properties[u.property].name}</p>
      </div>
    </div>
  )

  const summaryCard = (
    <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.summary.title}</p>
      <div className="mt-4">
        {unit ? (
          unitHeader(unit)
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/20 px-4 py-5 text-[0.9rem] text-ink-mute">
            <BedDouble className="h-5 w-5 shrink-0 text-ink-mute" /> {t.summary.chooseRoom}
          </div>
        )}
      </div>
      <div className="mt-5">{summaryRows()}</div>
    </div>
  )

  const groupMessage =
    range?.from && range?.to
      ? fill(t.group.message, { count: guests, from: formatDate(locale, range.from, { day: 'numeric', month: 'long' }), to: formatDate(locale, range.to, { day: 'numeric', month: 'long' }) })
      : t.group.messageMany
  // at Aegealis a group of 5 fits Theodora's two-bedroom apartment: offer the switch when it is free on these dates
  const aegealisGroup = property === 'aegealis' && guests <= LARGEST && adults <= MOST_ADULTS_THEODORA
  const canSwitchToTheodora =
    aegealisGroup && unitGroups.some((u) => u.property === 'theodora' && u.maxGuests >= guests && u.maxAdults >= adults && (!range?.from || available(u, range.from)))

  return (
    <div className={`container pt-[calc(var(--header-h)+var(--banner-h,0px)+2.5rem)] ${step === 'room' && unit ? 'pb-36 md:pb-24' : 'pb-24'}`}>
      <div className="max-w-3xl">
        <h1 id="bf-step-stay" tabIndex={-1} className="font-display text-display-lg font-light outline-none">
          {t.title}
        </h1>
        <p className="mt-3 text-[1.05rem] text-ink-soft">{t.intro}</p>
      </div>

      {step !== 'done' && (
        <div className="mt-10">
          <ol className="flex gap-2" aria-label={common.a11y.steps}>
            {STEPS.slice(0, 4).map((s, i) => (
              <li key={s} className="relative min-w-0 flex-1">
                <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                  <m.div className="h-full bg-sea" initial={false} animate={{ width: i <= stepIndex ? '100%' : '0%' }} transition={{ duration: 0.6 }} />
                </div>
                {/* phones: the labels stay for screen readers only, and the line below names the current step */}
                <p className={`sr-only text-[0.78rem] font-semibold leading-snug sm:not-sr-only sm:mt-2 sm:block ${i <= stepIndex ? 'text-ink' : 'text-ink-mute'}`} aria-current={i === stepIndex ? 'step' : undefined}>
                  {i + 1}. {t.steps[s]}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[0.78rem] font-semibold leading-snug text-ink sm:hidden" aria-hidden="true">
            {fill(common.a11y.stepN, { index: stepIndex + 1, total: 4, title: t.steps[step] })}
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className={`min-w-0 ${step === 'stay' || step === 'done' ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
          {(step === 'details' || step === 'payment') && unit && (
            <details className="group mb-6 rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.summary.title}</span>
                  <span className="mt-0.5 block truncate font-semibold">{units[unit.key].name}</span>
                </span>
                {price && <span className="font-display text-xl tabular-nums">{formatPrice(locale, price.total)}</span>}
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-mute transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-line px-5 pb-5 pt-4">
                {unitHeader(unit, 'sm')}
                <div className="mt-4">{summaryRows()}</div>
              </div>
            </details>
          )}
          <AnimatePresence mode="wait">
            {step === 'stay' && (
              <m.div key="stay" data-step initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
                {/* self-start: the card hugs the calendar instead of stretching to the height of the side column */}
                <div className="min-w-0 self-start rounded-xl3 bg-white p-4 shadow-soft ring-1 ring-ink/5 sm:p-6 md:p-8">
                  <p className="label">{t.stay.dates}</p>
                  {/* two months only where they fit beside the side column (xl and up) */}
                  <div className="hidden justify-center xl:flex [&_.cv-daypicker]:[--rdp-cell-size:44px] 2xl:[&_.cv-daypicker]:[--rdp-cell-size:50px]">
                    <DateRangeCalendar locale={locale} value={range} onChange={setRange} months={2} fromDate={firstBookable()} disabled={{ after: SEASON_END }} />
                  </div>
                  <div className="flex justify-center xl:hidden md:[&_.cv-daypicker]:[--rdp-cell-size:52px] max-[380px]:[&_.cv-daypicker]:[--rdp-cell-size:38px] max-[340px]:[&_.cv-daypicker]:[--rdp-cell-size:34px]">
                    <DateRangeCalendar locale={locale} value={range} onChange={setRange} months={1} fromDate={firstBookable()} disabled={{ after: SEASON_END }} />
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
                    <Stepper label={t.stay.adults} value={adults} min={1} max={MAX_ADULTS} onChange={setAdults} addLabel={common.a11y.addAdult} removeLabel={common.a11y.removeAdult} />
                    <div className="hairline" />
                    <Stepper label={t.stay.children} value={children} min={0} max={MAX_CHILDREN} onChange={setChildren} addLabel={common.a11y.addChild} removeLabel={common.a11y.removeChild} />
                    {guests > LARGEST && <p className="mt-3 rounded-xl bg-sun-light/70 px-3.5 py-2.5 text-[0.82rem] text-ink-soft">{t.stay.groupHint}</p>}
                  </div>
                  <button type="button" disabled={!canSearch} onClick={() => setStep('room')} className="btn btn-primary w-full py-4">
                    {t.stay.search} <ArrowRight className="h-4 w-4" />
                  </button>
                  {/* the number of nights, or why the button is still off once a check-in day is picked; the live region is always there, so each change is read out */}
                  <div role="status" className="text-center text-[0.88rem]">
                    {canSearch ? <p className="text-ink-mute">{countLabel(common, 'night', nights)}</p> : range?.from ? <p className="font-medium text-terra-deep">{common.errors.dates}</p> : null}
                  </div>
                </div>
              </m.div>
            )}

            {step === 'room' && (
              <m.div key="room" data-step initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <button type="button" onClick={() => setStep('stay')} className="mb-6 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-ink-mute hover:text-ink">
                  <ArrowLeft className="h-4 w-4" /> {common.cta.back}
                </button>
                <h2 id="bf-step-room" tabIndex={-1} className="font-display text-display-sm outline-none">
                  {t.steps.room}
                </h2>
                <p className="mt-2 text-[0.95rem] text-ink-soft">{fill(t.room.available, { count: options.filter((o) => o.fits && o.free).length })}</p>

                {noneFit && (
                  <div className="mt-5 rounded-xl3 bg-sun-light/60 p-6 ring-1 ring-sun/30 md:p-7">
                    <p className="font-display text-display-sm">{fill(t.group.title, { count: guests })}</p>
                    <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
                      {aegealisGroup ? t.group.aegealis : fill(t.group.large, { count: guests })}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {canSwitchToTheodora && (
                        <button type="button" onClick={() => setProperty('theodora')} className="btn btn-primary">
                          {t.group.switch} <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                      <a href={whatsappLink(groupMessage)} target="_blank" rel="noopener noreferrer" className={`btn ${canSwitchToTheodora ? 'btn-ghost bg-white' : 'btn-primary'}`}>
                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> {fill(t.group.whatsapp, { count: guests })}
                        <span className="sr-only"> {common.a11y.external}</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {options.map(({ u, fits, reason, free }) => {
                    const total = range?.from && range?.to ? priceStay(u, range.from, range.to).total : 0
                    const selectable = fits && free
                    const selected = unit?.key === u.key
                    const photo = u.photos[0] ?? properties[u.property].hero
                    const mixed = u.maxAdults < u.maxGuests
                    return (
                      <div key={u.key} className={`flex flex-col gap-5 rounded-xl3 bg-white p-4 ring-1 transition sm:flex-row ${selected ? 'shadow-lift ring-2 ring-sea' : 'shadow-soft ring-ink/5'} ${selectable ? '' : 'opacity-55'}`}>
                        <span className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl sm:aspect-auto sm:h-36 sm:w-52">
                          <Image src={photo.src} alt={altFor(photo, locale)} fill sizes="(min-width:640px) 208px, 100vw" className="object-cover" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{properties[u.property].shortName}</p>
                          <h3 id={`room-${u.key}`} className="font-display text-xl leading-tight">
                            {units[u.key].name}
                          </h3>
                          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] text-ink-soft">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" /> {mixed ? fill(t.room.mix, { adults: u.maxAdults, children: u.maxGuests - u.maxAdults }) : tr(common, 'units.upTo', { count: u.maxGuests })}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <BedDouble className="h-3.5 w-3.5" /> {u.bedrooms === 0 ? common.units.studio : u.bedrooms === 1 ? common.units.bedroom : tr(common, 'units.bedrooms', { count: u.bedrooms })}
                            </span>
                          </p>
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {u.features.slice(0, 4).map((f) => {
                              const Icon = featureIcon[f]
                              return (
                                <li key={f} className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-[0.75rem] text-ink-soft">
                                  <Icon className="h-3 w-3" /> {common.features[f]}
                                </li>
                              )
                            })}
                          </ul>
                          {reason === 'tooMany' && <p className="mt-2 text-[0.82rem] font-semibold text-terra-deep">{t.room.tooMany}</p>}
                          {reason === 'adults' && <p className="mt-2 text-[0.82rem] font-semibold text-terra-deep">{fill(t.room.maxAdults, { adults: u.maxAdults, children: u.maxGuests - u.maxAdults })}</p>}
                          {fits && !free && <p className="mt-2 text-[0.82rem] font-semibold text-terra-deep">{t.room.none}</p>}
                        </div>
                        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-between">
                          <div className="sm:text-right">
                            <p className="font-display text-2xl tabular-nums">{formatPrice(locale, total)}</p>
                            <p className="text-[0.78rem] text-ink-mute">
                              {countLabel(common, 'night', nights)} · {countLabel(common, 'guest', guests)}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!selectable}
                            onClick={() => setUnitKey(u.key)}
                            aria-pressed={selected}
                            aria-describedby={`room-${u.key}`}
                            className={`btn py-3 ${selected ? 'btn-sea' : 'btn-ghost'}`}
                          >
                            {selected ? (
                              <>
                                <Check className="h-4 w-4" /> {t.room.selected}
                              </>
                            ) : (
                              t.room.select
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-5 flex items-center gap-2 text-[0.85rem] text-ink-mute">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-sea" /> {t.room.includes}
                </p>
                <button type="button" disabled={!unit} onClick={() => setStep('details')} className="btn btn-primary mt-6 hidden w-full py-4 sm:w-auto md:inline-flex">
                  {common.cta.continue} <ArrowRight className="h-4 w-4" />
                </button>
              </m.div>
            )}

            {step === 'details' && (
              <m.form
                key="details"
                data-step
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  if (validate()) setStep('payment')
                }}
                className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5 md:p-8"
              >
                <button type="button" onClick={() => setStep('room')} className="mb-6 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-ink-mute hover:text-ink">
                  <ArrowLeft className="h-4 w-4" /> {common.cta.back}
                </button>
                <h2 id="bf-step-details" tabIndex={-1} className="font-display text-display-sm outline-none">
                  {t.details.title}
                </h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ['firstName', 'given-name', 'text'],
                      ['lastName', 'family-name', 'text'],
                      ['email', 'email', 'email'],
                      ['phone', 'tel', 'tel'],
                      ['country', 'country-name', 'text'],
                      ['arrival', 'off', 'time'],
                    ] as const
                  ).map(([k, ac, type]) => (
                    <div key={k} className="min-w-0">
                      <label className="label" htmlFor={`bf-${k}`}>
                        {t.details[k]}
                      </label>
                      <input
                        id={`bf-${k}`}
                        type={type}
                        autoComplete={ac}
                        inputMode={k === 'phone' ? 'tel' : k === 'email' ? 'email' : undefined}
                        className={`field ${errors[k] ? 'ring-2 ring-terra' : ''}`}
                        value={form[k]}
                        onChange={(e) => {
                          setForm({ ...form, [k]: e.target.value })
                          if (errors[k]) setErrors({ ...errors, [k]: '' })
                        }}
                        aria-invalid={!!errors[k]}
                        aria-describedby={errors[k] ? `bf-${k}-err` : undefined}
                      />
                      {errors[k] && (
                        <p id={`bf-${k}-err`} className="mt-1 text-[0.8rem] text-terra-deep">
                          {errors[k]}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="bf-req">
                      {t.details.requests}
                    </label>
                    <textarea id="bf-req" rows={3} className="field resize-none" placeholder={t.details.requestsHint} value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-3 sm:col-span-2">
                    <input type="checkbox" checked={form.taxi} onChange={(e) => setForm({ ...form, taxi: e.target.checked })} className="h-4 w-4 accent-[#0F2430]" />
                    <span className="text-[0.95rem]">{t.details.taxi}</span>
                  </label>
                </div>
                <button type="submit" className="btn btn-primary mt-8 w-full py-4 sm:w-auto">
                  {common.cta.continue} <ArrowRight className="h-4 w-4" />
                </button>
              </m.form>
            )}

            {step === 'payment' && price && (
              <m.div key="payment" data-step initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5 md:p-8">
                <button type="button" onClick={() => setStep('details')} className="mb-6 inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-ink-mute hover:text-ink">
                  <ArrowLeft className="h-4 w-4" /> {common.cta.back}
                </button>
                <h2 id="bf-step-payment" tabIndex={-1} className="font-display text-display-sm outline-none">
                  {t.payment.title}
                </h2>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {(['deposit', 'full'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPayPlan(p)} aria-pressed={payPlan === p} className={`rounded-2xl p-4 text-left ring-1 transition ${payPlan === p ? 'bg-sea-mist ring-sea' : 'ring-ink/10 hover:bg-sand'}`}>
                      <span className="block font-semibold">{t.payment[p]}</span>
                      <span className="mt-1 block font-display text-xl tabular-nums">{formatPrice(locale, p === 'deposit' ? deposit : price.total)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <DemoCard pay={t.payment} />
                </div>
                <p className="mt-4 text-[0.85rem] text-ink-mute">{t.payment.cancellation}</p>
                <button type="button" onClick={finish} className="btn btn-sea mt-6 w-full py-4">
                  <Lock className="h-4 w-4" /> {fill(t.payment.payNow, { amount: formatPrice(locale, payPlan === 'deposit' ? deposit : price.total) })}
                </button>
              </m.div>
            )}

            {step === 'done' && done && (
              <m.div key="done" data-step initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-2xl rounded-xl3 bg-white p-6 text-center shadow-lift ring-1 ring-ink/5 sm:p-8 md:p-12">
                <m.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sea text-white">
                  <Check className="h-8 w-8" />
                </m.div>
                <h2 id="bf-step-done" tabIndex={-1} className="mt-6 font-display text-display-md font-light outline-none">
                  {t.done.title}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-ink-soft">{t.done.body}</p>
                <p className="mt-6 inline-block rounded-full bg-sand px-4 py-2 font-mono text-[0.95rem] font-semibold tracking-wider">
                  {t.done.reference} {done.ref}
                </p>
                {unit && (
                  <div className="mt-8 rounded-2xl bg-sand-paper p-5 text-left ring-1 ring-ink/5">
                    {unitHeader(unit)}
                    <div className="mt-5">{summaryRows({ paid: true })}</div>
                    {done.taxi && (
                      <p className="mt-4 flex gap-2 border-t border-line pt-4 text-[0.88rem] text-ink-soft">
                        <Car className="mt-0.5 h-4 w-4 shrink-0 text-sea" /> {t.done.taxi}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-10 text-left">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.done.next}</p>
                  <ol className="mt-4 space-y-3">
                    {(t.done.nextItems as string[]).map((x, i) => (
                      <li key={x} className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea-mist text-[0.8rem] font-semibold text-sea-deep">{i + 1}</span>
                        <span className="pt-0.5">{x}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-10 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href={href(locale, '/cruises')} className="btn btn-primary">
                    {t.done.cruiseCta} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={href(locale, '/')} className="btn btn-ghost">
                    {t.done.home}
                  </Link>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {(step === 'room' || step === 'details' || step === 'payment') && (
          <aside className="hidden min-w-0 lg:col-span-4 lg:block">
            <div className="lg:sticky lg:top-[calc(var(--header-h)+var(--banner-h,0px)+1.5rem)]">{summaryCard}</div>
          </aside>
        )}
      </div>

      {/* phones: the chosen room, the total and Continue stay in reach while the guest scrolls the list */}
      <AnimatePresence>
        {step === 'room' && unit && price && (
          <m.div
            key="room-bar"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 shadow-lift backdrop-blur md:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{units[unit.key].name}</p>
                <p className="text-[0.8rem] text-ink-mute">
                  <span className="font-semibold tabular-nums text-ink">{formatPrice(locale, price.total)}</span> · {countLabel(common, 'night', nights)}
                </p>
              </div>
              <button type="button" onClick={() => setStep('details')} className="btn btn-primary shrink-0 px-5 py-3">
                {common.cta.continue} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
