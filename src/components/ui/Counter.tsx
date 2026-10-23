'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

/** Counts up to a number when scrolled into view. Non-numeric parts (e.g. "20 m", "9.1") are preserved. */
export function Counter({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const match = value.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/)
  const [display, setDisplay] = useState(value)
  const still = useReducedMotion()

  useEffect(() => {
    if (!inView || !match || still) return
    const [, pre, num, post] = match
    const decimals = num.includes('.') || num.includes(',') ? num.split(/[.,]/)[1].length : 0
    const sep = num.includes(',') ? ',' : '.'
    const target = parseFloat(num.replace(',', '.'))
    const isYear = decimals === 0 && target > 1900 && target < 2100
    const start = isYear ? target - 60 : 0
    const controls = animate(start, target, {
      duration: isYear ? 1.6 : 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(`${pre}${v.toFixed(decimals).replace('.', sep)}${post}`),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
