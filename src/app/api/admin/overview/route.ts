import { overview } from '@/server/cruises/admin'
import { requireAdmin } from '@/server/http/adminAuth'
import { json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Counters for the admin's alerts: refunds due, bookings needing attention, new requests, e-mails waiting. */
export const GET = route('admin.overview', async (req) => {
  requireAdmin(req)
  return json(await overview())
})
