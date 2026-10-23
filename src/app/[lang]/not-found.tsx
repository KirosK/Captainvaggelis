import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { ForPathLocale } from '@/components/layout/LanguageSwitcher'
import { getDictionary, href, locales, type Dict, type Locale } from '@/lib/i18n'
import { properties } from '@/data/properties'

/** Keeps "&" with the word after it, so a wrapped name reads "Theodora Studios / & Apartments" and no line ends on "&". */
const keepAmp = (s: string) => s.replace(/ & /g, ' & ')

function NotFoundContent({ locale, c }: { locale: Locale; c: Dict }) {
  const nf = c.notFound
  // Stays first: they are what most lost visitors were looking for.
  const links = [
    { path: '/aegealis', label: properties.aegealis.name, desc: c.nav.stayDesc?.aegealis },
    { path: '/theodora', label: properties.theodora.name, desc: c.nav.stayDesc?.theodora },
    { path: '/cruises', label: c.nav.cruises, desc: c.nav.allCruises },
  ]
  return (
    <>
      <p className="kicker kicker-light mt-8">{nf.kicker}</p>
      <h1 className="mt-5 max-w-3xl font-display text-display-lg font-light text-balance">{nf.title}</h1>
      <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/75 text-pretty">{nf.body}</p>
      <Link href={href(locale)} className="btn btn-light mt-9">
        {nf.cta}
      </Link>

      <nav className="mt-16 w-full max-w-4xl" aria-label={nf.popular}>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/50" aria-hidden="true">
          {nf.popular}
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {links.map((l) => (
            <li key={l.path}>
              <Link
                href={href(locale, l.path)}
                className="group flex h-full flex-col rounded-xl2 bg-white/[0.06] p-5 text-left ring-1 ring-inset ring-white/15 transition-colors duration-300 hover:bg-white/[0.11]"
              >
                <span className="font-display text-[1.2rem] leading-snug text-balance">{keepAmp(l.label)}</span>
                {l.desc && <span className="mt-1.5 text-[0.86rem] leading-snug text-white/65">{l.desc}</span>}
                <ArrowRight className="mt-auto h-4 w-4 translate-y-3 text-white/70 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

/**
 * Branded 404, rendered inside the [lang] layout. Next does not pass the [lang] param to not-found.tsx, so the
 * server prepares the three short variants and <ForPathLocale> renders the one for the language in the URL.
 * The section is dark like the hero pages; data-dark-hero tells the header to start transparent over it, as it does there.
 * Unknown /{lang}/… URLs reach this through app/[lang]/[...rest]/page.tsx (which also sets the localised <title>).
 */
export default async function NotFound() {
  const dicts = await Promise.all(locales.map(async (l) => [l, (await getDictionary(l)).common] as const))
  const variants = Object.fromEntries(dicts.map(([l, c]) => [l, <NotFoundContent key={l} locale={l} c={c} />])) as Record<Locale, React.ReactNode>
  // Only the localised part is repeated per language; the shell (glow, logo) is shared.
  return (
    <section data-dark-hero="" className="relative isolate overflow-hidden border-b border-white/10 bg-ink text-white [&_:focus-visible]:outline-white">
      <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-sea/30 blur-3xl" aria-hidden="true" />
      <div className="container relative flex min-h-[88vh] flex-col items-center justify-center pb-20 pt-36 text-center md:pt-40">
        <LogoMark className="h-14 w-14 text-white/90" />
        <ForPathLocale {...variants} />
      </div>
    </section>
  )
}
