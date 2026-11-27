import { listBookings } from '@/server/cruises/admin'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, json, readJson, route } from '@/server/http/respond'
import { bookingsSearchSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Search bookings by name, e-mail, phone or reference: { q, status?, cruise?, from?, to?, attention?, limit? }.
 * A POST, so what the Captain types (personal data) travels in the body and never ends up in request logs as a URL.
 */
export const POST = route('admin.bookings.search', async (req) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const q = await readJson(req, bookingsSearchSchema)
  return json({ bookings: await listBookings(q) })
})
