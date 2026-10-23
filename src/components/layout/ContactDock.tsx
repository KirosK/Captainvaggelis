'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { WhatsAppIcon } from '@/components/ui/icons'
import { href, type Dict, type Locale } from '@/lib/i18n'
import { whatsappHref, whatsappMessage } from '@/lib/whatsapp'
import { cruises } from '@/data/cruises'

/**
 * Quiet contact shortcut. From 1280px (full navigation in the header): a small round WhatsApp button in the corner that
 * reveals its label on hover, kept tight to the edge until the page margin grows at 1440px. Below 1280px (burger menu) the
 * page margin is only 20px, so a floating button would sit on the text: phones and tablets get a slim bar with the page's
 * main action and a small WhatsApp icon instead. The message is pre-filled for the page.
 * On a cruise page the main action is that cruise's seat booking, on the cruises hub the timetable, elsewhere the room booking.
 */
export function ContactDock({ locale, common, cruiseNames }: { locale: Locale; common: Dict; cruiseNames: Record<string, string> }) {
  const pathname = usePathname() ?? `/${locale}`
  const [visible, setVisible] = useState(false)
  // true while the page's own booking widget (#book) is on screen, so the bar does not repeat it
  const [bookInView, setBookInView] = useState(false)
  // the footer has its own WhatsApp, phone and e-mail links, and the dock would cover its bottom row
  const [footerInView, setFooterInView] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    setBookInView(false)
    const target = document.getElementById('book')
    if (!target) return
    const io = new IntersectionObserver(([e]) => setBookInView(e.isIntersecting), { threshold: 0.15 })
    io.observe(target)
    return () => io.disconnect()
  }, [pathname])
  useEffect(() => {
    // by id: quotes inside the pages can carry their own <footer>
    const footer = document.getElementById('site-footer')
    if (!footer) return
    const io = new IntersectionObserver(([e]) => setFooterInView(e.isIntersecting))
    io.observe(footer)
    return () => io.disconnect()
  }, [pathname])
  if (pathname.includes('/book')) return null
  const wa = whatsappHref(whatsappMessage(locale, pathname, cruiseNames))
  const cruiseSlug = pathname.match(/^\/[a-z]{2}\/cruises\/([^/]+)$/)?.[1]
  const onCruisesHub = /^\/[a-z]{2}\/cruises$/.test(pathname)
  const onProperty = pathname.match(/^\/[a-z]{2}\/(aegealis|theodora)(\/|$)/)?.[1]
  // a request-only cruise (BBQ, private, wedding) has a request form, not seats
  const requestOnly = !!cruiseSlug && cruises.find((c) => c.slug === cruiseSlug)?.scheduled === false
  const main = cruiseSlug
    ? { href: '#book', label: requestOnly ? common.cta.sendRequest : common.cta.bookCruise }
    : onCruisesHub
      ? { href: '#timetable', label: common.cta.bookACruise }
      : { href: onProperty ? `${href(locale, '/book')}?property=${onProperty}` : href(locale, '/book'), label: common.nav.book }
  const waLabel = `${common.cta.whatsapp} ${common.a11y.external}`
  // the FAQ already shows a WhatsApp button next to the answers
  const showFab = !/^\/[a-z]{2}\/faq$/.test(pathname)

  return (
    <AnimatePresence>
      {visible && showFab && !footerInView && (
        <m.a
          key="fab"
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={waLabel}
          data-dock=""
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35 }}
          className="group fixed bottom-4 right-3 z-40 hidden h-11 items-center overflow-hidden rounded-full bg-white/90 text-[#1A7F55] shadow-soft ring-1 ring-ink/10 backdrop-blur transition-[box-shadow,background-color] duration-300 hover:bg-white hover:shadow-lift xl:flex min-[1440px]:bottom-6 min-[1440px]:right-6 min-[1440px]:h-12"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center min-[1440px]:h-12 min-[1440px]:w-12">
            <WhatsAppIcon className="h-[22px] w-[22px]" />
          </span>
          <span className="max-w-0 whitespace-nowrap text-[0.86rem] font-semibold text-ink opacity-0 transition-all duration-300 ease-swift group-hover:max-w-[12rem] group-hover:pr-5 group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:pr-5 group-focus-visible:opacity-100">
            {common.cta.whatsapp}
          </span>
        </m.a>
      )}
      {visible && !bookInView && !footerInView && (
        <m.div
          key="bar"
          data-dock=""
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ duration: 0.35 }}
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 border-t border-line bg-sand-paper/90 px-3 pt-2.5 backdrop-blur-xl md:gap-3 xl:hidden"
        >
          <Link href={main.href} className="btn btn-primary flex-1 py-3 md:max-w-sm">
            {main.label}
          </Link>
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={waLabel} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#1A7F55] ring-1 ring-ink/10">
            <WhatsAppIcon className="h-5 w-5" />
          </a>
        </m.div>
      )}
    </AnimatePresence>
  )
}
