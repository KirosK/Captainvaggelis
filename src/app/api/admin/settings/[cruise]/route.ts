import { updateCruiseSettings } from '@/server/cruises/admin'
import { isScheduledKey } from '@/server/cruises/catalog'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { cruisePatchSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { weekdays?, depart?, returnSkala?, adult?, child?, capacity?, active? } (fares in euros). */
export const PATCH = route<{ params: { cruise: string } }>('admin.settings.cruise', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  if (!isScheduledKey(params.cruise)) throw new HttpError('not_found', 404)
  const patch = await readJson(req, cruisePatchSchema)
  return json(await updateCruiseSettings(params.cruise, patch))
})
