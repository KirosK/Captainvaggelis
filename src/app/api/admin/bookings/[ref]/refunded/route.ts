import { markRefunded } from '@/server/cruises/admin'
import { BOOKING_REF } from '@/server/crypto'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { refundedSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { note? }: REFUND_DUE → REFUNDED, after the refund was made in the bank's back office. */
export const POST = route<{ params: { ref: string } }>('admin.booking.refunded', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref)) throw new HttpError('not_found', 404)
  const { note } = await readJson(req, refundedSchema)
  return json({ booking: await markRefunded(ref, note) })
})
