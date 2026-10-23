'use client'

import { useId, useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Every answer is always in the HTML (search engines and AI crawlers read it, and it matches the FAQPage
 * JSON-LD); closed answers are collapsed with a grid-rows transition and made inert for keyboards and readers.
 */
export function Accordion({ items, defaultOpen = 0 }: { items: { q: string; a: string }[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen)
  const id = useId()
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <h3>
              <button
                type="button"
                id={`${id}-h-${i}`}
                aria-controls={`${id}-p-${i}`}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-[1.06rem] font-medium transition-colors hover:text-sea"
              >
                {it.q}
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-ink/10 transition-all duration-300 ${isOpen ? 'rotate-45 bg-ink text-white' : ''}`}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div
              id={`${id}-p-${i}`}
              role="region"
              aria-labelledby={`${id}-h-${i}`}
              aria-hidden={!isOpen}
              {...(!isOpen ? { inert: '' as unknown as boolean } : {})}
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-swift ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-6 text-[1rem] leading-relaxed text-ink-soft">{it.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
