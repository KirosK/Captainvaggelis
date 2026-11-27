import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { bookings, payments } from '@/server/db/schema'
import { ORDER_ID, ticketToken } from '@/server/crypto'
import { baseUrl } from '@/server/env'
import { copyFor, cruiseName } from '@/server/email/templates'
import { escapeHtml as e, htmlPage } from '@/server/http/html'
import { HttpError, route } from '@/server/http/respond'
import { alphaConfig, alphaRequestFields, checkAlphaStartToken } from '@/server/payments/alpha'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Hand-off to Alpha Bank e-Commerce: a page that posts the signed order form to the bank straight away
 * (the digest is computed here, on the server; the shared secret never reaches the browser).
 */
export const GET = route('payments.alpha.start', async (req) => {
  const cfg = alphaConfig()
  if (!cfg) throw new HttpError('not_found', 404)
  const orderId = req.nextUrl.searchParams.get('o') ?? ''
  const t = req.nextUrl.searchParams.get('t')
  const db = await getDb()
  const [pay] = ORDER_ID.test(orderId) && checkAlphaStartToken(orderId, t) ? await db.select().from(payments).where(eq(payments.orderId, orderId)) : []
  const [b] = pay && pay.provider === 'alpha' ? await db.select().from(bookings).where(eq(bookings.id, pay.bookingId)) : []
  const lang = b?.lang ?? 'en'
  const c = copyFor(lang)
  const usable = pay && b && pay.status === 'started' && b.status === 'PENDING_PAYMENT' && !!b.holdExpiresAt && b.holdExpiresAt.getTime() > Date.now()
  if (!usable) {
    const back = b ? `<a class="btn ghost" href="/${b.lang}/cruises/ticket/${b.ref}?k=${ticketToken(b.ref)}">${e(c.redirect.back)}</a>` : ''
    return htmlPage(lang, c.redirect.title, `<div class="card"><h1>${e(c.redirect.title)}</h1><p>${e(c.redirect.expired)}</p>${back}</div>`, { status: 410 })
  }
  const seats = b.adults + b.children + b.infants
  const fields = alphaRequestFields(cfg, {
    orderId: pay.orderId,
    amountCents: pay.amountCents,
    currency: pay.currency,
    lang: b.lang,
    description: `${cruiseName('en', b.cruise)} ${b.date} ${seats} pax ${b.ref}`,
    email: b.email,
    phone: b.phone,
    returnUrl: `${baseUrl(req.nextUrl.origin)}/api/payments/alpha/return`,
  })
  const inputs = fields.map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`).join('')
  const body = `<div class="card"><h1>${e(c.redirect.title)}</h1><p>${e(c.redirect.body)}</p>
<form id="pay" method="post" action="${e(cfg.gatewayUrl)}" accept-charset="UTF-8" enctype="application/x-www-form-urlencoded">${inputs}<button type="submit" class="ok">${e(c.redirect.button)}</button></form></div>
<script>document.getElementById('pay').submit()</script>`
  return htmlPage(lang, c.redirect.title, body, { csp: "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'" })
})
