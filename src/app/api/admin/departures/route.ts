import { defaultRange, listDepartures } from '@/server/cruises/admin'
import { requireAdmin } from '@/server/http/adminAuth'
import { HttpError, json, readQuery, route } from '@/server/http/respond'
import { departuresQuery } from '@/server/http/schemas'
import { daysBetween } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Departures with seats sold and left: ?from=YYYY-MM-DD&to=YYYY-MM-DD[&cruise=key] (default: last week to four months ahead). */
export const GET = route('admin.departures', async (req) => {
  requireAdmin(req)
  const q = readQuery(req, departuresQuery)
  const range = defaultRange()
  const from = q.from ?? range.from
  const to = q.to ?? range.to
  if (to < from || daysBetween(from, to) > 400) throw new HttpError('invalid_range', 400)
  return json({ from, to, departures: await listDepartures({ from, to, cruise: q.cruise }) })
})
