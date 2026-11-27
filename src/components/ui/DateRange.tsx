'use client'

import { DayContent, DayPicker, type DateRange as Range, type DayContentProps, type Labels, type Matcher } from 'react-day-picker'
import { el, enGB, it } from 'date-fns/locale'
import { fill, type Locale } from '@/lib/i18n'
import { addDays, MIN_NIGHTS, nightsBetween, ROOMS_LAST_CHECKOUT } from '@/lib/dates'
import 'react-day-picker/dist/style.css'

const dfLocale = { en: enGB, el, it }

// react-day-picker names its month buttons in English whatever the locale, so they are named here.
const NAV: Record<Locale, { prev: string; next: string }> = {
  en: { prev: 'Previous month', next: 'Next month' },
  el: { prev: 'Προηγούμενος μήνας', next: 'Επόμενος μήνας' },
  it: { prev: 'Mese precedente', next: 'Mese successivo' },
}

const navLabels = (locale: Locale): Partial<Labels> => ({ labelPrevious: () => NAV[locale].prev, labelNext: () => NAV[locale].next })

// The minimum-stay hint under every room calendar: the rule first, then what to pick once the check-in is chosen.
const MIN_STAY: Record<Locale, { rule: string; checkOut: string }> = {
  en: { rule: 'Minimum stay: {count} nights', checkOut: 'Now choose your check-out date, at least {count} nights later' },
  el: { rule: 'Ελάχιστη διαμονή: {count} νύχτες', checkOut: 'Τώρα επιλέξτε την ημερομηνία αναχώρησης, τουλάχιστον {count} νύχτες μετά' },
  it: { rule: 'Soggiorno minimo: {count} notti', checkOut: 'Ora scegliete la data di partenza, almeno {count} notti dopo' },
}

export type { Range }

export function DateRangeCalendar({
  locale,
  value,
  onChange,
  months = 2,
  disabled,
  fromDate,
  toDate = ROOMS_LAST_CHECKOUT,
  labels,
  minNights = MIN_NIGHTS,
  hint = true,
  today,
}: {
  locale: Locale
  value: Range | undefined
  onChange: (r: Range | undefined) => void
  months?: number
  disabled?: Matcher | Matcher[]
  fromDate?: Date
  /** last day that can be picked (the calendar pages up to its month); defaults to the last check-out VikBooking accepts */
  toDate?: Date
  /** extra or replacement react-day-picker labels, merged over the defaults */
  labels?: Partial<Labels>
  /** shortest stay that can be selected (the rooms' minimum stay by default) */
  minNights?: number
  /** show the minimum-stay hint under the calendar */
  hint?: boolean
  /** the day marked as today (react-day-picker's default is the device's date, which a server render cannot know) */
  today?: Date
}) {
  const from = value?.from
  const choosingCheckOut = !!from && !value?.to
  // While the check-out is being chosen, the days that would make the stay too short are switched off. With no check-in
  // yet, the last days of the season are switched off, since a stay starting there could not last the minimum.
  const minStay: Matcher[] =
    minNights > 1 ? (choosingCheckOut ? [{ after: from, before: addDays(from, minNights) }] : from ? [] : [{ after: addDays(toDate, -minNights) }]) : []
  const off = [...(Array.isArray(disabled) ? disabled : disabled ? [disabled] : []), ...minStay]
  return (
    <div>
      <DayPicker
        mode="range"
        locale={dfLocale[locale]}
        numberOfMonths={months}
        selected={value}
        // a click that would make a stay shorter than the minimum (a second click on the check-in day, or a day just
        // before it) starts again from the clicked day, which becomes the new check-in
        onSelect={(r, day) => onChange(r?.from && r?.to && nightsBetween(r.from, r.to) < Math.max(1, minNights) ? { from: day, to: undefined } : r)}
        fromDate={fromDate ?? new Date()}
        toDate={toDate}
        defaultMonth={value?.from ?? fromDate}
        disabled={off}
        today={today}
        weekStartsOn={1}
        showOutsideDays={false}
        labels={{ ...navLabels(locale), ...labels }}
        className="cv-daypicker"
      />
      {hint && minNights > 1 && (
        <p className="mx-auto max-w-[27rem] px-2 pb-1 text-center text-[0.8rem] leading-snug text-ink-mute text-balance">
          {fill(choosingCheckOut ? MIN_STAY[locale].checkOut : MIN_STAY[locale].rule, { count: minNights })}
        </p>
      )}
    </div>
  )
}

export function SingleDateCalendar({
  locale,
  value,
  onChange,
  disabled,
  modifiers,
  modifiersClassNames,
  fromDate,
  toDate,
  defaultMonth,
  onMonthChange,
  labels,
}: {
  locale: Locale
  value: Date | undefined
  onChange: (d: Date | undefined) => void
  disabled?: Matcher | Matcher[]
  modifiers?: Record<string, Matcher | Matcher[]>
  modifiersClassNames?: Record<string, string>
  fromDate?: Date
  toDate?: Date
  defaultMonth?: Date
  /** called with the first day of the month the guest pages to */
  onMonthChange?: (month: Date) => void
  /** extra or replacement react-day-picker labels (e.g. labelDay), merged over the defaults */
  labels?: Partial<Labels>
}) {
  // react-day-picker 8 defines labelDay but never puts it on the day buttons, so a given labelDay is
  // rendered as the button's screen-reader text (the visible number is hidden from screen readers).
  const labelDay = labels?.labelDay
  const components = labelDay
    ? {
        DayContent: (p: DayContentProps) => (
          <>
            <span aria-hidden="true">
              <DayContent {...p} />
            </span>
            <span className="sr-only">{labelDay(p.date, p.activeModifiers, { locale: dfLocale[locale] })}</span>
          </>
        ),
      }
    : undefined
  return (
    <DayPicker
      mode="single"
      components={components}
      locale={dfLocale[locale]}
      selected={value}
      onSelect={onChange}
      disabled={disabled}
      modifiers={modifiers}
      modifiersClassNames={modifiersClassNames}
      fromDate={fromDate}
      toDate={toDate}
      defaultMonth={defaultMonth ?? value ?? fromDate}
      onMonthChange={onMonthChange}
      weekStartsOn={1}
      showOutsideDays={false}
      labels={{ ...navLabels(locale), ...labels }}
      className="cv-daypicker"
    />
  )
}
