'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'

const FADE = 28 // px of edge fade when the tab strip can scroll further that way

function maskFor(left: boolean, right: boolean) {
  if (left && right) return `linear-gradient(to right, transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent)`
  if (left) return `linear-gradient(to right, transparent, #000 ${FADE}px)`
  if (right) return `linear-gradient(to right, #000 calc(100% - ${FADE}px), transparent)`
  return undefined
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Sticky in-page navigation that tracks the section in view.
 * - Jumps land each section right under the sticky chrome (header + banner + this bar).
 * - Near the top of the page the first tab is active again.
 * - On phones the active tab is scrolled into view, with edge fades where more tabs are hidden.
 */
export function SubNav({ items, cta, label }: { items: { id: string; label: string }[]; cta?: React.ReactNode; label?: string }) {
  const [active, setActive] = useState(items[0]?.id)
  const [fade, setFade] = useState({ left: false, right: false })
  const barRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const lock = useRef<{ id: string; until: number } | null>(null)

  /** Bottom edge of the fixed chrome once this bar is stuck (its CSS top plus its height). */
  const chromeBottom = useCallback(() => {
    const bar = barRef.current
    if (!bar) return 0
    return (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight
  }, [])

  /** scroll-margin so that html scroll-padding + margin equals the chrome height exactly. */
  const alignTargets = useCallback(() => {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    const margin = `${Math.max(0, Math.round(chromeBottom() - pad))}px`
    items.forEach((it) => {
      const el = document.getElementById(it.id)
      if (el) el.style.scrollMarginTop = margin
    })
  }, [items, chromeBottom])

  // Scroll-spy: the active section is the last one whose top has passed a line just below the chrome.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      if (lock.current && Date.now() < lock.current.until) return setActive(lock.current.id)
      lock.current = null
      const line = chromeBottom() + Math.min(160, window.innerHeight * 0.25)
      let current = items[0]?.id
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top <= line) current = it.id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const onResize = () => {
      alignTargets()
      onScroll()
    }
    alignTargets()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [items, chromeBottom, alignTargets])

  // Edge fades on the tab strip.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const left = nav.scrollLeft > 2
      const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2
      setFade((f) => (f.left === left && f.right === right ? f : { left, right }))
    }
    measure()
    nav.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      nav.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Keep the active tab centred in the strip when the strip overflows (scrolls the strip only, never the page).
  useEffect(() => {
    const nav = navRef.current
    const link = nav?.querySelector<HTMLElement>(`[data-section="${active}"]`)
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return
    const n = nav.getBoundingClientRect()
    const l = link.getBoundingClientRect()
    const delta = l.left - n.left - (n.width - l.width) / 2
    if (Math.abs(delta) > 2) nav.scrollBy({ left: delta, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  const mask = maskFor(fade.left, fade.right)

  return (
    <div ref={barRef} className="sticky top-[calc(var(--header-h)+var(--banner-h,0px))] z-30 border-b border-line bg-sand-paper/90 backdrop-blur-xl">
      <div className="container flex items-center justify-between gap-6">
        <m.nav
          ref={navRef}
          layoutScroll
          className="scrollbar-none -mx-2 flex min-w-0 overflow-x-auto"
          aria-label={label}
          style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
        >
          {items.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              data-section={it.id}
              aria-current={active === it.id ? 'true' : undefined}
              onClick={() => {
                // Re-measure (the demo banner may have closed) before the browser jumps, and hold the
                // underline on the chosen tab while the page scrolls past the sections in between.
                alignTargets()
                lock.current = { id: it.id, until: Date.now() + 900 }
                setActive(it.id)
              }}
              className={`relative whitespace-nowrap px-3 py-4 text-[0.88rem] font-medium transition-colors ${active === it.id ? 'text-ink' : 'text-ink-mute hover:text-ink'}`}
            >
              {it.label}
              {active === it.id && <m.span layoutId="subnav" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink" />}
            </a>
          ))}
        </m.nav>
        {cta && <div className="hidden shrink-0 md:block">{cta}</div>}
      </div>
    </div>
  )
}
