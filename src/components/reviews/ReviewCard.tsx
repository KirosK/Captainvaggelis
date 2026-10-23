'use client'

import { useMemo, useState } from 'react'
import { Languages, Quote } from 'lucide-react'
import type { Review } from '@/data/reviews'
import { formatDate, formatNumber, htmlLang, quote, tr, type Dict, type Locale } from '@/lib/i18n'

const langName: Record<Locale, Record<string, string>> = {
  en: { en: 'English', it: 'Italian', el: 'Greek' },
  el: { en: 'αγγλικά', it: 'ιταλικά', el: 'ελληνικά' },
  it: { en: 'inglese', it: 'italiano', el: 'greco' },
}
const propertyName = { aegealis: 'Aegealis', theodora: 'Theodora' } as const
// Long reviews are clamped to six lines on the small cards, with a "Read full review" toggle.
const CLAMP_AT = 280

/** Country name in the visitor's language (plain text: emoji flags show as letters on Windows). */
function countryName(locale: Locale, code: string) {
  try {
    return new Intl.DisplayNames([htmlLang[locale]], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** A small text button with a hit area of at least 40px, without changing its visual size. */
const textButton = "relative inline-flex items-center gap-1 font-medium text-sea underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:underline"

export function ReviewCard({
  review,
  translated,
  locale,
  common,
  variant = 'card',
  showProperty,
}: {
  review: Review
  translated?: { title?: string; text: string }
  locale: Locale
  common: Dict
  variant?: 'card' | 'feature'
  showProperty?: boolean
}) {
  const needsTranslation = review.lang !== locale && !!translated
  const [original, setOriginal] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const useOriginal = !needsTranslation || original
  const text = useOriginal ? review.text : translated!.text
  // a translated title only stands in for a title the guest actually wrote
  const title = review.title ? (useOriginal ? review.title : translated?.title ?? review.title) : undefined
  const [y, mo] = review.stayed.split('-').map(Number)
  const month = formatDate(locale, new Date(y, mo - 1, 1), { month: 'long', year: 'numeric' })
  const country = useMemo(() => countryName(locale, review.country), [locale, review.country])
  const r = common.reviewsUi
  const score = formatNumber(locale, review.score, review.score % 1 ? 1 : 0)
  const textLang = useOriginal ? review.lang : locale

  // "Translated from English   Show original": the state is plain text, the button names the action.
  // No separator dot: on a narrow card the button simply drops to its own line, aligned with the label.
  const translation = needsTranslation && (
    <span className="inline-flex items-start gap-1.5">
      <span className="flex h-[1lh] items-center">
        <Languages className="h-3.5 w-3.5 shrink-0 text-sea" aria-hidden="true" />
      </span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        {!original && <span>{tr(common, 'reviewsUi.translated', { language: langName[locale][review.lang] })}</span>}
        <button type="button" onClick={() => setOriginal((v) => !v)} className={textButton}>
          {original ? r.translation : r.original}
        </button>
      </span>
    </span>
  )

  if (variant === 'feature') {
    return (
      <figure className="relative">
        <Quote className="h-10 w-10 text-sea/30" aria-hidden="true" />
        {title && (
          <p className="mt-4 text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-sea" lang={textLang}>
            {title}
          </p>
        )}
        <blockquote className="mt-3 font-display text-[1.3rem] font-light leading-[1.4] text-ink md:text-[1.9rem] md:leading-[1.35] text-pretty" lang={textLang}>
          {quote(locale, text)}
        </blockquote>
        <figcaption className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.88rem] text-ink-mute">
          <span>
            <span className="font-semibold text-ink">{review.name}</span> · {country}
          </span>
          {review.traveller && <span>{r.travellers[review.traveller]}</span>}
          <span>{tr(common, 'reviewsUi.stayed', { month })}</span>
          {showProperty && <span className="font-medium text-ink-soft">{propertyName[review.property]}</span>}
          {/* relative: keeps the visually hidden "/10" inside the card, so it never widens a scrolling row */}
          <span className="relative rounded-md bg-sea px-1.5 py-0.5 text-[0.78rem] font-semibold tabular-nums text-white">
            {score}
            <span className="sr-only">/10</span>
          </span>
          {translation}
        </figcaption>
      </figure>
    )
  }

  const long = text.length > CLAMP_AT
  return (
    <figure className="flex h-full w-[min(86vw,380px)] shrink-0 flex-col rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand font-display text-lg text-ink" aria-hidden="true">
            {review.name[0]}
          </span>
          <div className="min-w-0 leading-tight">
            <div>
              <span className="font-semibold">{review.name}</span>
              <span className="text-[0.78rem] text-ink-mute"> · {country}</span>
            </div>
            <div className="mt-0.5 text-[0.78rem] text-ink-mute">
              {review.traveller ? `${r.travellers[review.traveller]} · ${month}` : month}
            </div>
          </div>
        </div>
        <span className="relative shrink-0 rounded-lg bg-sea px-2 py-1 text-[0.85rem] font-semibold tabular-nums text-white">
          {score}
          <span className="sr-only">/10</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col pb-5">
        {title && (
          <p className="mt-4 font-semibold leading-snug" lang={textLang}>
            {title}
          </p>
        )}
        <blockquote className={`mt-2 text-[0.95rem] leading-relaxed text-ink-soft ${long && !expanded ? 'line-clamp-6' : ''}`} lang={textLang}>
          {text}
        </blockquote>
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className={`${textButton} mt-2 self-start text-[0.85rem]`}>
            {expanded ? common.cta.showLess : r.readFull}
          </button>
        )}
      </div>
      <figcaption className="flex flex-col gap-2.5 border-t border-line pt-4 text-[0.75rem] text-ink-mute">
        <span>
          {showProperty ? `${propertyName[review.property]} · ` : ''}
          {r.verified}
        </span>
        {translation}
      </figcaption>
    </figure>
  )
}
