import { ticketView } from '@/server/cruises/bookings'
import { BOOKING_REF, checkTicketToken } from '@/server/crypto'
import { HttpError, json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The guest's booking (the e-ticket data). Needs ?k= from the ticket link. */
export const GET = route<{ params: { ref: string } }>('cruises.bookings.get', async (req, { params }) => {
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref) || !checkTicketToken(ref, req.nextUrl.searchParams.get('k'))) throw new HttpError('not_found', 404)
  const view = await ticketView(ref)
  if (!view) throw new HttpError('not_found', 404)
  return json(view)
})
