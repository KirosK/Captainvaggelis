import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { bookings, payments } from '@/server/db/schema'
import { ORDER_ID, ticketToken } from '@/server/crypto'
import { mockPaymentsAllowed } from '@/server/env'
import { copyFor, cruiseName, longDate, money, passengerLine } from '@/server/email/templates'
import { escapeHtml as e, htmlPage } from '@/server/http/html'
import { HttpError, route } from '@/server/http/respond'
import { checkMockStartToken, mockReturnFields, type MockStatus } from '@/server/payments/mock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The test "bank" page (mock provider only, never in production unless ALLOW_MOCK_PAYMENTS=1). */
export const GET = route('payments.mock.page', async (req) => {
  if (!mockPaymentsAllowed()) throw new HttpError('not_found', 404)
  const orderId = req.nextUrl.searchParams.get('o') ?? ''
  const t = req.nextUrl.searchParams.get('t')
  const db = await getDb()
  const [pay] = ORDER_ID.test(orderId) && checkMockStartToken(orderId, t) ? await db.select().from(payments).where(eq(payments.orderId, orderId)) : []
  const [b] = pay && pay.provider === 'mock' ? await db.select().from(bookings).where(eq(bookings.id, pay.bookingId)) : []
  if (!pay || !b) {
    const c = copyFor('en')
    return htmlPage('en', c.mock.title, `<div class="card"><h1>${e(c.mock.title)}</h1><p>${e(c.redirect.expired)}</p></div>`, { status: 404 })
  }
  const c = copyFor(b.lang)
  const ticket = `/${b.lang}/cruises/ticket/${b.ref}?k=${ticketToken(b.ref)}`
  const details = `<dl>
<div><dt>${e(c.mock.booking)}</dt><dd class="mono">${e(b.ref)}</dd></div>
<div><dt>${e(c.labels.cruise)}</dt><dd>${e(cruiseName(b.lang, b.cruise))}</dd></div>
<div><dt>${e(c.labels.date)}</dt><dd>${e(longDate(b.lang, b.date))}</dd></div>
<div><dt>${e(c.labels.passengers)}</dt><dd>${e(passengerLine(b.lang, b))}</dd></div>
<div><dt>${e(c.mock.amount)}</dt><dd>${e(money(b.lang, pay.amountCents))}</dd></div>
</dl>`
  if (pay.status !== 'started') {
    return htmlPage(b.lang, c.mock.title, `<p class="banner">${e(c.mock.banner)}</p><div class="card"><h1>${e(c.mock.heading)}</h1>${details}<p>${e(c.mock.done)}</p><a class="btn ok" href="${e(ticket)}">${e(c.mock.open)}</a></div>`)
  }
  const button = (status: MockStatus, cls: string, label: string) => {
    const f = mockReturnFields(pay.orderId, status, pay.amountCents, pay.currency)
    const inputs = Object.entries(f)
      .map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`)
      .join('')
    return `<form method="post" action="/api/payments/mock/return">${inputs}<button type="submit" class="${cls}">${e(label)}</button></form>`
  }
  const body = `<p class="banner" role="note">${e(c.mock.banner)}</p>
<div class="card"><h1>${e(c.mock.heading)}</h1>${details}
${button('CAPTURED', 'ok', c.mock.succeed)}
${button('REFUSED', 'no', c.mock.decline)}
${button('CANCELED', 'ghost', c.mock.cancel)}
</div>`
  return htmlPage(b.lang, c.mock.title, body)
})
