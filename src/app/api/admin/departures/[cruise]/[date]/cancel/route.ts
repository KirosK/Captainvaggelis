import { cancelDeparture } from '@/server/cruises/admin'
import { isScheduledKey } from '@/server/cruises/catalog'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { cancelSchema } from '@/server/http/schemas'
import { isISODate } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { reason: 'weather'|'technical', note? }: cancels the departure; paid bookings become REFUND_DUE and the guests are e-mailed. */
export const POST = route<{ params: { cruise: string; date: string } }>('admin.departure.cancel', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  if (!isScheduledKey(params.cruise) || !isISODate(params.date)) throw new HttpError('not_found', 404)
  const { reason, note } = await readJson(req, cancelSchema)
  return json(await cancelDeparture(params.cruise, params.date, reason, note))
})
