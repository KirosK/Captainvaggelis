import { getAdminSettings, updateSeason } from '@/server/cruises/admin'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, json, readJson, route } from '@/server/http/respond'
import { settingsPatchSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Days, times, fares, capacity and on/off of every scheduled cruise, and the bookable season. */
export const GET = route('admin.settings', async (req) => {
  requireAdmin(req)
  return json(await getAdminSettings())
})

/** { season: { start, end } } */
export const PATCH = route('admin.settings.update', async (req) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const { season } = await readJson(req, settingsPatchSchema)
  return json(await updateSeason(season))
})
