import { getAvailability } from '@/server/cruises/schedule'
import { HttpError, json, readQuery, route } from '@/server/http/respond'
import { availabilityQuery } from '@/server/http/schemas'
import { daysBetween } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sailing days with seats left, per cruise: ?cruise=ithacaVathiKioni[,fiscardo]&from=YYYY-MM-DD&to=YYYY-MM-DD */
export const GET = route('cruises.availability', async (req) => {
  const q = readQuery(req, availabilityQuery)
  if (q.from && q.to && (q.to < q.from || daysBetween(q.from, q.to) > 400)) throw new HttpError('invalid_range', 400)
  return json(await getAvailability({ cruises: q.cruise, from: q.from, to: q.to }), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' },
  })
})
