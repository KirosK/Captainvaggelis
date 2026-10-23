'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import type { Photo } from '@/data/types'
import { fill } from '@/lib/i18n'

export type LightboxLabels = {
  /** accessible name of the dialog, e.g. "Photo gallery" */
  dialog?: string
  close: string
  prev: string
  next: string
  counter: (i: number, n: number) => string
}

// Elements that take part in the Tab order inside the dialog (the inactive thumbnails use tabIndex -1).
const TABBABLE = 'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex="0"]'

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -48 }),
}

/**
 * Fullscreen photo viewer: arrows, swipe or drag, keyboard (← → Home End Esc) and a thumbnail rail.
 * It is a modal dialog: the page behind is made inert, Tab stays inside, and focus returns to the opener on close.
 * `photos` must already carry localised alt texts (see localized() in src/data/alts.ts).
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
  labels,
}: {
  photos: Photo[]
  index: number | null
  onClose: () => void
  onIndex: (i: number) => void
  labels: LightboxLabels
}) {
  const open = index !== null
  const n = photos.length
  const [mounted, setMounted] = useState(false)
  const [dir, setDir] = useState(1)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const show = useCallback(
    (next: number, direction: number) => {
      setDir(direction)
      onIndex(((next % n) + n) % n)
    },
    [n, onIndex],
  )
  const go = useCallback((step: number) => index !== null && show(index + step, step), [index, show])

  // Keyboard: Escape closes, arrows/Home/End move, Tab is kept inside the dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Home') show(0, -1)
      else if (e.key === 'End') show(n - 1, 1)
      else if (e.key === 'Tab') {
        const root = dialogRef.current
        if (!root) return
        const items = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE))
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, go, show, n, onClose])

  // On open: lock scrolling, make everything behind the dialog inert and focus Close.
  // On close: undo all of that and return focus to the element that opened the viewer.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const background = Array.from(document.body.children).filter((el) => el !== dialog && !el.hasAttribute('inert'))
    background.forEach((el) => el.setAttribute('inert', ''))
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      background.forEach((el) => el.removeAttribute('inert'))
      html.style.overflow = prevOverflow
      if (opener && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  // Keep the active thumbnail in view (scrolls the rail only, never the page). Roving tabindex: when a
  // thumbnail had focus and the photo changed (arrows, swipe, prev/next), focus follows the new current one.
  useEffect(() => {
    const rail = railRef.current
    const thumb = rail?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!rail || !thumb) return
    if (document.activeElement !== thumb && rail.contains(document.activeElement)) thumb.focus({ preventScroll: true })
    const r = rail.getBoundingClientRect()
    const t = thumb.getBoundingClientRect()
    const delta = t.left - r.left - (r.width - t.width) / 2
    if (Math.abs(delta) > 4) rail.scrollBy({ left: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [index])

  if (!mounted) return null
  const photo = index !== null ? photos[index] : null
  const several = n > 1

  return createPortal(
    <AnimatePresence>
      {open && photo && (
        <m.div
          ref={dialogRef}
          key="lightbox"
          // tabIndex -1 keeps focus inside the dialog when someone clicks or drags on the photo
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex flex-col bg-ink/95 text-white outline-none backdrop-blur-sm [&_:focus-visible]:outline-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={labels.dialog ?? labels.counter(index! + 1, n)}
        >
          <div className="flex items-center justify-between px-5 py-4 text-[0.85rem] text-white/75">
            <span className="tabular-nums" aria-live="polite" aria-atomic="true">
              {labels.counter(index! + 1, n)}
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={labels.close}
              title={labels.close}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout" custom={dir}>
              <m.div
                key={photo.src}
                className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing md:px-20"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                drag={several ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -500) go(1)
                  else if (info.offset.x > 60 || info.velocity.x > 500) go(-1)
                }}
              >
                <div className="relative h-full w-full">
                  <Image src={photo.src} alt={photo.altEn} fill sizes="100vw" className="pointer-events-none select-none object-contain" draggable={false} priority />
                </div>
              </m.div>
            </AnimatePresence>
            {several && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={labels.prev}
                  title={labels.prev}
                  className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/45 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-ink/70 md:h-12 md:w-12 md:bg-white/10 md:ring-0 md:hover:bg-white/20"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={labels.next}
                  title={labels.next}
                  className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/45 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-ink/70 md:h-12 md:w-12 md:bg-white/10 md:ring-0 md:hover:bg-white/20"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {/* The image alt already carries this text, so the visible caption is hidden from screen readers. */}
          <p className="mx-auto max-w-3xl px-6 pt-3 text-center text-[0.9rem] text-white/75 text-pretty" aria-hidden="true">
            {photo.altEn}
          </p>
          {several ? (
            <div ref={railRef} className="scrollbar-none flex gap-2 overflow-x-auto px-5 py-4">
              {photos.map((p, i) => (
                <button
                  key={p.src}
                  type="button"
                  onClick={() => show(i, i >= index! ? 1 : -1)}
                  tabIndex={i === index ? 0 : -1}
                  aria-current={i === index ? 'true' : undefined}
                  aria-label={labels.counter(i + 1, n)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition ${i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-45 hover:opacity-80'}`}
                >
                  <Image src={p.src} alt="" fill sizes="80px" className="object-cover" draggable={false} />
                </button>
              ))}
            </div>
          ) : (
            <div className="h-6" />
          )}
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export type MosaicTile = { span: string; sizes: string }

/**
 * The clickable photo mosaic that opens the viewer (layout and localisation are prepared by <Gallery>, a server component).
 * Tile names come from the photo alt text; the last tile also carries the visible "View all N photos" text.
 */
export function LightboxGallery({
  photos,
  tiles,
  labels,
  viewAll,
}: {
  /** every photo of the set, with localised alts; the first tiles.length are shown in the mosaic */
  photos: Photo[]
  tiles: MosaicTile[]
  /** photo is a template such as "Photo {index} of {total}" */
  labels: { dialog: string; close: string; prev: string; next: string; photo: string }
  viewAll?: string
}) {
  const [index, setIndex] = useState<number | null>(null)
  const counter = useCallback((i: number, total: number) => fill(labels.photo, { index: i, total }), [labels.photo])
  const more = photos.length > tiles.length

  return (
    <>
      <div className="grid grid-flow-dense auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[200px] md:auto-rows-[230px] md:grid-cols-4">
        {tiles.map((t, i) => {
          const p = photos[i]
          const last = more && i === tiles.length - 1
          return (
            <m.button
              key={p.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-haspopup="dialog"
              aria-label={p.altEn ? undefined : counter(i + 1, photos.length)}
              className={`group relative overflow-hidden rounded-xl2 bg-sand ${t.span}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: (i % 5) * 0.06 }}
            >
              <Image
                src={p.src}
                alt={p.altEn}
                fill
                sizes={t.sizes}
                className="object-cover transition-transform duration-[1.2s] ease-swift group-hover:scale-[1.07]"
                style={p.focus ? { objectPosition: p.focus } : undefined}
              />
              <span className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/10" aria-hidden="true" />
              {last && viewAll && (
                <span className="absolute inset-0 grid place-items-center bg-ink/55 text-white backdrop-blur-[2px]">
                  <span className="flex items-center gap-2 px-3 text-center font-semibold">
                    <Images className="h-5 w-5 shrink-0" aria-hidden="true" /> {viewAll}
                  </span>
                </span>
              )}
            </m.button>
          )
        })}
      </div>
      <Lightbox
        photos={photos}
        index={index}
        onClose={() => setIndex(null)}
        onIndex={setIndex}
        labels={{ dialog: labels.dialog, close: labels.close, prev: labels.prev, next: labels.next, counter }}
      />
    </>
  )
}
