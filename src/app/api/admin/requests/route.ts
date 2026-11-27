import { listRequests } from '@/server/cruises/requests'
import { requireAdmin } from '@/server/http/adminAuth'
import { json, readQuery, route } from '@/server/http/respond'
import { requestsQuery } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The on-request inbox (BBQ, private, wedding): ?status=new|answered|closed */
export const GET = route('admin.requests', async (req) => {
  requireAdmin(req)
  const { status } = readQuery(req, requestsQuery)
  const rows = await listRequests(status)
  return json({
    requests: rows.map((r) => ({ ...r, id: undefined, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
  })
})
