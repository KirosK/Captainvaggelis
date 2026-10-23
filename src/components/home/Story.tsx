import Image from 'next/image'
import { Reveal } from '@/components/ui/Reveal'
import { Timeline } from './Timeline'
import { historyPhotos } from '@/data/cruiseMedia'
import { altFor } from '@/data/alts'
import { quote, type Dict, type Locale } from '@/lib/i18n'

export function Story({ t, locale }: { t: Dict; locale: Locale }) {
  const paragraphs = String(t.body).split('\n\n')
  const [first, second] = historyPhotos
  return (
    <section className="relative overflow-hidden bg-sand-paper py-24 md:py-36">
      <div className="container grid gap-16 lg:grid-cols-12">
        <div className="relative lg:col-span-5">
          <div className="sticky top-32">
            {first && (
              <Reveal y={40}>
                {/* the archive photo is landscape (1024 × 731): shown at its own ratio, so the whole boat stays in frame */}
                <figure className="relative aspect-[7/5] overflow-hidden rounded-xl3 shadow-lift">
                  <Image src={first.src} alt={altFor(first, locale)} fill sizes="(min-width:1024px) 38vw, 100vw" className="object-cover sepia-[.15]" />
                </figure>
              </Reveal>
            )}
            {second && (
              // a small archive print (the scan is only 248 px wide): never shown larger than the source, in a white
              // photo border with a soft shadow, so the age of the picture reads as intended. From lg it hangs out into the
              // gap beside the photo, so it leaves the boat in view.
              <Reveal delay={0.2} y={40} className="absolute -bottom-10 -right-4 hidden w-[180px] md:block md:w-[200px] lg:-right-24 lg:w-[170px] xl:w-[200px]">
                <figure className="rotate-[2.5deg] bg-white p-2 pb-3 shadow-lift ring-1 ring-ink/10">
                  <Image src={second.src} alt={altFor(second, locale)} width={second.width} height={second.height} sizes="200px" className="block h-auto w-full sepia-[.1]" />
                </figure>
              </Reveal>
            )}
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Reveal y={10} blur={false}>
            <p className="kicker">{t.kicker}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 font-display text-display-lg font-light text-balance">{t.title}</h2>
          </Reveal>
          <div className="mt-8 space-y-5">
            {paragraphs.map((p, i) => (
              <Reveal key={i} delay={0.08 + i * 0.06}>
                <p className="text-[1.06rem] leading-[1.8] text-ink-soft text-pretty">{p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            {/* attribution in a figcaption, outside the quote: a <footer> here would also match the page footer's selectors */}
            <figure className="mt-10 border-l-2 border-sea pl-6">
              <blockquote>
                <p className="font-display text-[1.6rem] font-light italic leading-snug text-ink">{quote(locale, String(t.quote))}</p>
              </blockquote>
              <figcaption className="mt-4 text-[0.82rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{t.signature}</figcaption>
            </figure>
          </Reveal>
          <Timeline items={t.timeline} />
        </div>
      </div>
    </section>
  )
}
