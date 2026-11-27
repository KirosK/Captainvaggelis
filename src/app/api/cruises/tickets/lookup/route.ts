import { ticketTokenFor } from '@/server/cruises/bookings'
import { BOOKING_REF } from '@/server/crypto'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { rateLimit } from '@/server/http/rateLimit'
import { lookupSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Opens a ticket without the link: { ref, email } → { token, url } when the e-mail is the one the booking was made with. */
export const POST = route('cruises.tickets.lookup', async (req) => {
  assertSameOrigin(req)
  await rateLimit('lookup', req)
  const { ref, email } = await readJson(req, lookupSchema)
  // the same answer for an unknown reference and a wrong e-mail
  const token = BOOKING_REF.test(ref) ? await ticketTokenFor(ref, email) : null
  if (!token) throw new HttpError('not_found', 404)
  return json({ ref, token })
})
