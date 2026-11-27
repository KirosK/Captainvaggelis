import { audit } from '@/server/cruises/admin'
import { setRequestStatus } from '@/server/cruises/requests'
import { REQUEST_REF } from '@/server/crypto'
import { getDb } from '@/server/db/client'
import { requireAdmin } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, json, readJson, route } from '@/server/http/respond'
import { requestPatchSchema } from '@/server/http/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { status: 'new'|'answered'|'closed' } */
export const PATCH = route<{ params: { ref: string } }>('admin.request.update', async (req, { params }) => {
  requireAdmin(req)
  assertSameOrigin(req)
  const ref = params.ref.toUpperCase()
  if (!REQUEST_REF.test(ref)) throw new HttpError('not_found', 404)
  const { status } = await readJson(req, requestPatchSchema)
  const r = await setRequestStatus(ref, status)
  if (!r) throw new HttpError('not_found', 404)
  await audit(await getDb(), 'request.status', ref, { status })
  return json({ request: { ...r, id: undefined, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() } })
})
