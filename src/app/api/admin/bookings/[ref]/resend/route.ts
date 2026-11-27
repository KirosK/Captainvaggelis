import { eq } from 'drizzle-orm'
import { BOOKING_REF } from '@/server/crypto'
import { getDb } from '@/server/db/client'
import { bookings } from '@/server/db/schema'
import { deliverOutbox, requeueConfirmation } from '@/server/email/outbox'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, route } from '@/server/http/respond'
import { audit } from '@/server/cruises/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sends the e-ticket of a paid booking again. */
export const POST = route<{ params: { ref: string } }>('admin.booking.resend', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref)) throw new HttpError('not_found', 404)
  const db = await getDb()
  const [b] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.ref, ref))
  if (!b) throw new HttpError('not_found', 404)
  if (b.status !== 'PAID') throw new HttpError('not_paid', 409, { status: b.status })
  await requeueConfirmation(ref)
  await audit(db, 'booking.resend', ref)
  return json({ delivery: await deliverOutbox({ budgetMs: 8000 }) })
})
