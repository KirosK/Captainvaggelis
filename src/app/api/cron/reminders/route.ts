import { queueReminders } from '@/server/cruises/reminders'
import { deliverOutbox } from '@/server/email/outbox'
import { requireCron } from '@/server/http/adminAuth'
import { json, route } from '@/server/http/respond'
import { log } from '@/server/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Daily (vercel.json): queues tomorrow's reminders and sends every queued e-mail. Needs "Authorization: Bearer $CRON_SECRET". */
export const GET = route('cron.reminders', async (req) => {
  requireCron(req)
  const reminders = await queueReminders()
  const delivery = await deliverOutbox({ budgetMs: 45_000, limit: 400 })
  log.info('cron.reminders', { date: reminders.date, queued: reminders.queued, sent: delivery.sent, pending: delivery.pending })
  return json({ reminders, delivery })
})
