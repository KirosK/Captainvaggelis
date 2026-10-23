import { ReviewCard } from '@/components/reviews/ReviewCard'
import type { cruiseReviewQuotes } from '@/data/cruises'
import { reviews } from '@/data/reviews'
import type { Dict, Locale } from '@/lib/i18n'

/**
 * Guest reviews on cruise pages, cut down to the sentence about the cruise (rooms are covered on the property pages).
 * The original wording comes from src/data/cruises.ts, the translation from cruises.json → reviewQuotes.
 */
export function CruiseQuotes({ quotes, locale, translations, common, className = '' }: { quotes: typeof cruiseReviewQuotes; locale: Locale; translations: Dict; common: Dict; className?: string }) {
  const items = quotes.flatMap((q) => {
    const r = reviews.find((x) => x.id === q.id)
    return r ? [{ review: { ...r, title: undefined, text: q.text }, translated: translations[q.id] ? { text: translations[q.id] as string } : undefined }] : []
  })
  if (!items.length) return null
  return (
    // three or more fill a row of three; two sit as a centred pair; a single quote (the charter pages) is one centred card
    <div className={`grid gap-5 ${items.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : items.length === 2 ? 'mx-auto max-w-4xl md:grid-cols-2' : 'mx-auto max-w-2xl'} [&_figure]:w-full ${className}`}>
      {items.map(({ review, translated }) => (
        <ReviewCard key={review.id} review={review} translated={locale === review.lang ? undefined : translated} locale={locale} common={common} showProperty />
      ))}
    </div>
  )
}
