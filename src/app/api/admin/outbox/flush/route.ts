import { deliverOutbox } from '@/server/email/outbox'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sends queued e-mails for about 8 seconds; call again while `pending` > 0 (e.g. after cancelling a full departure). */
export const POST = route('admin.outbox.flush', async (req) => {
  requireAdmin(req)
  assertSameOrigin(req)
  return json(await deliverOutbox({ budgetMs: 8000, limit: 100 }))
})
