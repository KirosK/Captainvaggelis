import { NextResponse } from 'next/server'
import { applyPaymentResult, BookingError } from '@/server/cruises/bookings'
import { ticketToken } from '@/server/crypto'
import { baseUrl, mockPaymentsAllowed } from '@/server/env'
import { copyFor } from '@/server/email/templates'
import { escapeHtml as e, htmlPage } from '@/server/http/html'
import { log } from '@/server/log'
import { verifyMockReturn } from '@/server/payments/mock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The test page's buttons post here, signed like a bank response; the guest lands on the e-ticket page. */
export async function POST(req: Request) {
  if (!mockPaymentsAllowed()) return new NextResponse('Not found', { status: 404 })
  const form = new URLSearchParams((await req.text()).slice(0, 4000))
  const result = verifyMockReturn(form)
  const c = copyFor('en')
  if (!result) {
    log.warn('mock.bad_signature')
    return htmlPage('en', c.verifyFailed.title, `<div class="card"><h1>${e(c.verifyFailed.title)}</h1><p>${e(c.verifyFailed.body)}</p></div>`, { status: 400 })
  }
  try {
    const applied = await applyPaymentResult(result)
    const url = `${baseUrl(new URL(req.url).origin)}/${applied.lang}/cruises/ticket/${applied.ref}?k=${ticketToken(applied.ref)}&p=${applied.outcome === 'paid' ? 'ok' : 'failed'}`
    return NextResponse.redirect(url, 303)
  } catch (err) {
    if (!(err instanceof BookingError)) log.error('mock.return_failed', { order: result.orderId })
    return htmlPage('en', c.verifyFailed.title, `<div class="card"><h1>${e(c.verifyFailed.title)}</h1><p>${e(c.verifyFailed.body)}</p><p class="mono">${e(result.orderId)}</p></div>`, { status: 400 })
  }
}
