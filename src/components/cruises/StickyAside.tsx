'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Sticky side column for the booking card. When the card fits on screen it sticks under the header;
 * when it is taller than the screen it scrolls with the page until its bottom edge is in view and sticks there,
 * so every part of the card (calendar, totals, the Continue button) is reachable without a scroll box inside the page.
 */
export function StickyAside({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const css = getComputedStyle(document.documentElement)
      const offset = (parseFloat(css.getPropertyValue('--header-h')) || 76) + (parseFloat(css.getPropertyValue('--banner-h')) || 0) + 16
      const room = window.innerHeight - offset - 16
      setTop(el.offsetHeight <= room ? offset : window.innerHeight - el.offsetHeight - 16)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // the demo banner can be closed, which changes --banner-h on <html>
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div ref={ref} className={`lg:sticky lg:top-[calc(var(--header-h)+var(--banner-h,0px)+1rem)] ${className}`} style={top == null ? undefined : { top }}>
      {children}
    </div>
  )
}
