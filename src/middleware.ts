import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, type Locale } from './lib/i18n'

const PUBLIC_FILE = /\.[^/]+$/

function preferred(req: NextRequest): Locale {
  const cookie = req.cookies.get('lang')?.value
  if (isLocale(cookie)) return cookie
  const header = req.headers.get('accept-language') ?? ''
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: tag.toLowerCase().slice(0, 2), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  return (ranked.find((r) => isLocale(r.tag))?.tag as Locale) ?? defaultLocale
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/admin') || PUBLIC_FILE.test(pathname)) return
  const first = pathname.split('/')[1]
  if (isLocale(first)) return
  const url = req.nextUrl.clone()
  // an unknown language code (/de/cruises) is replaced, not prefixed (/en/de/cruises)
  const rest = /^[a-z]{2}$/i.test(first) ? pathname.slice(first.length + 1) : pathname
  url.pathname = `/${preferred(req)}${rest === '/' ? '' : rest}`
  return NextResponse.redirect(url, 307)
}

export const config = {
  matcher: ['/((?!_next|api|media|favicon|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|llms|manifest).*)'],
}
