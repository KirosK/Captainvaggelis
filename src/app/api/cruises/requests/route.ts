import { createRequest } from '@/server/cruises/requests'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { rateLimit } from '@/server/http/rateLimit'
import { createRequestSchema } from '@/server/http/schemas'
import { addDaysISO, athensNow } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Enquiry for a cruise that runs on request (bbq, private, wedding). */
export const POST = route('cruises.requests.create', async (req) => {
  assertSameOrigin(req)
  await rateLimit('request', req)
  const input = await readJson(req, createRequestSchema)
  const today = athensNow().date
  if (input.date && (input.date < today || input.date > addDaysISO(today, 730))) throw new HttpError('validation', 400, { fields: ['date'] })
  const r = await createRequest(input)
  return json({ ref: r.ref, status: r.status }, { status: 201 })
})
