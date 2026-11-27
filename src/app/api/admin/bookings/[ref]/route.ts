import { bookingDetail } from '@/server/cruises/admin'
import { BOOKING_REF } from '@/server/crypto'
import { requireAdmin } from '@/server/http/adminAuth'
import { HttpError, json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A booking with its payment attempts and e-mails. */
export const GET = route<{ params: { ref: string } }>('admin.booking', async (req, { params }) => {
  requireAdmin(req)
  const ref = params.ref.toUpperCase()
  const d = BOOKING_REF.test(ref) ? await bookingDetail(ref) : null
  if (!d) throw new HttpError('not_found', 404)
  return json(d)
})
