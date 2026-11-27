import { NextResponse, type NextRequest } from 'next/server'
import { checkAdminPassword, setAdminCookie } from '@/server/http/adminAuth'
import { assertSameOrigin, HttpError, readJson, route } from '@/server/http/respond'
import { assertLoginOpen, rateLimit, recordFailedLogin } from '@/server/http/rateLimit'
import { loginSchema } from '@/server/http/schemas'
import { log } from '@/server/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { password } → sets the signed admin cookie (12 hours). Six attempts per 15 minutes per visitor, 30 wrong ones per 15 minutes in all. */
export const POST = route('admin.login', async (req: NextRequest) => {
  assertSameOrigin(req)
  await rateLimit('login', req)
  await assertLoginOpen()
  const { password } = await readJson(req, loginSchema)
  if (!checkAdminPassword(password)) {
    await recordFailedLogin()
    log.warn('admin.login_failed')
    throw new HttpError('wrong_password', 401)
  }
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  setAdminCookie(res)
  log.info('admin.login')
  return res
})
