'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Pause, Play } from 'lucide-react'
import type { Photo } from '@/data/types'

type Video = { mp4: string; webm?: string; mp4Small?: string; poster: string }

/** Full-bleed hero: slow film (or photo) with a parallax drift and a line-by-line title reveal. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  image,
  video,
  children,
  size = 'full',
  labels,
  align = 'bottom',
  seoHeading,
}: {
  eyebrow: string
  /** when set, this keyword-rich line becomes the page's <h1> (shown as the eyebrow) and the big title is styled text */
  seoHeading?: string
  title: string
  subtitle?: string
  image: Photo
  video?: Video
  children?: React.ReactNode
  size?: 'full' | 'tall'
  labels: { play: string; pause: string }
  align?: 'bottom' | 'center'
}) {
  const ref = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)
  const [canVideo, setCanVideo] = useState(false)
  const [ready, setReady] = useState(false)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const scale = useTransform(scrollYProgress, [0, 1], [1.02, 1.12])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  // scroll-linked motion values are not covered by MotionConfig reducedMotion, so drop the parallax by hand.
  // The preference is read after mount: the server cannot know it, and reading it during hydration would mismatch.
  const prefersStill = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const still = mounted && !!prefersStill

  useEffect(() => {
    if (!video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    const slow = conn?.saveData === true || /(^|-)2g|3g/.test(conn?.effectiveType ?? '')
    if (reduce || slow) return
    // start the film only after the page has loaded, so it never competes with the hero photo and fonts
    let idle: number | undefined
    const start = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
      idle = ric ? ric(() => setCanVideo(true)) : window.setTimeout(() => setCanVideo(true), 400)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (idle) window.clearTimeout(idle)
    }
  }, [video])

  // pause the film while the hero is off screen
  useEffect(() => {
    const v = videoRef.current
    const el = ref.current
    if (!v || !el || !canVideo) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && playing) v.play().catch(() => {})
      else v.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [canVideo, playing])

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const lines = title.split('\n')

  return (
    <section
      ref={ref}
      className={`relative isolate z-20 flex bg-ink text-white ${size === 'full' ? 'min-h-[100svh]' : 'min-h-[78svh]'} ${align === 'center' ? 'items-center' : 'items-end'}`}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden">
      <m.div className="absolute inset-0" style={still ? undefined : { y, scale }}>
        <Image src={image.src} alt={image.altEn} fill priority sizes="100vw" className="object-cover" style={{ objectPosition: image.focus ?? '50% 50%' }} />
        {video && canVideo && (
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectPosition: image.focus ?? '50% 50%' }}
            onPlaying={() => setReady(true)}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          >
            {video.mp4Small && <source src={video.mp4Small} type="video/mp4" media="(max-width: 767px)" />}
            {video.webm && <source src={video.webm} type="video/webm" />}
            <source src={video.mp4} type="video/mp4" />
          </video>
        )}
      </m.div>
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/50" />
      <div className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-ink/60 to-transparent md:w-2/3" />

      <m.div style={still ? undefined : { opacity: fade }} className="container relative pb-24 pt-28 md:pb-24 md:pt-40">
        <m.div initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.8 }} className="[text-shadow:0_1px_10px_rgba(15,36,48,.5)]">
          {seoHeading ? <h1 className="kicker kicker-light">{seoHeading}</h1> : <p className="kicker kicker-light">{eyebrow}</p>}
        </m.div>
        {/* the measure is in em, not ch: ch follows the width of "0", which differs between the web font and its stand-in,
            and the title would re-wrap (and jump) when the font arrives. 8.4em / 9.5em = 15ch / 17ch in Noto Serif Display. */}
        <TitleTag seo={!!seoHeading} className="mt-5 block max-w-[8.4em] font-display text-[clamp(2.2rem,9.4vw,2.9rem)] font-light leading-[1.04] tracking-[-0.02em] text-balance [text-shadow:0_2px_24px_rgba(15,36,48,.35)] md:mt-6 md:max-w-[9.5em] md:text-display-xl">
          {lines.map((line, i) => (
            <span key={i} className="block overflow-hidden pb-[0.08em]">
              <m.span
                className="block"
                initial={{ y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {line}
                {i < lines.length - 1 ? ' ' : ''}
              </m.span>
            </span>
          ))}
        </TitleTag>
        {subtitle && (
          <m.p
            className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-white [text-shadow:0_1px_12px_rgba(15,36,48,.5)] md:mt-6 md:text-[1.15rem] text-balance"
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            {subtitle}
          </m.p>
        )}
        {children && (
          <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.8 }} className="mt-7 md:mt-9">
            {children}
          </m.div>
        )}
      </m.div>

      {video && canVideo && (
        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-6 right-6 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20"
          aria-label={playing ? labels.pause : labels.play}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
    </section>
  )
}

function TitleTag({ seo, className, children }: { seo: boolean; className: string; children: React.ReactNode }) {
  return seo ? (
    <p className={className} role="presentation">
      {children}
    </p>
  ) : (
    <h1 className={className}>{children}</h1>
  )
}
