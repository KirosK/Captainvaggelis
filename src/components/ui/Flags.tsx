import type { Locale } from '@/lib/i18n'

/**
 * Small round SVG flags (emoji flags do not render on Windows). EN uses the UK flag.
 * The circle comes from the wrapper, so no clipPath ids are repeated when several flags are on the page.
 */
export function Flag({ locale, className = 'h-4 w-4' }: { locale: Locale; className?: string }) {
  return (
    <span className={`${className} inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-black/10`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="block h-full w-full">
        {locale === 'el' && (
          <>
            <rect width="24" height="24" fill="#0D5EAF" />
            {[2.67, 8, 13.33, 18.67].map((y) => (
              <rect key={y} y={y} width="24" height="2.67" fill="#fff" />
            ))}
            <rect width="13.33" height="13.33" fill="#0D5EAF" />
            <rect x="5.33" width="2.67" height="13.33" fill="#fff" />
            <rect y="5.33" width="13.33" height="2.67" fill="#fff" />
          </>
        )}
        {locale === 'it' && (
          <>
            <rect width="8" height="24" fill="#009246" />
            <rect x="8" width="8" height="24" fill="#fff" />
            <rect x="16" width="8" height="24" fill="#CE2B37" />
          </>
        )}
        {locale === 'en' && (
          <>
            <rect width="24" height="24" fill="#012169" />
            <path d="M0 0 24 24M24 0 0 24" stroke="#fff" strokeWidth="4.8" />
            <path d="M0 0 24 24M24 0 0 24" stroke="#C8102E" strokeWidth="1.6" />
            <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="8" />
            <path d="M12 0v24M0 12h24" stroke="#C8102E" strokeWidth="4.8" />
          </>
        )}
      </svg>
    </span>
  )
}
