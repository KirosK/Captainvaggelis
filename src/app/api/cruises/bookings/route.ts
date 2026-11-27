import { createBooking } from '@/server/cruises/bookings'
import { ticketToken } from '@/server/crypto'
import { assertSameOrigin, json, readJson, route } from '@/server/http/respond'
import { rateLimit } from '@/server/http/rateLimit'
import { createBookingSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Creates a booking, holds its seats for 15 minutes and starts the payment.
 * The browser then goes to `payment.redirectUrl` (window.location.assign).
 */
export const POST = route('cruises.bookings.create', async (req) => {
  assertSameOrigin(req)
  await rateLimit('booking', req)
  const input = await readJson(req, createBookingSchema)
  const { booking, payment } = await createBooking(input)
  return json(
    {
      ref: booking.ref,
      status: booking.status,
      total: booking.amountCents / 100,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      token: ticketToken(booking.ref),
      ticketUrl: `/${booking.lang}/cruises/ticket/${booking.ref}?k=${ticketToken(booking.ref)}`,
      payment,
    },
    { status: 201 },
  )
})
