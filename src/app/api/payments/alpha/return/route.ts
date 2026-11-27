import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { applyPaymentResult } from '@/server/cruises/bookings'
import { getDb } from '@/server/db/client'
import { bookings, payments } from '@/server/db/schema'
import { ORDER_ID, ticketToken } from '@/server/crypto'
import { baseUrl } from '@/server/env'
import { copyFor } from '@/server/email/templates'
import { escapeHtml as e, htmlPage } from '@/server/http/html'
import { errorText, log } from '@/server/log'
import { verifyAlphaResponse } from '@/server/payments/alpha'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The language of the booking an (unverified) order id points to, only to word the error page. */
async function langOf(orderId?: string) {
  if (!orderId || !ORDER_ID.test(orderId)) return 'en'
  try {
    const db = await getDb()
    const [row] = await db.select({ lang: bookings.lang }).from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).where(eq(payments.orderId, orderId))
    return row?.lang ?? 'en'
  } catch {
    return 'en'
  }
}

async function failedPage(orderId: string | undefined, status = 400) {
  const lang = await langOf(orderId)
  const c = copyFor(lang)
  const ref = orderId && ORDER_ID.test(orderId) ? `<p class="mono">${e(orderId)}</p>` : ''
  return htmlPage(lang, c.verifyFailed.title, `<div class="card"><h1>${e(c.verifyFailed.title)}</h1><p>${e(c.verifyFailed.body)}</p>${ref}<a class="btn ghost" href="/${lang}/cruises">${e(c.verifyFailed.back)}</a></div>`, { status })
}

/**
 * confirmUrl and cancelUrl of Alpha Bank e-Commerce (research/alpha-ecommerce.md §3.5): the guest's browser posts the
 * result here, and the bank may post a background copy (user agent "Modirum VPOS"). Both are verified the same way
 * and applied once; the browser gets a 303 to its e-ticket page so a reload does not post again.
 */
export async function POST(req: Request) {
  const background = /modirum/i.test(req.headers.get('user-agent') ?? '')
  const form = new URLSearchParams((await req.text()).slice(0, 16000))
  const check = verifyAlphaResponse(form)
  if (!check.ok) {
    log.error('alpha.return_rejected', { reason: check.reason, order: check.orderId && ORDER_ID.test(check.orderId) ? check.orderId : undefined, background })
    return background ? new NextResponse('REJECTED', { status: 400 }) : failedPage(check.orderId)
  }
  try {
    const applied = await applyPaymentResult(check.result)
    if (background) return new NextResponse('OK', { status: 200 })
    const url = `${baseUrl(new URL(req.url).origin)}/${applied.lang}/cruises/ticket/${applied.ref}?k=${ticketToken(applied.ref)}&p=${applied.outcome === 'paid' ? 'ok' : 'failed'}`
    return NextResponse.redirect(url, 303)
  } catch (err) {
    log.error('alpha.return_failed', { order: check.result.orderId, error: errorText(err) })
    return background ? new NextResponse('ERROR', { status: 500 }) : failedPage(check.result.orderId, 500)
  }
}

/** A plain visit (no bank post) goes back to the cruises. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL('/en/cruises', req.url), 303)
}
