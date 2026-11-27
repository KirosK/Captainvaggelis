import { NextResponse } from 'next/server'
import { clearAdminCookie } from '@/server/http/adminAuth'
import { assertSameOrigin, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = route('admin.logout', async (req) => {
  assertSameOrigin(req)
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  clearAdminCookie(res)
  return res
})
