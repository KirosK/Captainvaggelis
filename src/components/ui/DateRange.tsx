'use client'

import { DayContent, DayPicker, type DateRange as Range, type DayContentProps, type Labels, type Matcher } from 'react-day-picker'
import { el, enGB, it } from 'date-fns/locale'
import type { Locale } from '@/lib/i18n'
import { SEASON_END } from '@/lib/dates'
import 'react-day-picker/dist/style.css'

const dfLocale = { en: enGB, el, it }

// react-day-picker names its month buttons in English whatever the locale, so they are named here.
const NAV: Record<Locale, { prev: string; next: string }> = {
  en: { prev: 'Previous month', next: 'Next month' },
  el: { prev: 'Προηγούμενος μήνας', next: 'Επόμενος μήνας' },
  it: { prev: 'Mese precedente', next: 'Mese successivo' },
}

const navLabels = (locale: Locale): Partial<Labels> => ({ labelPrevious: () => NAV[locale].prev, labelNext: () => NAV[locale].next })

export type { Range }

export function DateRangeCalendar({
  locale,
  value,
  onChange,
  months = 2,
  disabled,
  fromDate,
  toDate = SEASON_END,
  labels,
}: {
  locale: Locale
  value: Range | undefined
  onChange: (r: Range | undefined) => void
  months?: number
  disabled?: Matcher | Matcher[]
  fromDate?: Date
  /** last month the calendar pages to; defaults to the end of the season */
  toDate?: Date
  /** extra or replacement react-day-picker labels, merged over the defaults */
  labels?: Partial<Labels>
}) {
  return (
    <DayPicker
      mode="range"
      locale={dfLocale[locale]}
      numberOfMonths={months}
      selected={value}
      // a second click on the check-in day would make a 0-night stay: keep the check-in and wait for the check-out instead
      onSelect={(r) => onChange(r?.from && r?.to && r.to <= r.from ? { from: r.from, to: undefined } : r)}
      fromDate={fromDate ?? new Date()}
      toDate={toDate}
      defaultMonth={value?.from ?? fromDate}
      disabled={disabled}
      weekStartsOn={1}
      showOutsideDays={false}
      labels={{ ...navLabels(locale), ...labels }}
      className="cv-daypicker"
    />
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
      weekStartsOn={1}
      showOutsideDays={false}
      labels={{ ...navLabels(locale), ...labels }}
      className="cv-daypicker"
    />
  )
}
