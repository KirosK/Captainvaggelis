'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Logo } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { href, type Dict, type Locale } from '@/lib/i18n'
import { properties } from '@/data/properties'

/** Pages whose first screen is a dark full-bleed hero: the header starts transparent there. */
const DARK_HERO = [/^\/[a-z]{2}$/, /^\/[a-z]{2}\/(aegealis|theodora|cruises|guide)$/]

export function Header({ locale, common, stayMeta, cruiseSlugs }: { locale: Locale; common: Dict; stayMeta: Record<string, { identity: string; line: string }>; cruiseSlugs: string[] }) {
  const pathname = usePathname() ?? `/${locale}`
  // only real cruise pages have a hero: an unknown slug shows the 404 page
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [stayOpen, setStayOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const stayRef = useRef<HTMLDivElement>(null)
  const stayButton = useRef<HTMLButtonElement>(null)
  // other pages that open on a dark band (the 404) mark it with data-dark-hero; they are found once the page is in the DOM
  const [markedDark, setMarkedDark] = useState(false)
  useEffect(() => setMarkedDark(!!document.querySelector('main [data-dark-hero]')), [pathname])
  const darkHero = markedDark || DARK_HERO.some((r) => r.test(pathname)) || cruiseSlugs.some((s) => pathname === `/${locale}/cruises/${s}`)
  const overHero = darkHero && !scrolled && !open

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
    setStayOpen(false)
  }, [pathname])

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    if (!open) return
    // While the menu is open the page behind it is out of reach (keyboard and screen readers), the header stays usable,
    // and focus starts on the first link.
    const behind = Array.from(document.querySelectorAll<HTMLElement>('main, footer, [data-dock], a[href="#main"]'))
    behind.forEach((el) => el.setAttribute('inert', ''))
    const raf = requestAnimationFrame(() => document.querySelector<HTMLElement>('#mobile-menu a')?.focus({ preventScroll: true }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      behind.forEach((el) => el.removeAttribute('inert'))
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The "Stay" dropdown closes on Escape (focus goes back to its button) and on a tap or click outside it.
  useEffect(() => {
    if (!stayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStayOpen(false)
        stayButton.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!stayRef.current?.contains(e.target as Node)) setStayOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [stayOpen])

  const nav = common.nav
  const links = [
    { href: href(locale, '/cruises'), label: nav.cruises },
    { href: href(locale, '/guide'), label: nav.guide },
    { href: href(locale, '/faq'), label: nav.faq },
    { href: href(locale, '/contact'), label: nav.contact },
  ]
  const active = (h: string) => pathname === h || pathname.startsWith(h + '/')
  const stayActive = active(href(locale, '/aegealis')) || active(href(locale, '/theodora'))
  // the long guide label gets a short form until the bar has room for it
  const guideShort = (nav as { guideShort?: string }).guideShort ?? nav.guide
  // on a property page the Book button opens the booking on that property
  const onProperty = pathname.match(/^\/[a-z]{2}\/(aegealis|theodora)(\/|$)/)?.[1]
  const bookHref = onProperty ? `${href(locale, '/book')}?property=${onProperty}` : href(locale, '/book')

  return (
    <>
    <header
      className={`fixed inset-x-0 top-[var(--banner-h,0px)] z-50 transition-[background-color,box-shadow,color,backdrop-filter] duration-500 ease-swift ${
        overHero ? 'bg-transparent text-white [&_:focus-visible]:outline-white' : 'bg-sand-paper/95 text-ink shadow-[0_1px_0_rgba(15,36,48,.06)] backdrop-blur-xl'
      }`}
    >
      <div className="container flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link href={href(locale)} className="relative z-10 shrink-0" aria-label={`Captain Vangelis — ${nav.home}`}>
          <Logo tone={overHero ? 'light' : 'dark'} sub={common.brand.place} />
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label={common.a11y.mainNav}>
          <div
            ref={stayRef}
            className="relative"
            // hover opens it for a mouse only: on touch the tap toggles it, and a synthetic mouseenter would undo that tap
            onPointerEnter={(e) => e.pointerType === 'mouse' && setStayOpen(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setStayOpen(false)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setStayOpen(false)}
          >
            <button
              ref={stayButton}
              type="button"
              className={`relative flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[0.92rem] font-medium transition-opacity ${stayActive || stayOpen ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
              aria-expanded={stayOpen}
              aria-controls="stay-menu"
              onClick={() => setStayOpen((v) => !v)}
            >
              {nav.stay}
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${stayOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              {stayActive && <m.span layoutId="nav-dot" className="absolute bottom-0.5 left-[calc(50%-0.5rem)] h-1 w-1 -translate-x-1/2 rounded-full bg-current" />}
            </button>
            <AnimatePresence>
              {stayOpen && (
                <m.div
                  id="stay-menu"
                  // x stays in the animation so framer's transform does not override the centring
                  initial={{ opacity: 0, x: '-50%', y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: '-50%', y: 6, scale: 0.98 }}
                  transition={{ duration: 0.28 }}
                  className="absolute left-1/2 top-full w-[560px] pt-3"
                >
                  <div className="grid grid-cols-2 gap-2 rounded-xl3 bg-white p-2 text-ink shadow-lift ring-1 ring-ink/5">
                    {(['aegealis', 'theodora'] as const).map((p) => (
                      <Link
                        key={p}
                        href={href(locale, `/${p}`)}
                        aria-current={active(href(locale, `/${p}`)) ? 'page' : undefined}
                        className={`group rounded-xl2 p-2 transition-colors hover:bg-sand ${active(href(locale, `/${p}`)) ? 'bg-sand/70' : ''}`}
                      >
                        <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                          <Image src={properties[p].hero.src} alt="" fill sizes="260px" className="object-cover transition-transform duration-700 ease-swift group-hover:scale-105" />
                        </div>
                        <div className="px-1 pb-1 pt-3">
                          <div className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${p === 'aegealis' ? 'text-sea' : 'text-terra'}`}>{stayMeta[p]?.identity}</div>
                          <div className="mt-0.5 font-display text-lg leading-tight">{properties[p].name}</div>
                          <div className="mt-1 text-[0.82rem] text-ink-mute">{nav.stayDesc[p]}</div>
                          <div className="mt-1 text-[0.78rem] font-medium text-ink-soft">{stayMeta[p]?.line}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? 'page' : undefined}
              className={`relative whitespace-nowrap rounded-full px-3.5 py-2 text-[0.92rem] font-medium transition-opacity ${active(l.href) ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
            >
              {l.href === href(locale, '/guide') && guideShort !== l.label ? (
                <>
                  <span className="min-[1400px]:hidden">{guideShort}</span>
                  <span className="hidden min-[1400px]:inline">{l.label}</span>
                </>
              ) : (
                l.label
              )}
              {active(l.href) && <m.span layoutId="nav-dot" className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" />}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher locale={locale} tone={overHero ? 'light' : 'dark'} label={nav.language} codes="wide" />
          </div>
          <Link href={bookHref} className={`btn hidden whitespace-nowrap px-5 py-3 sm:inline-flex ${overHero ? 'btn-light' : 'btn-primary'}`}>
            {nav.book}
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="relative z-10 grid h-11 w-11 place-items-center rounded-full xl:hidden"
            aria-label={open ? common.a11y.closeMenu : common.a11y.openMenu}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

    </header>
      <AnimatePresence>
        {open && (
          <m.div
            className="fixed inset-0 z-40 overflow-y-auto bg-sand-paper pt-[calc(var(--header-h)+var(--banner-h,0px))] text-ink xl:hidden"
            id="mobile-menu"
            role="dialog"
            aria-label={common.a11y.mobileNav}
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <m.nav
              className="container flex flex-col gap-1 pt-6"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}
              aria-label={common.a11y.mainNav}
            >
              {[
                { href: href(locale, '/aegealis'), label: properties.aegealis.name, sub: `${nav.stayDesc.aegealis} · ${stayMeta.aegealis?.line ?? ''}` },
                { href: href(locale, '/theodora'), label: properties.theodora.name, sub: `${nav.stayDesc.theodora} · ${stayMeta.theodora?.line ?? ''}` },
                ...links.map((l) => ({ ...l, sub: '' })),
              ].map((l) => {
                const current = active(l.href)
                return (
                  <m.div key={l.href} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                    {/* closes on tap even when the link is the page already open (the pathname would not change) */}
                    <Link href={l.href} onClick={() => setOpen(false)} aria-current={current ? 'page' : undefined} className="block border-b border-line py-4 [@media(max-height:800px)]:py-3">
                      <span className="flex items-center gap-3">
                        <span className="font-display text-[1.85rem] leading-tight text-balance">{l.label}</span>
                        {current && <span className="h-2 w-2 shrink-0 rounded-full bg-sea" aria-hidden="true" />}
                      </span>
                      {l.sub && <span className="mt-1 block text-sm text-ink-mute">{l.sub}</span>}
                    </Link>
                  </m.div>
                )
              })}
              {/* language and booking stay in reach at the bottom of the screen, however short the phone */}
              {/* the opaque background sits on a still wrapper, so links never show through while the content fades in */}
              <div className="sticky bottom-0 mt-4 bg-sand-paper pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                <m.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                  <div className="flex items-center justify-between gap-4 md:hidden">
                    <span className="text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{nav.language}</span>
                    <LanguageSwitcher locale={locale} tone="dark" label={nav.language} />
                  </div>
                  <Link href={bookHref} onClick={() => setOpen(false)} className="btn btn-primary mt-4 w-full py-4 md:mt-0">
                    {nav.book}
                  </Link>
                  {/* for screen readers and keyboards: a way out from inside the menu (the visible X sits in the header) */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      menuButton.current?.focus()
                    }}
                    className="sr-only focus:not-sr-only focus:mt-3 focus:flex focus:w-full focus:items-center focus:justify-center focus:gap-2 focus:rounded-full focus:py-3 focus:text-[0.95rem] focus:font-semibold focus:ring-1 focus:ring-ink/15"
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> {common.a11y.closeMenu}
                  </button>
                </m.div>
              </div>
            </m.nav>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
