'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowRight, BedDouble, ChevronLeft, ChevronRight, Ruler, Users } from 'lucide-react'
import { countLabel, sizeLabel } from './PropertyGlance'
import { featureIcon } from '@/components/ui/featureIcons'
import type { Photo, UnitGroup } from '@/data/types'
import { fill, href, tr, type Dict, type Locale } from '@/lib/i18n'

export function UnitCard({
  unit,
  fallback,
  locale,
  units,
  common,
  ui,
  g,
  accent,
}: {
  unit: UnitGroup
  fallback: Photo
  locale: Locale
  units: Dict
  common: Dict
  ui: Dict
  g: Dict
  accent: 'sea' | 'terra'
}) {
  const t = units[unit.key]
  const photos = unit.photos.length ? unit.photos : [fallback]
  const [emblaRef, embla] = useEmblaCarousel({ loop: photos.length > 1 })
  const [sel, setSel] = useState(0)
  const onSelect = useCallback(() => embla && setSel(embla.selectedScrollSnap()), [embla])
  useEffect(() => {
    if (!embla) return
    embla.on('select', onSelect)
    return () => {
      embla.off('select', onSelect)
    }
  }, [embla, onSelect])

  const accentText = accent === 'sea' ? 'text-sea' : 'text-terra'
  const bookHref = `${href(locale, '/book')}?property=${unit.property}&unit=${unit.key}`

  return (
    <article id={unit.key} className="scroll-mt-40 overflow-hidden rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 xl:grid xl:grid-cols-[1.1fr_1fr]">
      {/* The photo keeps the shape of the originals (3:2) at every width, so the bed is never cropped away. Beside a
          long description (from 1280px) the space under it shows the other photos as thumbnails. */}
      <div className="xl:flex xl:flex-col">
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {photos.map((p) => (
                <div key={p.src} className="relative aspect-[4/3] min-w-0 flex-[0_0_100%] md:aspect-[3/2]">
                  <Image src={p.src} alt={p.altEn} fill sizes="(min-width:1280px) 52vw, 100vw" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
          {photos.length > 1 && (
            <>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-ink/40 px-2.5 py-1.5 backdrop-blur">
                {photos.map((p, i) => (
                  <button
                    key={p.src}
                    type="button"
                    onClick={() => embla?.scrollTo(i)}
                    // a 6px dot with a 24px hit area
                    className={`relative h-1.5 rounded-full transition-all after:absolute after:-inset-[9px] after:content-[""] ${i === sel ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                    aria-label={fill(common.a11y.photo, { index: i + 1, total: photos.length })}
                    aria-current={i === sel ? 'true' : undefined}
                  />
                ))}
              </div>
              <button type="button" onClick={() => embla?.scrollPrev()} aria-label={common.a11y.prev} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => embla?.scrollNext()} aria-label={common.a11y.next} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {photos.length > 1 && (
          // a mouse shortcut only: the dots above are the accessible controls
          <div className="relative hidden flex-1 xl:block" aria-hidden="true">
            <div className="absolute inset-0 grid auto-rows-max grid-cols-4 content-start gap-1.5 overflow-hidden p-1.5 [-webkit-mask-image:linear-gradient(to_bottom,#000_75%,transparent)] [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]">
              {photos.map((p, i) => (
                <button
                  key={p.src}
                  type="button"
                  tabIndex={-1}
                  onClick={() => embla?.scrollTo(i)}
                  className={`relative aspect-[3/2] overflow-hidden rounded-lg transition-opacity ${i === sel ? `ring-2 ring-offset-1 ${accent === 'sea' ? 'ring-sea' : 'ring-terra'}` : 'opacity-75 hover:opacity-100'}`}
                >
                  <Image src={p.src} alt="" fill sizes="170px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col p-7 md:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-[0.75rem] font-semibold uppercase tracking-[0.16em] ${accentText}`}>{t.bestFor}</p>
          <span className={`rounded-full px-3 py-1 text-[0.78rem] font-semibold ${accent === 'sea' ? 'bg-sea-mist text-sea-deep' : 'bg-terra-light text-terra-deep'}`}>{countLabel(g, unit.count)}</span>
        </div>
        <h3 className="mt-2 font-display text-display-sm">{t.name}</h3>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-[0.88rem]">
          {[
            { icon: Users, label: g.table.guests, value: tr(common, 'units.upTo', { count: unit.maxGuests }) },
            { icon: Ruler, label: g.table.size, value: sizeLabel(g, unit.size[0], unit.size[1]) },
            { icon: BedDouble, label: g.table.layout, value: g.layout[unit.layout] },
          ].map((x) => (
            <div key={x.label} className="rounded-xl bg-sand/60 px-2.5 py-2.5 sm:px-3">
              {/* the icons need tiles wider than a phone's third (there the uppercase label alone fills it, so it is also set
                  tighter), as in PropertyDuo */}
              <dt className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-mute sm:tracking-[0.12em]">
                <x.icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" /> {x.label}
              </dt>
              <dd className="mt-1 font-medium leading-snug text-ink">{x.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-[0.98rem] leading-relaxed text-ink-soft text-pretty">{t.description}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {unit.features.map((f) => {
            const Icon = featureIcon[f]
            return (
              <li key={f} className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-[0.8rem] font-medium text-ink-soft">
                <Icon className="h-3.5 w-3.5" /> {common.features[f]}
              </li>
            )
          })}
        </ul>
        {unit.variants.length > 1 && (
          <div className="mt-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{ui.variants}</p>
            <ul className="mt-2 space-y-1 text-[0.88rem] text-ink-soft">
              {unit.variants.map((v) => (
                <li key={v} className="flex gap-2">
                  <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${accent === 'sea' ? 'bg-sea' : 'bg-terra'}`} />
                  {t.variants?.[v] ?? v}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex-1" />
        {/* prices are live in the family's booking engine: where a price would sit, a way to see them for your dates */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <div className="min-w-0">
            <Link href={bookHref} className={`font-semibold underline decoration-1 underline-offset-4 hover:decoration-2 ${accent === 'sea' ? 'decoration-sea' : 'decoration-terra'}`}>
              {ui.seePrices}
            </Link>
            <p className="mt-1 text-[0.8rem] text-ink-mute">{ui.minStayNote}</p>
          </div>
          <Link href={bookHref} className={`btn ${accent === 'sea' ? 'btn-sea' : 'btn-terra'}`}>
            {common.cta.chooseThis} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
