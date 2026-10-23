'use client'

import { m } from 'framer-motion'
import { formatNumber, tr, type Dict, type Locale } from '@/lib/i18n'

type Cats = Record<string, number>

/** Big score plus category bars that fill as they scroll into view. */
export function RatingSummary({
  locale,
  common,
  score,
  count,
  categories,
  title,
  compact,
  hide = [],
}: {
  locale: Locale
  common: Dict
  score: number
  count: number
  categories: Cats
  title?: string
  compact?: boolean
  hide?: string[]
}) {
  const order = ['location', 'staff', 'cleanliness', 'comfort', 'value', 'facilities', 'wifi'].filter((k) => k in categories && !hide.includes(k))
  return (
    <div className={`rounded-xl3 bg-white p-7 shadow-soft ring-1 ring-ink/5 ${compact ? '' : 'md:p-9'}`}>
      {title && <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{title}</p>}
      <div className="mt-2 flex items-end gap-4">
        <span className="font-display text-[4rem] font-light leading-none tabular-nums text-ink">{formatNumber(locale, score)}</span>
        <div className="pb-2">
          <div className="font-semibold">{common.rating.exceptional}</div>
          <div className="text-[0.85rem] text-ink-mute">{tr(common, 'rating.basedOn', { count })}</div>
        </div>
      </div>
      <dl className="mt-7 space-y-3.5">
        {order.map((k, i) => (
          // Only dt and dd inside each group (valid <dl>): the bar lives in the dd, drawn under the whole row.
          <div key={k} className="relative flex items-center justify-between gap-4 pb-3">
            <dt className="text-[0.88rem] text-ink-soft">{common.rating.categories[k]}</dt>
            <dd className="text-[0.88rem] font-semibold tabular-nums">
              {formatNumber(locale, categories[k])}
              <span className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                <m.span
                  className={`block h-full rounded-full ${categories[k] >= 9 ? 'bg-sea' : categories[k] >= 8 ? 'bg-sea/70' : 'bg-sun'}`}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${categories[k] * 10}%` }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 1.2, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[0.75rem] text-ink-mute">{common.rating.source}</p>
    </div>
  )
}
