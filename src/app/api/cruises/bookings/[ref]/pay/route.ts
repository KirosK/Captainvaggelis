import { retryPayment } from '@/server/cruises/bookings'
import { BOOKING_REF, checkTicketToken } from '@/server/crypto'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { rateLimit } from '@/server/http/rateLimit'
import { tokenSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A new payment attempt for an unpaid booking: body { k } (the ticket key). */
export const POST = route<{ params: { ref: string } }>('cruises.bookings.pay', async (req, { params }) => {
  assertSameOrigin(req)
  await rateLimit('pay', req)
  const { k } = await readJson(req, tokenSchema)
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref) || !checkTicketToken(ref, k)) throw new HttpError('not_found', 404)
  const { booking, payment } = await retryPayment(ref)
  return json({ ref: booking.ref, status: booking.status, total: booking.amountCents / 100, holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null, payment })
})
