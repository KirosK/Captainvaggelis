'use client'

import { useEffect, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { ReviewCard } from './ReviewCard'
import type { Review } from '@/data/reviews'
import { fill, type Dict, type Locale } from '@/lib/i18n'

const ADVANCE_MS = 7000
// React 18 only forwards `inert` as a string attribute (its types say boolean), hence the cast.
const INERT = { inert: '' } as unknown as React.HTMLAttributes<HTMLDivElement>

// The rows scroll as a marquee only from md up and without a reduced-motion preference (and until someone presses Pause).
// Everywhere else they are swipeable, snapping lists with a single copy of the cards.
const ROW_STATIC = 'overflow-x-auto snap-x snap-mandatory scroll-px-5 md:scroll-px-8 [scrollbar-color:rgba(15,36,48,.18)_transparent] [scrollbar-width:thin]'
const ROW_AUTO = `${ROW_STATIC} md:motion-safe:overflow-hidden md:motion-safe:snap-none md:motion-safe:mask-fade-x`
const TRACK_STATIC = 'px-5 pb-3 md:px-8'
const TRACK_AUTO = `${TRACK_STATIC} md:motion-safe:animate-marquee md:motion-safe:pl-0 md:motion-safe:pr-5 md:motion-safe:pb-0 md:motion-safe:group-hover:[animation-play-state:paused] md:motion-safe:group-focus-within:[animation-play-state:paused]`

/** A slow, auto-advancing featured quote with progress, then two counter-scrolling rows of cards, with a pause control. */
export function ReviewsWall({
  reviews,
  featured,
  translations,
  locale,
  common,
  showProperty = true,
}: {
  reviews: Review[]
  featured: Review[]
  translations: Dict
  locale: Locale
  common: Dict
  showProperty?: boolean
}) {
  const a = common.a11y
  // Read the motion preference only after mount, so the first client render matches the server HTML.
  const prefersReduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const reduce = mounted && !!prefersReduced
  const [i, setI] = useState(0)
  // stopped: the visitor pressed Pause (stays until Play). hold: pointer or focus is on the featured quote.
  const [stopped, setStopped] = useState(false)
  const [hold, setHold] = useState(false)
  const running = !stopped && !hold && !reduce && featured.length > 1

  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setI((v) => (v + 1) % featured.length), ADVANCE_MS)
    return () => clearTimeout(id)
  }, [i, running, featured.length])

  // the featured quotes rotate above, so the rows hold the other reviews and the same quote is never on screen twice
  const rest = reviews.filter((r) => !featured.some((f) => f.id === r.id))
  const half = Math.ceil(rest.length / 2)
  const rows = [rest.slice(0, half), rest.slice(half)].filter((row) => row.length)
  const current = featured[i]
  const auto = !stopped

  // Nothing moves with reduced motion, so the control is not needed there.
  const toggle = !reduce && (
    <button
      type="button"
      onClick={() => setStopped((v) => !v)}
      aria-label={stopped ? a.playReviews : a.pauseReviews}
      title={stopped ? a.playReviews : a.pauseReviews}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white"
    >
      {stopped ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
    </button>
  )

  return (
    <div>
      {current ? (
        <div className="container" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
          <div className="relative mx-auto max-w-4xl">
            {/* Announce changes only when the visitor drives them, never while it rotates on its own.
                Every featured quote sits in the same grid cell, so the box always has the height of the longest one and
                nothing below it moves when the quote changes; a shorter quote is centred in it. Only the current one is
                visible and reachable. The padding keeps focus rings clear of the edges. */}
            <div className="-m-3 grid p-3" aria-live={running ? 'off' : 'polite'}>
              {featured.map((f) => {
                const on = f.id === current.id
                return (
                  <div key={f.id} style={{ gridArea: '1 / 1' }} className={`self-center ${on ? '' : 'pointer-events-none'}`} aria-hidden={on ? undefined : true} {...(on ? {} : INERT)}>
                    <m.div
                      initial={false}
                      animate={{ opacity: on ? 1 : 0 }}
                      // the old quote fades out before the new one fades in, so the two texts never overlap
                      transition={reduce ? { duration: 0 } : on ? { duration: 0.35, delay: 0.25 } : { duration: 0.25 }}
                    >
                      <ReviewCard review={f} translated={translations[f.id]} locale={locale} common={common} variant="feature" showProperty={showProperty} />
                    </m.div>
                  </div>
                )
              })}
            </div>
            <div className="mt-8 flex items-center gap-4">
              {featured.length > 1 && (
                <>
                  <button type="button" aria-label={a.prev} title={a.prev} onClick={() => setI((v) => (v - 1 + featured.length) % featured.length)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="flex flex-1 gap-1.5">
                    {featured.map((f, k) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setI(k)}
                        aria-label={fill(a.reviewN, { index: k + 1, total: featured.length })}
                        aria-current={k === i ? 'true' : undefined}
                        className="flex h-6 flex-1 items-center"
                      >
                        <span className="relative h-1 w-full overflow-hidden rounded-full bg-ink/10">
                          {k === i && (
                            <m.span
                              key={`${f.id}-${running}`}
                              className="absolute inset-y-0 left-0 bg-sea"
                              initial={{ width: running ? '0%' : '100%' }}
                              animate={{ width: '100%' }}
                              transition={{ duration: running ? ADVANCE_MS / 1000 : 0, ease: 'linear' }}
                            />
                          )}
                          {k < i && <span className="absolute inset-0 bg-sea/50" />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" aria-label={a.next} title={a.next} onClick={() => setI((v) => (v + 1) % featured.length)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              )}
              {toggle && <span className={`${featured.length > 1 ? 'ml-2 border-l border-line pl-4' : 'ml-auto'} flex`}>{toggle}</span>}
            </div>
          </div>
        </div>
      ) : (
        toggle && <div className="container flex justify-end">{toggle}</div>
      )}

      <div className="mt-16 space-y-5">
        {rows.map((row, r) => (
          <div key={r} className={`group flex ${auto ? ROW_AUTO : ROW_STATIC}`}>
            <div
              className={`flex shrink-0 items-start gap-5 ${auto ? TRACK_AUTO : TRACK_STATIC}`}
              style={{ ['--marquee-duration' as string]: `${row.length * 9}s`, animationDirection: r ? 'reverse' : 'normal' }}
            >
              {row.map((rv) => (
                <div key={rv.id} className="flex snap-start">
                  <ReviewCard review={rv} translated={translations[rv.id]} locale={locale} common={common} showProperty={showProperty} />
                </div>
              ))}
              {/* Second copy for a seamless loop: shown only while the marquee runs, and never reachable by keyboard or screen readers. */}
              {auto &&
                row.map((rv) => (
                  <div key={`${rv.id}-copy`} className="hidden md:motion-safe:flex" aria-hidden="true" {...INERT}>
                    <ReviewCard review={rv} translated={translations[rv.id]} locale={locale} common={common} showProperty={showProperty} />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
