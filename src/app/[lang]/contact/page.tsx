import type { Metadata } from 'next'
import { Languages, Mail, MapPin, Phone } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { ContactForm } from '@/components/contact/ContactForm'
import { AreaMap } from '@/components/map/AreaMap'
import { WhatsAppIcon } from '@/components/ui/icons'
import { JsonLd } from '@/components/JsonLd'
import { site } from '@/data/site'
import { whatsappHref, whatsappMessage } from '@/lib/whatsapp'
import { getDictionary, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/seo'
import { breadcrumbLd } from '@/lib/jsonld'

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const d = await getDictionary(params.lang)
  return pageMetadata({ locale: params.lang, path: '/contact', title: d.pages.seo.contact.title, description: d.pages.seo.contact.description })
}

export default async function ContactPage({ params }: { params: { lang: Locale } }) {
  const locale = params.lang
  const d = await getDictionary(locale)
  const t = d.pages.contact
  const ch = t.channels
  const channels = [
    { icon: WhatsAppIcon, title: ch.whatsapp, hint: ch.whatsappHint, value: site.phones[0].display, href: whatsappHref(whatsappMessage(locale, `/${locale}/contact`)), external: true },
    { icon: Phone, title: ch.phone, hint: ch.phoneHint, value: site.phones[0].display, href: `tel:${site.phones[0].e164}` },
    { icon: Phone, title: ch.phone, hint: ch.phone2Hint, value: site.phones[1].display, href: `tel:${site.phones[1].e164}` },
    { icon: Mail, title: ch.email, hint: ch.emailHint, value: site.email, href: `mailto:${site.email}` },
    { icon: MapPin, title: ch.kiosk, hint: ch.kioskHint, value: ch.kioskAddress ?? 'Skala, Kefalonia 280 86', href: `https://www.google.com/maps/search/?api=1&query=${site.kiosk.lat},${site.kiosk.lng}`, external: true },
  ]
  return (
    <div className="bg-sand-paper">
      <div className="container pb-20 pt-[calc(var(--header-h)+var(--banner-h,0px)+3.5rem)]">
        <Reveal>
          <p className="kicker">{t.hero.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl font-display text-display-lg font-light text-balance">{t.hero.title}</h1>
          <p className="mt-4 max-w-2xl text-[1.08rem] text-ink-soft">{t.hero.subtitle}</p>
        </Reveal>
        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Stagger className="space-y-3">
              {channels.map((c) => (
                <StaggerItem key={c.hint}>
                  <a href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:shadow-lift">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sea-mist text-sea transition group-hover:bg-sea group-hover:text-white">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.title}</span>
                      <span className="block text-[0.85rem] text-ink-mute">{c.hint}</span>
                      <span className="mt-1 block truncate text-[0.95rem] text-ink">{c.value}</span>
                      {c.external && <span className="sr-only"> {d.common.a11y.external}</span>}
                    </span>
                  </a>
                </StaggerItem>
              ))}
            </Stagger>
            <p className="mt-6 flex items-start gap-2.5 text-[0.92rem] text-ink-soft">
              <Languages className="mt-0.5 h-4 w-4 shrink-0 text-sea" /> {t.languages}
            </p>
          </div>
          <div className="lg:col-span-7">
            <ContactForm t={t.form} common={d.common} />
          </div>
        </div>
      </div>
      <section className="bg-sand py-20">
        <div className="container">
          <AreaMap locale={locale} g={d.glance} initialTab="daily" />
        </div>
      </section>
      <JsonLd data={breadcrumbLd([{ name: d.common.nav.home, path: `/${locale}` }, { name: d.common.nav.contact, path: `/${locale}/contact` }])} />
    </div>
  )
}
