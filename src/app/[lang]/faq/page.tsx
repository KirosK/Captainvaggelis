import type { Metadata } from 'next'
import { MessageCircle } from 'lucide-react'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal } from '@/components/ui/Reveal'
import { JsonLd } from '@/components/JsonLd'
import { WhatsAppIcon } from '@/components/ui/icons'
import { whatsappHref, whatsappMessage } from '@/lib/whatsapp'
import { getDictionary, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'
import { breadcrumbLd, faqLd } from '@/lib/jsonld'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({ locale: params.lang, path: '/faq', title: d.pages.seo.faq.title, description: d.pages.seo.faq.description })
}

export default async function FaqPage({ params }: { params: { lang: Locale } }) {
  const locale = params.lang
  const d = await getDictionary(locale)
  const groups = Object.entries(d.faq.groups as Record<string, { title: string; items: Record<string, { q: string; a: string }> }>)
  const all = groups.flatMap(([, g]) => Object.values(g.items))
  return (
    <div className="bg-sand-paper pb-24 pt-[calc(var(--header-h)+var(--banner-h,0px)+3.5rem)]">
      <div className="container grid gap-14 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <h1 className="font-display text-display-lg font-light">{d.faq.title}</h1>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-4 text-[1.05rem] text-ink-soft">{d.faq.intro}</p>
            </Reveal>
            <nav className="mt-8 hidden flex-col gap-1 lg:flex" aria-label={d.faq.title}>
              {groups.map(([k, g]) => (
                <a key={k} href={`#${k}`} className="rounded-xl px-3 py-2 text-[0.95rem] font-medium text-ink-soft hover:bg-sand hover:text-ink">
                  {g.title}
                </a>
              ))}
            </nav>
            <a href={whatsappHref(whatsappMessage(locale, `/${locale}/faq`))} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-8">
              <WhatsAppIcon className="h-5 w-5 text-[#1F8F5F]" /> {d.common.cta.whatsapp}
              <span className="sr-only"> {d.common.a11y.external}</span>
            </a>
          </div>
        </aside>
        <div className="space-y-14 lg:col-span-7 lg:col-start-6">
          {groups.map(([k, g]) => (
            <section key={k} id={k} className="scroll-mt-32">
              <h2 className="mb-4 flex items-center gap-3 font-display text-display-sm">
                <MessageCircle className="h-5 w-5 text-sea" /> {g.title}
              </h2>
              <Accordion items={Object.values(g.items)} defaultOpen={null} />
            </section>
          ))}
        </div>
      </div>
      <JsonLd data={faqLd(all)} />
      <JsonLd data={breadcrumbLd([{ name: d.common.nav.home, path: `/${locale}` }, { name: d.common.nav.faq, path: `/${locale}/faq` }])} />
    </div>
  )
}
