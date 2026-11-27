// Minimal stand-alone HTML pages served by API routes: the mock bank page, the hand-off to the bank,
// and the "payment could not be verified" page. They live outside the site layout on purpose
// (like the bank's own page) and are never indexed.

import { NextResponse } from 'next/server'
import { htmlLang, type Locale } from '@/lib/i18n'
import { copyFor } from '../email/templates'

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#F5EFE5;color:#0F2430;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
main{max-width:520px;margin:0 auto;padding:32px 16px}
.card{background:#FBF8F2;border:1px solid #E3DACB;border-radius:24px;padding:28px 24px;box-shadow:0 24px 48px -16px rgba(15,36,48,.22)}
h1{font:400 28px/1.2 Georgia,'Times New Roman',serif;margin:0 0 14px}
p{margin:0 0 14px;color:#2A3F4B}
dl{margin:0 0 20px;border-top:1px solid #E3DACB}dl div{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #E3DACB}
dt{color:#5B6B73}dd{margin:0;font-weight:600;text-align:right}
.mono{font-family:Menlo,Consolas,monospace;letter-spacing:.06em}
.banner{background:#F6E7C4;border:2px dashed #D49A2E;color:#0F2430;border-radius:16px;padding:14px 16px;margin:0 0 20px;font-weight:600;font-size:15px}
form{margin:0 0 10px}
button,.btn{display:block;width:100%;border:0;border-radius:999px;padding:15px 20px;font-family:inherit;font-weight:600;font-size:16px;line-height:1.2;cursor:pointer;text-align:center;text-decoration:none}
.ok{background:#17677A;color:#fff}.no{background:#9C4529;color:#fff}.ghost{background:transparent;color:#0F2430;box-shadow:inset 0 0 0 1px rgba(15,36,48,.2)}
.brand{font:400 19px Georgia,serif;margin:0 0 18px}.brand span{color:#5B6B73;font-size:14px}
`

export function htmlPage(lang: string, title: string, body: string, opts: { status?: number; csp?: string } = {}) {
  const l = (lang in htmlLang ? lang : 'en') as Locale
  const doc = `<!doctype html><html lang="${htmlLang[l]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body><main><p class="brand">${escapeHtml(copyFor(l).email.brand)} <span>· ${escapeHtml(copyFor(l).email.place)}</span></p>${body}</main></body></html>`
  return new NextResponse(doc, {
    status: opts.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': opts.csp ?? "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  })
}
