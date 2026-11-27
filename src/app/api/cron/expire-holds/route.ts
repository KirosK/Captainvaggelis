import { expireHolds } from '@/server/cruises/bookings'
import { deliverOutbox } from '@/server/email/outbox'
import { requireCron } from '@/server/http/adminAuth'
import { pruneRateLimits } from '@/server/http/rateLimit'
import { json, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Housekeeping (vercel.json): marks unpaid holds that ran out as CANCELLED, retries e-mails that failed, prunes
 * rate-limit counters. Seats of an expired hold are free the moment it expires, so this can run rarely.
 */
export const GET = route('cron.expire_holds', async (req) => {
  requireCron(req)
  const expired = await expireHolds()
  await pruneRateLimits()
  const delivery = await deliverOutbox({ budgetMs: 40_000, limit: 300 })
  return json({ expired, delivery })
})
