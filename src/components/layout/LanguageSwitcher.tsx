'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { defaultLocale, isLocale, locales, type Locale } from '@/lib/i18n'
import { Flag } from '@/components/ui/Flags'

const short: Record<Locale, string> = { en: 'EN', el: 'ΕΛ', it: 'IT' }
const full: Record<Locale, string> = { en: 'English', el: 'Ελληνικά', it: 'Italiano' }

/** The locale in the current URL (first path segment), falling back to the default. */
export function usePathLocale(): Locale {
  const first = (usePathname() ?? '').split('/')[1]
  return isLocale(first) ? first : defaultLocale
}

/**
 * Renders the variant for the locale in the URL. For UI that has no [lang] param, such as not-found.tsx:
 * the server passes all three (small) variants and only the matching one is rendered.
 */
export function ForPathLocale(variants: Record<Locale, React.ReactNode>) {
  return <>{variants[usePathLocale()]}</>
}

/**
 * EN / ΕΛ / IT pills with round flags. codes="wide" shows only the flags until the screen is 1400px wide
 * (the header is crowded below that); the code stays available to screen readers and the full name is the tooltip.
 */
export function LanguageSwitcher({ locale, tone, label, codes = 'always' }: { locale: Locale; tone: 'light' | 'dark'; label: string; codes?: 'always' | 'wide' }) {
  const pathname = usePathname() ?? `/${locale}`
  const router = useRouter()
  const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex items-center rounded-full p-1 text-[0.78rem] font-semibold ${tone === 'light' ? 'bg-white/10 ring-1 ring-white/25' : 'bg-ink/[0.04] ring-1 ring-ink/10'}`}
    >
      {locales.map((l) => {
        const target = `/${l}${rest}`
        return (
          <Link
            key={l}
            href={target}
            hrefLang={l}
            lang={l}
            aria-current={l === locale ? 'true' : undefined}
            title={full[l]}
            onClick={(e) => {
              document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`
              // keep booking selections (query string) and the current section when switching language
              const { search, hash } = window.location
              if (search || hash) {
                e.preventDefault()
                router.push(`${target}${search}${hash}`)
              }
            }}
            // the ::after layer grows the tap target to about 44px tall without changing the pill's look
            className={`relative inline-flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 ${codes === 'wide' ? 'pr-1.5 min-[1400px]:pr-2.5' : 'pr-2.5'} transition-colors after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] ${
              tone === 'light' ? 'focus-visible:outline-white' : ''
            } ${l === locale ? (tone === 'light' ? 'bg-white text-ink' : 'bg-ink text-white') : 'opacity-75 hover:opacity-100'}`}
          >
            <Flag locale={l} className="h-[18px] w-[18px]" />
            <span className={codes === 'wide' ? 'sr-only min-[1400px]:not-sr-only' : undefined}>{short[l]}</span>
          </Link>
        )
      })}
    </div>
  )
}
