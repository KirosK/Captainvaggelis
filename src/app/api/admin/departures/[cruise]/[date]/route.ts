import { departureDetail, setDeparture } from '@/server/cruises/admin'
import { isScheduledKey } from '@/server/cruises/catalog'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { departurePatchSchema } from '@/server/http/schemas'
import { isISODate } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { cruise: string; date: string } }

function target(params: Ctx['params']) {
  if (!isScheduledKey(params.cruise) || !isISODate(params.date)) throw new HttpError('not_found', 404)
  return { cruise: params.cruise, date: params.date }
}

/** One departure with its passenger list. */
export const GET = route<Ctx>('admin.departure', async (req, { params }) => {
  requireAdmin(req)
  const { cruise, date } = target(params)
  return json(await departureDetail(cruise, date))
})

/** { status?: 'open'|'closed', capacity?: number|null, note?: string|null }: close or reopen online booking, own capacity. */
export const PATCH = route<Ctx>('admin.departure.update', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const { cruise, date } = target(params)
  const patch = await readJson(req, departurePatchSchema)
  return json(await setDeparture(cruise, date, patch))
})
