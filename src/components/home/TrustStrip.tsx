'use client'

import { useState } from 'react'
import { BadgePercent, Clock, Heart, Pause, Play, ShieldCheck, Star, Waves } from 'lucide-react'
import { formatNumber, tr, type Dict, type Locale } from '@/lib/i18n'

/**
 * A slow marquee of trust points that pauses on hover and has its own pause/play button, so keyboard and touch
 * visitors can stop it too. With reduced motion it becomes a static, centred, wrapping list (the duplicate copy
 * and the button are dropped), so every item stays readable.
 */
export function TrustStrip({ common, locale }: { common: Dict; locale: Locale }) {
  const [paused, setPaused] = useState(false)
  const a = common.a11y
  const items = [
    { icon: Star, text: tr(common, 'trust.rating', { score: formatNumber(locale, 9.1) }) },
    { icon: Heart, text: common.trust.since },
    { icon: Waves, text: common.trust.beach },
    { icon: BadgePercent, text: common.trust.guestDiscount },
    { icon: ShieldCheck, text: common.trust.noCommission },
    { icon: Clock, text: common.trust.reply },
  ]
  const row = (copy?: boolean) => (
    <ul
      className={`flex shrink-0 items-center gap-12 pr-12 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-10 motion-reduce:gap-y-3 motion-reduce:pr-0 ${copy ? 'motion-reduce:hidden' : ''}`}
      aria-hidden={copy || undefined}
    >
      {items.map((it) => (
        <li key={it.text} className="flex items-center gap-2.5 whitespace-nowrap text-[0.92rem] font-medium text-ink-soft motion-reduce:whitespace-normal">
          <it.icon className="h-4 w-4 shrink-0 text-sea" aria-hidden="true" />
          {it.text}
        </li>
      ))}
    </ul>
  )
  const label = paused ? a.playStrip ?? a.play : a.pauseStrip ?? a.pause
  return (
    <div className="border-b border-line bg-sand-paper py-5">
      <div className="flex items-center gap-3 pr-4 motion-reduce:pr-0 md:pr-6">
        <div className="flex min-w-0 flex-1 overflow-hidden mask-fade-x motion-reduce:px-5 motion-reduce:[-webkit-mask-image:none] motion-reduce:[mask-image:none]">
          <div
            className={`flex animate-marquee hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none ${paused ? '[animation-play-state:paused]' : ''}`}
            style={{ ['--marquee-duration' as string]: '45s' }}
          >
            {row()}
            {row(true)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-label={label}
          title={label}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white motion-reduce:hidden"
        >
          {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
