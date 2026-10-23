export const locales = ['en', 'el', 'it'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const htmlLang: Record<Locale, string> = { en: 'en-GB', el: 'el-GR', it: 'it-IT' }
export const ogLocale: Record<Locale, string> = { en: 'en_GB', el: 'el_GR', it: 'it_IT' }

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

export const namespaces = ['common', 'home', 'property', 'units', 'cruises', 'booking', 'guide', 'faq', 'pages', 'reviews', 'glance'] as const
export type Namespace = (typeof namespaces)[number]

// Dictionaries are free-form JSON trees; components read the keys they need.
export type Dict = Record<string, any> // eslint-disable-line

const loaders: Record<Locale, () => Promise<Record<Namespace, Dict>>> = {
  en: () => loadAll('en'),
  el: () => loadAll('el'),
  it: () => loadAll('it'),
}

async function loadAll(locale: Locale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, (await import(`@/content/${locale}/${ns}.json`)).default as Dict] as const),
  )
  return Object.fromEntries(entries) as Record<Namespace, Dict>
}

const cache = new Map<Locale, Promise<Record<Namespace, Dict>>>()
export function getDictionary(locale: Locale) {
  if (!cache.has(locale)) cache.set(locale, loaders[locale]())
  return cache.get(locale)!
}

/** Reads a dotted path from a dictionary and fills {placeholders}. Missing keys render the key so they are easy to spot. */
export function tr(dict: Dict, path: string, vars?: Record<string, string | number>): string {
  const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Dict)[key] : undefined), dict)
  if (typeof value !== 'string') return path
  return vars ? fill(value, vars) : value
}

/** Wraps a quotation in the marks each language uses: “…” in English, «…» in Greek and Italian. */
export function quote(locale: Locale, text: string) {
  return locale === 'en' ? `“${text}”` : `«${text}»`
}

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export function pick<T = unknown>(dict: Dict, path: string): T {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Dict)[key] : undefined), dict) as T
}

export function formatNumber(locale: Locale, n: number, digits = 1) {
  return new Intl.NumberFormat(htmlLang[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

export function formatPrice(locale: Locale, amount: number) {
  return new Intl.NumberFormat(htmlLang[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(locale: Locale, date: Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(htmlLang[locale], opts).format(date)
}

export function weekdayName(locale: Locale, weekday: number, style: 'long' | 'short' = 'long') {
  // weekday: 0 = Sunday … 6 = Saturday. 2023-01-01 was a Sunday.
  return new Intl.DateTimeFormat(htmlLang[locale], { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + weekday)))
}

export function listFormat(locale: Locale, items: string[]) {
  return new Intl.ListFormat(htmlLang[locale], { style: 'long', type: 'conjunction' }).format(items)
}

/** Builds a localised path, e.g. href('el', '/cruises') → '/el/cruises'. */
export function href(locale: Locale, path = '/') {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return `/${locale}${clean}`
}

/** "20 m", "1.7 km" / "1,7 km" — rounds metres to the nearest 10. A no-break space keeps the number with its unit. */
export function formatDistance(locale: Locale, meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}\u00a0${locale === 'el' ? 'μ.' : 'm'}`
  const km = new Intl.NumberFormat(htmlLang[locale], { maximumFractionDigits: meters < 10000 ? 1 : 0 }).format(meters / 1000)
  return `${km}\u00a0${locale === 'el' ? 'χλμ.' : 'km'}`
}

/** "1 night" / "3 nights", "1 guest" / "4 guests" using the singular and plural keys in common.units. */
export function countLabel(common: Dict, kind: 'night' | 'guest', n: number) {
  return n === 1 ? tr(common, `units.${kind}`, { count: n }) : tr(common, `units.${kind}s`, { count: n })
}
