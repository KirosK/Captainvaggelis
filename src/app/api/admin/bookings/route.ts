import { listBookings } from '@/server/cruises/admin'
import { requireAdmin } from '@/server/http/adminAuth'
import { json, readQuery, route } from '@/server/http/respond'
import { bookingsQuery } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List bookings by ?status=&cruise=&from=&to=&attention=1&limit= (a text search is POST /api/admin/bookings/search). */
export const GET = route('admin.bookings', async (req) => {
  requireAdmin(req)
  const q = readQuery(req, bookingsQuery)
  return json({ bookings: await listBookings(q) })
})
