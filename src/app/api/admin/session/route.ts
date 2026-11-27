import { adminSession } from '@/server/http/adminAuth'
import { json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** { authenticated, expiresAt }: lets the admin page decide between the login form and the dashboard. */
export const GET = route('admin.session', async (req) => {
  const exp = adminSession(req)
  return json({ authenticated: !!exp, expiresAt: exp ? new Date(exp * 1000).toISOString() : null })
})
