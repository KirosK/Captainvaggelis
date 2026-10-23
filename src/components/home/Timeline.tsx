'use client'

import { useRef } from 'react'
import { m, useScroll, useTransform } from 'framer-motion'

/** Vertical timeline whose line draws itself as you scroll. */
export function Timeline({ items }: { items: { year: string; text: string }[] }) {
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] })
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])
  return (
    <ol ref={ref} className="relative mt-14 space-y-7 pl-8">
      <span className="absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px bg-line" aria-hidden="true" />
      <m.span style={{ scaleY }} className="absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-sea" aria-hidden="true" />
      {items.map((it, i) => (
        <m.li
          key={it.year}
          className="relative"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: i * 0.05 }}
        >
          <span className="absolute -left-8 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-sea bg-sand-paper" aria-hidden="true" />
          <span className="font-display text-xl tabular-nums text-sea">{it.year}</span>
          <span className="ml-4 text-[1rem] text-ink-soft">{it.text}</span>
        </m.li>
      ))}
    </ol>
  )
}
