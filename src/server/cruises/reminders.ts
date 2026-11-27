// The day-before reminder: queued by the daily cron for every paid booking sailing tomorrow (Greek date).
// Bookings made in the last hours before the cron already have their fresh confirmation, so they are skipped.

import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { bookings } from '../db/schema'
import { enqueueEmail } from '../email/outbox'
import { addDaysISO, athensNow } from '../time'

export async function queueReminders() {
  const db = await getDb()
  const tomorrow = addDaysISO(athensNow().date, 1)
  const rows = await db
    .select({ ref: bookings.ref, date: bookings.date })
    .from(bookings)
    .where(and(eq(bookings.status, 'PAID'), eq(bookings.date, tomorrow), sql`${bookings.paidAt} < now() - interval '6 hours'`))
  let queued = 0
  for (const r of rows) if (await enqueueEmail(db, { kind: 'reminder', entityRef: r.ref, dedupeKey: `reminder:${r.ref}:${r.date}` })) queued++
  return { date: tomorrow, bookings: rows.length, queued }
}
