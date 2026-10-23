'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const KEY = 'demo-banner-hidden'

/** Thin notice that this is a preview. Sets --banner-h so the fixed header sits below it. */
export function DemoBanner({ text }: { text: string }) {
  const [hidden, setHidden] = useState(true)
  useEffect(() => {
    let stored = false
    try {
      stored = sessionStorage.getItem(KEY) === '1'
    } catch {}
    setHidden(stored)
  }, [])
  useEffect(() => {
    document.documentElement.style.setProperty('--banner-h', hidden ? '0px' : '34px')
  }, [hidden])
  if (hidden) return null
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-[34px] items-center justify-center gap-3 bg-ink px-10 text-center text-[0.75rem] font-medium tracking-wide text-sand-paper/90">
      <span className="truncate">{text}</span>
      <button
        type="button"
        aria-label="Close"
        className="absolute right-2 grid h-7 w-7 place-items-center rounded-full hover:bg-white/10"
        onClick={() => {
          setHidden(true)
          try {
            sessionStorage.setItem(KEY, '1')
          } catch {}
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
