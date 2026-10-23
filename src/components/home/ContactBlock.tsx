import { Mail, MapPin, Phone } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal'
import { WhatsAppIcon } from '@/components/ui/icons'
import { site } from '@/data/site'
import type { Dict, Locale } from '@/lib/i18n'
import { whatsappHref, whatsappMessage } from '@/lib/whatsapp'

export function ContactBlock({ t, contact, locale }: { t: Dict; contact: Dict; locale: Locale }) {
  const ch = contact.channels
  // the phone card lists both numbers (the WhatsApp card already shows the first one), so each number is its own link
  const cards = [
    { icon: WhatsAppIcon, title: ch.whatsapp, hint: ch.whatsappHint, links: [{ value: site.phones[0].display, href: whatsappHref(whatsappMessage(locale, `/${locale}`)) }], external: true, accent: 'bg-[#1A7F55] text-white' },
    { icon: Phone, title: ch.phone, hint: ch.phoneHint, links: site.phones.map((ph, i) => ({ value: ph.display, href: `tel:${ph.e164}`, note: i > 0 ? (ch[ph.whoKey] as string | undefined) : undefined })), accent: 'bg-sea text-white' },
    { icon: Mail, title: ch.email, hint: ch.emailHint, links: [{ value: site.email, href: `mailto:${site.email}` }], accent: 'bg-terra text-white' },
  ]
  return (
    <section className="bg-sand py-24 md:py-32">
      {/* side by side only from 1280px, so each card stays at least ~220px wide (at 1024 they sat in 165px columns) */}
      <div className="container grid gap-12 xl:grid-cols-12 xl:items-center">
        <div className="xl:col-span-5">
          <Reveal y={10} blur={false}>
            <p className="kicker">{t.kicker}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.title}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-ink-soft">{t.body}</p>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 flex max-w-md items-start gap-2.5 text-[0.95rem] text-ink-mute">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sea" /> {t.kiosk}
            </p>
          </Reveal>
        </div>
        <Stagger className="grid gap-4 sm:grid-cols-3 xl:col-span-7">
          {cards.map((c) => (
            // From sm the three cards share one set of rows (CSS subgrid), so the icon, title, hint and numbers line up
            // across the cards whatever the length of each hint.
            <StaggerItem key={c.title} className="sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-y-0">
              {/* the first link covers the whole card (::after); any further number sits above it */}
              <div className="group relative flex h-full flex-col rounded-xl2 bg-white p-6 shadow-soft ring-1 ring-ink/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-lift sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-y-0">
                <span className={`grid h-12 w-12 place-items-center rounded-full ${c.accent} transition-transform duration-500 group-hover:scale-110`}>
                  <c.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-6 font-display text-xl">{c.title}</span>
                <span className="mt-1 text-[0.85rem] text-ink-mute">{c.hint}</span>
                <span className="mt-auto block pt-6 sm:mt-0">
                  <span className="flex flex-col gap-1 border-t border-line pt-4">
                    {c.links.map((l, i) => (
                      <a
                        key={l.href}
                        href={l.href}
                        {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        // a phone number never breaks across lines (its note goes underneath); only the long e-mail address may wrap
                        className={`text-[0.9rem] font-semibold text-ink underline-offset-4 hover:underline ${c.icon === Mail ? '[overflow-wrap:anywhere]' : 'whitespace-nowrap'} ${i === 0 ? "after:absolute after:inset-0 after:rounded-xl2 after:content-['']" : 'relative z-10'}`}
                      >
                        {l.value}
                        {'note' in l && l.note && <span className="block whitespace-normal text-[0.8rem] font-normal text-ink-mute">{l.note}</span>}
                      </a>
                    ))}
                  </span>
                </span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
