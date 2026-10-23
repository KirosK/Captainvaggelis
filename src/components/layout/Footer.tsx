import Link from 'next/link'
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react'
import { LogoMark } from './Logo'
import { LanguageSwitcher } from './LanguageSwitcher'
import { href, tr, type Dict, type Locale } from '@/lib/i18n'
import { site } from '@/data/site'
import { whatsappHref, whatsappMessage } from '@/lib/whatsapp'
import { properties } from '@/data/properties'
import { cruises, scheduledCruises } from '@/data/cruises'
import { WhatsAppIcon } from '@/components/ui/icons'

/** Keeps "&" on the same line as the word before it, so no line starts with "&". */
const keepAmp = (s: string) => s.replace(/ & /g, ' & ')

// Generous tap targets (about 36px) and a white focus ring on the dark background.
const linkCls = 'link-underline inline-block py-1.5 hover:text-white'
const rowCls = 'inline-flex items-center gap-2.5 py-1.5 hover:text-white'
const titleCls = 'text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/50'

export function Footer({ locale, common, cruiseNames }: { locale: Locale; common: Dict; cruiseNames: Record<string, string> }) {
  const year = 2026
  const f = common.footer
  const nav = common.nav

  // Stays first: the accommodation pages are what most visitors (and searches) are after.
  const stayLinks = [
    { path: '/aegealis', label: properties.aegealis.name },
    { path: '/theodora', label: properties.theodora.name },
    { path: '/book', label: nav.book },
    { path: '/guide', label: nav.guide },
    { path: '/faq', label: nav.faq },
  ]
  const onRequest = cruises.filter((c) => c.key === 'private' || c.key === 'wedding')
  const cruiseLinks = [
    { path: '/cruises', label: nav.allCruises },
    ...[...scheduledCruises, ...onRequest].map((c) => ({ path: `/cruises/${c.slug}`, label: cruiseNames[c.key] })),
  ].filter((l) => l.label)

  return (
    <footer id="site-footer" className="relative overflow-hidden bg-ink text-sand-paper/80 [&_:focus-visible]:outline-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-sea/20 blur-3xl" aria-hidden="true" />
      <div className="container relative grid gap-x-12 gap-y-12 pb-28 pt-20 sm:grid-cols-2 md:pb-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3 text-white">
            <LogoMark className="h-10 w-10 shrink-0" />
            <div>
              <div className="font-display text-2xl">{common.brand.name}</div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/55">{common.brand.since}</div>
            </div>
          </div>
          <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-sand-paper/70">{f.about}</p>
          <p className="mt-4 flex max-w-sm gap-2 text-[0.88rem] text-sand-paper/60">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {f.kiosk}
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className={titleCls} aria-hidden="true">
              {nav.language}
            </span>
            <LanguageSwitcher locale={locale} tone="light" label={nav.language} />
          </div>
        </div>

        <div>
          <p className={titleCls}>{nav.stay}</p>
          <ul className="mt-4 space-y-1.5 text-[0.95rem]">
            {stayLinks.map((l) => (
              <li key={l.path}>
                <Link className={linkCls} href={href(locale, l.path)}>
                  {keepAmp(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={titleCls}>{nav.cruises}</p>
          <ul className="mt-4 space-y-1.5 text-[0.95rem]">
            {cruiseLinks.map((l) => (
              <li key={l.path}>
                <Link className={linkCls} href={href(locale, l.path)}>
                  {keepAmp(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={titleCls}>{f.contact}</p>
          <ul className="mt-4 space-y-1.5 text-[0.95rem]">
            <li>
              <a className={rowCls} href={whatsappHref(whatsappMessage(locale, `/${locale}/contact`))} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-4 w-4 shrink-0" /> WhatsApp
                <span className="sr-only"> {common.a11y.external}</span>
              </a>
            </li>
            {site.phones.map((p) => (
              <li key={p.e164}>
                <a className={`${rowCls} tabular-nums`} href={`tel:${p.e164}`}>
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {p.display}
                </a>
              </li>
            ))}
            <li>
              <a className={`${rowCls} break-all`} href={`mailto:${site.email}`}>
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> {site.email}
              </a>
            </li>
            <li>
              <Link className={`${rowCls} group font-semibold text-white`} href={href(locale, '/contact')}>
                {common.cta.askUs}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        {/* md:pr-24 keeps the last links clear of the floating WhatsApp button (fixed bottom-6 right-6). */}
        <div className="container flex flex-col gap-3 py-6 pb-28 text-[0.78rem] text-sand-paper/50 md:pb-6 md:pr-24 lg:flex-row lg:items-center lg:justify-between">
          <p>{tr(common, 'footer.rights', { year })}</p>
          <p>
            {f.licence}: Aegealis {properties.aegealis.licence} · Theodora {properties.theodora.licence}
          </p>
          <div className="flex flex-wrap gap-x-5">
            <Link className="inline-block py-1.5 hover:text-white" href={href(locale, '/privacy')}>
              {f.privacy}
            </Link>
            <Link className="inline-block py-1.5 hover:text-white" href={href(locale, '/terms')}>
              {f.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
