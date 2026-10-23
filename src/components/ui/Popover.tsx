'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { X } from 'lucide-react'

function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
// only what is actually shown: the booking bar keeps a one-month and a two-month calendar and hides one of them
const focusables = (root: HTMLElement | null) => (root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement)) : [])

/**
 * Popover: a dropdown on tablet/desktop (positioned by `className`, e.g. "left-0 bottom-full mb-3"),
 * and a bottom sheet on phones, portalled to <body> so no blurred or clipped ancestor can trap it.
 */
export function Popover({
  open,
  onClose,
  children,
  className = '',
  label,
  closeLabel = 'Close',
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  label: string
  closeLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // an empty marker where the popover sits in the page, used to find its trigger (the sheet itself is portalled away)
  const anchor = useRef<HTMLSpanElement>(null)
  const phone = useIsPhone()

  // Focus: on open it moves to the first control in the popover; on close (Escape, a click outside, or a hand-off to the
  // next popover) it goes back to this popover's trigger, unless it has already moved somewhere on purpose.
  useEffect(() => {
    if (!open) return
    const trigger = anchor.current?.parentElement?.querySelector<HTMLElement>('[data-popover-trigger]') ?? (document.activeElement as HTMLElement | null)
    // a calendar starts on its selected (or first bookable) day, anything else on its first control
    const raf = requestAnimationFrame(() => {
      const els = focusables(ref.current)
      ;(els.find((el) => el.matches('.rdp-day[tabindex="0"]')) ?? els[0])?.focus({ preventScroll: true })
    })
    const node = () => ref.current
    return () => {
      cancelAnimationFrame(raf)
      const box = node()
      requestAnimationFrame(() => {
        const a = document.activeElement
        if (!a || a === document.body || (box && box.contains(a))) trigger?.focus({ preventScroll: true })
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      // the phone sheet is modal: Tab cycles inside it
      if (e.key === 'Tab' && phone) {
        const els = focusables(ref.current)
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        const a = document.activeElement
        if (e.shiftKey && (a === first || !ref.current?.contains(a))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (a === last || !ref.current?.contains(a))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onDown = (e: MouseEvent) => {
      if (phone) return
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-popover-trigger]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    if (phone) document.documentElement.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      if (phone) document.documentElement.style.overflow = ''
    }
  }, [open, onClose, phone])

  const marker = <span ref={anchor} hidden />

  if (phone) {
    if (typeof document === 'undefined') return marker
    return (
      <>
        {marker}
        {createPortal(
          <AnimatePresence>
            {open && (
              <>
                <m.div key="scrim" className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                <m.div
                  key="sheet"
                  ref={ref}
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                  className="safe-bottom fixed inset-x-0 bottom-0 z-[81] max-h-[88svh] overflow-auto rounded-t-[28px] bg-white px-5 pt-3 text-ink shadow-lift"
                >
                  <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15" />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-display text-xl">{label}</p>
                    <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-11 w-11 place-items-center rounded-full bg-sand">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-2 pb-4">{children}</div>
                </m.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
      </>
    )
  }

  return (
    <>
      {marker}
      <AnimatePresence>
        {open && (
          <div ref={ref} className={`absolute z-[70] ${className}`}>
            <m.div
              role="dialog"
              aria-label={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.28 }}
              className="max-w-[calc(100vw-2rem)] rounded-xl3 bg-white p-6 text-ink shadow-lift ring-1 ring-ink/5"
            >
              {children}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export function Stepper({
  label,
  hint,
  value,
  min = 0,
  max = 10,
  onChange,
  addLabel,
  removeLabel,
}: {
  label: string
  hint?: string
  value: number
  min?: number
  max?: number
  onChange: (n: number) => void
  /** accessible names for the buttons, e.g. "Add an adult"; they fall back to "+ Adults" / "− Adults" */
  addLabel?: string
  removeLabel?: string
}) {
  // the buttons point to the number, so a screen reader says the current value with the button's name
  const valueId = useId()
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-[0.82rem] text-ink-mute">{hint}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/15 transition hover:ring-ink/40 disabled:opacity-30"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={removeLabel ?? `− ${label}`}
          aria-describedby={valueId}
        >
          −
        </button>
        <span id={valueId} className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/15 transition hover:ring-ink/40 disabled:opacity-30"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={addLabel ?? `+ ${label}`}
          aria-describedby={valueId}
        >
          +
        </button>
      </div>
    </div>
  )
}
