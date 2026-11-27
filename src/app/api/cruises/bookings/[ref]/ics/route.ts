import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { BOOKING_REF, checkTicketToken } from '@/server/crypto'
import { getDb } from '@/server/db/client'
import { bookings, cruiseSettings } from '@/server/db/schema'
import { pickupTimes } from '@/server/cruises/catalog'
import { ticketUrl } from '@/server/email/outbox'
import { bookingIcs } from '@/server/email/templates'
import { baseUrl } from '@/server/env'
import { HttpError, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Calendar file of a paid booking: ?k= from the ticket link. */
export const GET = route<{ params: { ref: string } }>('cruises.bookings.ics', async (req, { params }) => {
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref) || !checkTicketToken(ref, req.nextUrl.searchParams.get('k'))) throw new HttpError('not_found', 404)
  const db = await getDb()
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref))
  if (!b || b.status !== 'PAID') throw new HttpError('not_found', 404)
  const [s] = await db.select().from(cruiseSettings).where(eq(cruiseSettings.cruise, b.cruise))
  const base = baseUrl(req.nextUrl.origin)
  const body = bookingIcs({ booking: b, times: s ? pickupTimes(b.cruise, s.depart, s.returnSkala) : null, ticketUrl: ticketUrl(base, b.lang, b.ref), qrUrl: '' })
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${b.ref}.ics"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
})
