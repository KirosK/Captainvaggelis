// The e-mail outbox: rows are queued inside the transaction that causes them and delivered afterwards
// (right away by the request that queued them, by POST /api/admin/outbox/flush, and by the daily cron).
// Each row is claimed before sending, so two deliverers never send the same e-mail; a failure is retried
// with back-off and given up after MAX_ATTEMPTS. E-mails are rendered at send time from the current data.

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { baseUrl, ownerEmail } from '../env'
import { ticketToken } from '../crypto'
import { getDb, type Queryable } from '../db/client'
import { bookings, cruiseRequests, cruiseSettings, emailOutbox, type EmailKind } from '../db/schema'
import { errorText, log } from '../log'
import { pickupTimes } from '../cruises/catalog'
import { getEmailProvider, replyTo, type EmailMessage } from './providers'
import { cancellationEmail, confirmationEmail, ownerBookingEmail, ownerRequestEmail, reminderEmail, requestReceivedEmail, type BookingMail } from './templates'

const MAX_ATTEMPTS = 6
const STUCK_MINUTES = 10

export async function enqueueEmail(q: Queryable, e: { kind: EmailKind; entityRef: string; dedupeKey: string }) {
  const rows = await q
    .insert(emailOutbox)
    .values({ ...e, status: 'pending' })
    .onConflictDoNothing({ target: emailOutbox.dedupeKey })
    .returning({ id: emailOutbox.id })
  return rows.length > 0
}

export const ticketUrl = (base: string, lang: string, ref: string) => `${base}/${lang}/cruises/ticket/${ref}?k=${ticketToken(ref)}`

async function bookingMail(ref: string): Promise<BookingMail | null> {
  const db = await getDb()
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref))
  if (!b) return null
  const [s] = await db.select().from(cruiseSettings).where(eq(cruiseSettings.cruise, b.cruise))
  const base = baseUrl()
  return {
    booking: b,
    times: s ? pickupTimes(b.cruise, s.depart, s.returnSkala) : null,
    ticketUrl: ticketUrl(base, b.lang, b.ref),
    qrUrl: `${base}/api/cruises/qr/${b.ref}`,
  }
}

/** Builds the message for an outbox row, or null when it no longer applies (e.g. a confirmation for a booking cancelled since). */
async function buildMessage(kind: EmailKind, ref: string): Promise<EmailMessage | null> {
  const tag = { kind, ref }
  const admin = `${baseUrl()}/admin`
  if (kind === 'request_received' || kind === 'owner_request') {
    const db = await getDb()
    const [r] = await db.select().from(cruiseRequests).where(eq(cruiseRequests.ref, ref))
    if (!r) return null
    if (kind === 'request_received') return { to: r.email, replyTo: replyTo(), tag, ...requestReceivedEmail(r) }
    return { to: ownerEmail(), replyTo: r.email, tag, ...ownerRequestEmail(r, admin) }
  }
  const m = await bookingMail(ref)
  if (!m) return null
  const st = m.booking.status
  switch (kind) {
    case 'confirmation':
      return st === 'PAID' ? { to: m.booking.email, replyTo: replyTo(), tag, ...confirmationEmail(m) } : null
    case 'reminder':
      return st === 'PAID' ? { to: m.booking.email, replyTo: replyTo(), tag, ...reminderEmail(m) } : null
    case 'cancellation':
      return st === 'REFUND_DUE' || st === 'REFUNDED' ? { to: m.booking.email, replyTo: replyTo(), tag, ...cancellationEmail(m) } : null
    case 'owner_booking':
      return { to: ownerEmail(), replyTo: m.booking.email, tag, ...ownerBookingEmail(m, admin) }
  }
  return null
}

export type DeliveryReport = { sent: number; skipped: number; failed: number; retrying: number; pending: number; provider: string | null }

/** Sends due e-mails until `limit` or the time budget runs out (serverless functions have a time limit). */
export async function deliverOutbox(opts: { limit?: number; budgetMs?: number } = {}): Promise<DeliveryReport> {
  const limit = opts.limit ?? 50
  const deadline = Date.now() + (opts.budgetMs ?? 20_000)
  const db = await getDb()
  const provider = getEmailProvider()
  const report: DeliveryReport = { sent: 0, skipped: 0, failed: 0, retrying: 0, pending: 0, provider: provider?.id ?? null }
  if (provider) {
    // rows left in "sending" by a crashed run go back to the queue
    await db
      .update(emailOutbox)
      .set({ status: 'pending', updatedAt: sql`now()` })
      .where(and(eq(emailOutbox.status, 'sending'), sql`${emailOutbox.updatedAt} < now() - make_interval(mins => ${STUCK_MINUTES}::int)`))
    const due = await db
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.nextAttemptAt, sql`now()`)))
      .orderBy(asc(emailOutbox.id))
      .limit(limit)
    for (const { id } of due) {
      if (Date.now() > deadline) break
      const [row] = await db
        .update(emailOutbox)
        .set({ status: 'sending', attempts: sql`${emailOutbox.attempts} + 1`, updatedAt: sql`now()` })
        .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, 'pending')))
        .returning()
      if (!row) continue
      try {
        const msg = await buildMessage(row.kind, row.entityRef)
        if (!msg) {
          await db.update(emailOutbox).set({ status: 'skipped', updatedAt: sql`now()` }).where(eq(emailOutbox.id, id))
          report.skipped++
          continue
        }
        await provider.send(msg)
        await db.update(emailOutbox).set({ status: 'sent', sentAt: sql`now()`, lastError: null, updatedAt: sql`now()` }).where(eq(emailOutbox.id, id))
        report.sent++
        log.info('email.sent', { kind: row.kind, ref: row.entityRef, provider: provider.id })
      } catch (e) {
        const giveUp = row.attempts >= MAX_ATTEMPTS
        await db
          .update(emailOutbox)
          .set({
            status: giveUp ? 'failed' : 'pending',
            lastError: errorText(e),
            nextAttemptAt: sql`now() + make_interval(mins => ${Math.min(240, 2 ** row.attempts * 5)}::int)`,
            updatedAt: sql`now()`,
          })
          .where(eq(emailOutbox.id, id))
        if (giveUp) report.failed++
        else report.retrying++
        log.error('email.failed', { kind: row.kind, ref: row.entityRef, attempt: row.attempts, error: errorText(e) })
      }
    }
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(inArray(emailOutbox.status, ['pending', 'sending']))
  report.pending = +n
  return report
}

/** Queues a fresh copy of a booking's confirmation (admin "send the e-ticket again"). */
export async function requeueConfirmation(ref: string) {
  const db = await getDb()
  return enqueueEmail(db, { kind: 'confirmation', entityRef: ref, dedupeKey: `confirmation:${ref}:resend:${Date.now()}` })
}
