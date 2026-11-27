import { moveBooking } from '@/server/cruises/admin'
import { BOOKING_REF } from '@/server/crypto'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { moveSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { date }: moves a PAID or REFUND_DUE booking to another date of the same cruise; the guest gets a new e-ticket. */
export const POST = route<{ params: { ref: string } }>('admin.booking.move', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref)) throw new HttpError('not_found', 404)
  const { date } = await readJson(req, moveSchema)
  return json(await moveBooking(ref, date))
})
