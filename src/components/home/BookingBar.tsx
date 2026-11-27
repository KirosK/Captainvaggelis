'use client'

import { useState } from 'react'
import { CalendarDays, MapPin, Search, Users } from 'lucide-react'
import { DateRangeCalendar, type Range } from '@/components/ui/DateRange'
import { Popover, Stepper } from '@/components/ui/Popover'
import { countLabel, formatDate, type Dict, type Locale } from '@/lib/i18n'
import { firstBookableDay, validStay } from '@/lib/dates'
import { maxChildrenFor, PARTY_MAX_GUESTS, vikbookingUrl, type VikProperty } from '@/lib/vikbooking'

type Where = VikProperty

export function BookingBar({ locale, t, common, defaultProperty = 'both', hint = true }: { locale: Locale; t: Dict; common: Dict; defaultProperty?: Where; hint?: boolean }) {
  const [where, setWhere] = useState<Where>(defaultProperty)
  const [range, setRange] = useState<Range | undefined>()
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [open, setOpen] = useState<null | 'where' | 'dates' | 'guests'>(null)
  // never offer days that have already passed, even once the season has started
  const firstDay = firstBookableDay()

  const datesLabel =
    range?.from && range?.to
      ? `${formatDate(locale, range.from)} – ${formatDate(locale, range.to)}`
      : range?.from
        ? `${formatDate(locale, range.from)} – …`
        : t.addDates
  const guestsLabel = countLabel(common, 'guest', adults + children)
  const whereLabel = where === 'both' ? t.both : where === 'aegealis' ? 'Aegealis' : 'Theodora'

  // Search goes straight to the live availability in the family's booking engine (same tab), with the dates and guests
  // filled in. Without a valid stay (both dates, at least the minimum stay) the dates are opened instead.
  const submit = () => {
    if (!range?.from || !range?.to || !validStay(range.from, range.to)) {
      setOpen('dates')
      return
    }
    window.location.assign(vikbookingUrl({ locale, from: range.from, to: range.to, adults, children, property: where }))
  }

  const cell = 'group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-ink/[0.04] md:rounded-full'

  return (
    <div className="relative w-full max-w-4xl">
      <div className="grid gap-1 rounded-[26px] bg-white/95 p-2 text-ink shadow-lift ring-1 ring-white/50 backdrop-blur-xl md:grid-cols-[1.05fr_1.25fr_1fr_auto] md:items-center md:rounded-full">
        <div className="relative">
          <button type="button" data-popover-trigger className={cell} onClick={() => setOpen(open === 'where' ? null : 'where')} aria-expanded={open === 'where'}>
            <MapPin className="h-5 w-5 shrink-0 text-sea" />
            <span className="min-w-0">
              <span className="block text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.property}</span>
              <span className="block truncate font-semibold">{whereLabel}</span>
            </span>
          </button>
          <Popover open={open === 'where'} onClose={() => setOpen(null)} label={t.property} className="bottom-full left-0 mb-3 w-80" closeLabel={common.a11y.close}>
            <div className="space-y-1">
              {(['both', 'aegealis', 'theodora'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setWhere(w)
                    setOpen('dates')
                  }}
                  className={`flex w-full flex-col rounded-2xl px-4 py-3 text-left transition-colors ${where === w ? 'bg-sea-mist' : 'hover:bg-sand'}`}
                >
                  <span className="font-semibold">{w === 'both' ? t.both : w === 'aegealis' ? 'Aegealis Studios' : 'Theodora Studios & Apartments'}</span>
                  {w !== 'both' && <span className="text-[0.84rem] text-ink-mute">{common.nav.stayDesc[w]}</span>}
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <div className="relative">
          <button type="button" data-popover-trigger className={cell} onClick={() => setOpen(open === 'dates' ? null : 'dates')} aria-expanded={open === 'dates'}>
            <CalendarDays className="h-5 w-5 shrink-0 text-sea" />
            <span className="min-w-0">
              <span className="block text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.dates}</span>
              <span className={`block truncate font-semibold ${range?.from ? '' : 'text-ink-mute'}`}>{datesLabel}</span>
            </span>
          </button>
          <Popover open={open === 'dates'} onClose={() => setOpen(null)} label={t.dates} className="bottom-full left-1/2 mb-3 -translate-x-1/2" closeLabel={common.a11y.close}>
            <div className="hidden lg:block">
              <DateRangeCalendar locale={locale} value={range} onChange={(r) => { setRange(r); if (r?.from && r?.to) setOpen('guests') }} months={2} fromDate={firstDay} />
            </div>
            <div className="flex justify-center lg:hidden">
              <DateRangeCalendar locale={locale} value={range} onChange={(r) => { setRange(r); if (r?.from && r?.to) setOpen('guests') }} months={1} fromDate={firstDay} />
            </div>
          </Popover>
        </div>

        <div className="relative">
          <button type="button" data-popover-trigger className={cell} onClick={() => setOpen(open === 'guests' ? null : 'guests')} aria-expanded={open === 'guests'}>
            <Users className="h-5 w-5 shrink-0 text-sea" />
            <span className="min-w-0">
              <span className="block text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.guests}</span>
              <span className="block truncate font-semibold">{guestsLabel}</span>
            </span>
          </button>
          <Popover open={open === 'guests'} onClose={() => setOpen(null)} label={t.guests} className="bottom-full right-0 mb-3 w-80" closeLabel={common.a11y.close}>
            {/* each VikBooking room needs an adult and takes up to 4 children, so fewer adults also lower the children allowed */}
            <Stepper
              label={common.units.adults}
              addLabel={common.a11y.addAdult}
              removeLabel={common.a11y.removeAdult}
              value={adults}
              min={1}
              max={PARTY_MAX_GUESTS - children}
              onChange={(n) => {
                setAdults(n)
                setChildren((c) => Math.min(c, maxChildrenFor(n)))
              }}
            />
            <div className="hairline" />
            <Stepper label={common.units.children} addLabel={common.a11y.addChild} removeLabel={common.a11y.removeChild} value={children} min={0} max={maxChildrenFor(adults)} onChange={setChildren} />
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={submit}>
              {t.search}
            </button>
          </Popover>
        </div>

        <button type="button" onClick={submit} className="btn btn-sea h-14 rounded-2xl px-7 md:rounded-full">
          <Search className="h-5 w-5" />
          <span>{t.search}</span>
        </button>
      </div>
      {hint && <p className="mt-3 pl-2 text-[0.82rem] text-white/75">{t.hint}</p>}
    </div>
  )
}
