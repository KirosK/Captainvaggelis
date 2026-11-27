// Cruise bookings: seat holds, payment attempts and their results.
//
// Concurrency: every change that can add passengers to a departure first takes a transaction-scoped advisory lock
// on that departure (pg_advisory_xact_lock), then reads the seats taken and writes, all in one transaction.
// Two guests buying the last seats at the same moment are therefore serialised: the second sees the first's hold.
// Lock order is always departure → booking row → payment row, so these transactions cannot deadlock.

import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb, type DB, type Queryable, type Tx } from '../db/client'
import { bookings, departureOverrides, payments, type BookingRow, type Lang, type Pickup } from '../db/schema'
import { enqueueEmail, deliverOutbox } from '../email/outbox'
import { log } from '../log'
import { makeOrderId, makeRef, ticketToken } from '../crypto'
import { getPaymentProvider, type PaymentProvider, type VerifiedResult } from '../payments'
import { HOLD_GRACE_MINUTES, HOLD_MINUTES, hasPoros, pickupTimes, type ScheduledKey } from './catalog'
import { discountKindOf, quoteCents } from './pricing'
import { departureState, loadSeason, loadSettings, onSchedule, seatsTaken } from './schedule'

/** A failure the guest can act on; `code` is stable API (src/server/README.md). */
export class BookingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(code)
  }
}

export async function lockDeparture(tx: Tx, cruise: string, date: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`dep:${cruise}:${date}`}))`)
}

export const seatsOf = (b: Pick<BookingRow, 'adults' | 'children' | 'infants'>) => b.adults + b.children + b.infants

const holdUntil = () => new Date(Date.now() + HOLD_MINUTES * 60_000)

function addAttention(current: string | null, code: string) {
  const set = new Set((current ?? '').split(',').filter(Boolean))
  set.add(code)
  return [...set].join(',')
}

export type CreateBookingInput = {
  cruise: ScheduledKey
  date: string
  adults: number
  children: number
  infants: number
  pickup: Pickup
  guest: boolean
  second: boolean
  name: string
  email: string
  phone: string
  hotel?: string | null
  notes?: string | null
  lang: Lang
  /** the total the guest saw, in euros; a different server total answers 409 price_changed instead of charging */
  expectedTotal?: number
}

export type PaymentStart = { provider: string; orderId: string; redirectUrl: string }

/** Holds the seats for HOLD_MINUTES and starts the first payment attempt. */
export async function createBooking(input: CreateBookingInput): Promise<{ booking: BookingRow; payment: PaymentStart }> {
  const provider = getPaymentProvider() // before holding seats: no provider, no booking
  if (input.pickup === 'poros' && !hasPoros(input.cruise)) throw new BookingError('pickup_unavailable', 400)
  const seats = input.adults + input.children + input.infants
  const db = await getDb()
  const booking = await db.transaction(async (tx) => {
    await lockDeparture(tx, input.cruise, input.date)
    const setting = (await loadSettings(tx)).get(input.cruise)
    if (!setting) throw new BookingError('unknown_cruise', 400)
    const season = await loadSeason(tx)
    if (!onSchedule(setting, season, input.date)) throw new BookingError('departure_unavailable', 409, { status: 'not_scheduled' })
    const [override] = await tx
      .select()
      .from(departureOverrides)
      .where(and(eq(departureOverrides.cruise, input.cruise), eq(departureOverrides.date, input.date)))
    const st = departureState({ setting, season, date: input.date, override, taken: await seatsTaken(tx, input.cruise, input.date) })
    if (st.status !== 'open') throw new BookingError('departure_unavailable', 409, { status: st.status })
    if (st.left < seats) throw new BookingError('not_enough_seats', 409, { left: st.left })
    const q = quoteCents(setting, input, discountKindOf(input.guest, input.second))
    if (input.expectedTotal !== undefined && Math.round(input.expectedTotal * 100) !== q.amountCents) {
      throw new BookingError('price_changed', 409, { total: q.amountCents / 100 })
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const [row] = await tx
        .insert(bookings)
        .values({
          ref: makeRef('CV'),
          cruise: input.cruise,
          date: input.date,
          pickup: input.pickup,
          adults: input.adults,
          children: input.children,
          infants: input.infants,
          name: input.name,
          email: input.email,
          phone: input.phone,
          hotel: input.hotel || null,
          notes: input.notes || null,
          lang: input.lang,
          subtotalCents: q.subtotalCents,
          discountKind: discountKindOf(input.guest, input.second),
          discountCents: q.discountCents,
          amountCents: q.amountCents,
          currency: 'EUR',
          status: 'PENDING_PAYMENT',
          holdExpiresAt: holdUntil(),
        })
        .onConflictDoNothing({ target: bookings.ref })
        .returning()
      if (row) return row
    }
    throw new Error('could not allocate a booking reference')
  })
  log.info('booking.held', { ref: booking.ref, cruise: booking.cruise, date: booking.date, seats, amount: booking.amountCents })
  const payment = await startPayment(db, booking, provider)
  return { booking, payment }
}

async function startPayment(db: DB, booking: BookingRow, provider: PaymentProvider): Promise<PaymentStart> {
  const orderId = makeOrderId(booking.ref)
  await db.insert(payments).values({ bookingId: booking.id, provider: provider.id, orderId, amountCents: booking.amountCents, currency: booking.currency, status: 'started' })
  log.info('payment.started', { ref: booking.ref, order: orderId, provider: provider.id })
  return { provider: provider.id, orderId, redirectUrl: provider.startUrl(orderId) }
}

/**
 * A new payment attempt for an unpaid booking (after a declined card, or when the guest comes back later).
 * A live hold keeps its end time (retrying never stretches it, so seats cannot be held indefinitely without paying);
 * an expired one is taken again for HOLD_MINUTES only if the seats are still free. A payment that lands just after
 * the hold ended is still accepted (applyPaymentResult).
 */
export async function retryPayment(ref: string): Promise<{ booking: BookingRow; payment: PaymentStart }> {
  const provider = getPaymentProvider()
  const db = await getDb()
  const [first] = await db.select().from(bookings).where(eq(bookings.ref, ref))
  if (!first) throw new BookingError('not_found', 404)
  const booking = await db.transaction(async (tx) => {
    await lockDeparture(tx, first.cruise, first.date)
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, first.id)).for('update')
    if (b.status === 'PAID') throw new BookingError('already_paid', 409)
    const expiredHold = b.status === 'CANCELLED' && b.cancelReason === 'hold_expired'
    const liveHold = b.status === 'PENDING_PAYMENT' && !!b.holdExpiresAt && b.holdExpiresAt.getTime() > Date.now()
    if (b.status !== 'PENDING_PAYMENT' && !expiredHold) throw new BookingError('not_payable', 409, { status: b.status })
    const setting = (await loadSettings(tx)).get(b.cruise as ScheduledKey)
    if (!setting) throw new BookingError('departure_unavailable', 409, { status: 'not_scheduled' })
    const season = await loadSeason(tx)
    const [override] = await tx
      .select()
      .from(departureOverrides)
      .where(and(eq(departureOverrides.cruise, b.cruise), eq(departureOverrides.date, b.date)))
    const others = await seatsTaken(tx, b.cruise, b.date, b.id)
    const st = departureState({ setting, season, date: b.date, override, taken: others })
    if (st.status !== 'open' && st.status !== 'soldout') throw new BookingError('departure_unavailable', 409, { status: st.status })
    if (!onSchedule(setting, season, b.date)) throw new BookingError('departure_unavailable', 409, { status: 'not_scheduled' })
    if (st.left < seatsOf(b)) throw new BookingError('not_enough_seats', 409, { left: st.left })
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'PENDING_PAYMENT', holdExpiresAt: liveHold ? b.holdExpiresAt : holdUntil(), cancelReason: null, cancelledAt: null, updatedAt: new Date() })
      .where(eq(bookings.id, b.id))
      .returning()
    return updated
  })
  const payment = await startPayment(db, booking, provider)
  return { booking, payment }
}

export type PaymentApplied = { ref: string; lang: Lang; status: BookingRow['status']; outcome: VerifiedResult['outcome']; duplicate: boolean }

/**
 * Applies a verified gateway result. Idempotent: the bank may send the same result up to three times
 * (browser, reload, background confirmation); only the first marks the booking paid and queues its e-mails.
 */
export async function applyPaymentResult(result: VerifiedResult): Promise<PaymentApplied> {
  const db = await getDb()
  const [pay0] = await db.select().from(payments).where(eq(payments.orderId, result.orderId))
  if (!pay0 || pay0.provider !== result.provider) throw new BookingError('unknown_order', 404)
  const [b0] = await db.select().from(bookings).where(eq(bookings.id, pay0.bookingId))
  if (!b0) throw new BookingError('unknown_order', 404)

  const applied = await db.transaction(async (tx): Promise<PaymentApplied> => {
    await lockDeparture(tx, b0.cruise, b0.date)
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, b0.id)).for('update')
    const [pay] = await tx.select().from(payments).where(eq(payments.id, pay0.id)).for('update')
    const base = { ref: b.ref, lang: b.lang, outcome: result.outcome }
    if (pay.status === 'paid') return { ...base, status: b.status, duplicate: true }
    const now = new Date()

    if (result.outcome !== 'paid') {
      if (pay.status === 'started') {
        await tx
          .update(payments)
          .set({ status: result.outcome === 'cancelled' ? 'cancelled' : 'failed', providerStatus: result.providerStatus, providerMessage: result.message ?? null, updatedAt: now, completedAt: now })
          .where(eq(payments.id, pay.id))
      }
      log.info('payment.not_completed', { ref: b.ref, order: pay.orderId, status: result.providerStatus })
      return { ...base, status: b.status, duplicate: pay.status !== 'started' }
    }

    // research §3.5 step 3: the amount and currency must be the ones we asked for
    if (result.amountCents !== pay.amountCents || result.currency !== pay.currency) {
      await tx
        .update(payments)
        .set({ status: 'failed', providerStatus: `AMOUNT_MISMATCH:${result.providerStatus}`, providerTxId: result.txId ?? null, updatedAt: now, completedAt: now })
        .where(eq(payments.id, pay.id))
      await tx.update(bookings).set({ attention: addAttention(b.attention, 'payment_amount_mismatch'), updatedAt: now }).where(eq(bookings.id, b.id))
      log.error('payment.amount_mismatch', { ref: b.ref, order: pay.orderId })
      return { ...base, outcome: 'failed', status: b.status, duplicate: false }
    }

    await tx
      .update(payments)
      .set({ status: 'paid', providerStatus: result.providerStatus, providerTxId: result.txId ?? null, providerMessage: result.message ?? null, updatedAt: now, completedAt: now })
      .where(eq(payments.id, pay.id))

    // a second successful attempt for a booking that is already settled: keep the booking, flag the extra charge
    if (b.status === 'PAID' || b.status === 'REFUND_DUE' || b.status === 'REFUNDED') {
      await tx.update(bookings).set({ attention: addAttention(b.attention, 'double_payment'), updatedAt: now }).where(eq(bookings.id, b.id))
      log.warn('payment.double', { ref: b.ref, order: pay.orderId })
      return { ...base, status: b.status, duplicate: false }
    }

    const [override] = await tx
      .select()
      .from(departureOverrides)
      .where(and(eq(departureOverrides.cruise, b.cruise), eq(departureOverrides.date, b.date)))
    let attention = b.attention
    let status: BookingRow['status'] = 'PAID'
    if (override?.status === 'cancelled') {
      // the Captain cancelled the departure while the guest was on the bank's page
      status = 'REFUND_DUE'
      attention = addAttention(attention, 'paid_after_departure_cancelled')
    } else if (b.status === 'CANCELLED' || (b.holdExpiresAt && b.holdExpiresAt < now)) {
      // paid after the hold ran out: accept it (the money is taken) but tell the owner if the boat is now over capacity
      const setting = (await loadSettings(tx)).get(b.cruise as ScheduledKey)
      const capacity = override?.capacity ?? setting?.capacity ?? 0
      if ((await seatsTaken(tx, b.cruise, b.date, b.id)) + seatsOf(b) > capacity) attention = addAttention(attention, 'over_capacity')
    }
    await tx
      .update(bookings)
      .set({
        status,
        paidAt: now,
        holdExpiresAt: null,
        paymentProvider: result.provider,
        paymentOrderId: pay.orderId,
        paymentReference: result.txId ?? null,
        cancelReason: status === 'REFUND_DUE' ? override?.cancelReason ?? 'departure_cancelled' : null,
        cancelledAt: status === 'REFUND_DUE' ? now : null,
        refundDueAt: status === 'REFUND_DUE' ? now : null,
        attention,
        updatedAt: now,
      })
      .where(eq(bookings.id, b.id))
    if (status === 'PAID') {
      await enqueueEmail(tx, { kind: 'confirmation', entityRef: b.ref, dedupeKey: `confirmation:${b.ref}:${b.date}` })
      await enqueueEmail(tx, { kind: 'owner_booking', entityRef: b.ref, dedupeKey: `owner_booking:${b.ref}` })
    } else {
      await enqueueEmail(tx, { kind: 'cancellation', entityRef: b.ref, dedupeKey: `cancellation:${b.ref}:${b.date}` })
    }
    log.info('payment.paid', { ref: b.ref, order: pay.orderId, status, attention: attention ?? undefined })
    return { ...base, status, duplicate: false }
  })
  if (applied.outcome === 'paid' && !applied.duplicate) await deliverOutbox({ budgetMs: 6000 })
  return applied
}

/** Marks holds that ran out (plus a grace period for slow bank returns) as cancelled. Seats are free as soon as a hold expires either way. */
export async function expireHolds() {
  const db = await getDb()
  const rows = await db
    .update(bookings)
    .set({ status: 'CANCELLED', cancelReason: 'hold_expired', cancelledAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(bookings.status, 'PENDING_PAYMENT'), sql`${bookings.holdExpiresAt} < now() - make_interval(mins => ${HOLD_GRACE_MINUTES}::int)`))
    .returning({ ref: bookings.ref })
  if (rows.length) log.info('holds.expired', { count: rows.length })
  return rows.length
}

export async function findBooking(q: Queryable, ref: string) {
  const [b] = await q.select().from(bookings).where(eq(bookings.ref, ref))
  return b
}

/** The guest's own view of a booking (ticket page and GET /api/cruises/bookings/[ref]). No e-mail or phone. */
export async function ticketView(ref: string) {
  const db = await getDb()
  const b = await findBooking(db, ref)
  if (!b) return null
  const setting = (await loadSettings(db)).get(b.cruise as ScheduledKey)
  const times = setting ? pickupTimes(b.cruise, setting.depart, setting.returnSkala) : null
  const now = Date.now()
  const holdActive = b.status === 'PENDING_PAYMENT' && !!b.holdExpiresAt && b.holdExpiresAt.getTime() > now
  const [lastPayment] = await db.select().from(payments).where(eq(payments.bookingId, b.id)).orderBy(desc(payments.id)).limit(1)
  return {
    ref: b.ref,
    cruise: b.cruise as ScheduledKey,
    date: b.date,
    pickup: b.pickup,
    boarding: times ? (b.pickup === 'poros' && times.poros ? times.poros : times.skala) : null,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    seats: seatsOf(b),
    name: b.name,
    lang: b.lang,
    status: b.status,
    /** PENDING_PAYMENT whose hold ran out reads as "expired" so the page can offer to try again */
    holdActive,
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    lastPayment: lastPayment ? { status: lastPayment.status, at: lastPayment.updatedAt.toISOString() } : null,
    subtotal: b.subtotalCents / 100,
    discountKind: b.discountKind,
    discount: b.discountCents / 100,
    total: b.amountCents / 100,
    currency: b.currency,
    paidAt: b.paidAt?.toISOString() ?? null,
    cancelReason: b.cancelReason,
    refundDueAt: b.refundDueAt?.toISOString() ?? null,
    refundedAt: b.refundedAt?.toISOString() ?? null,
    movedFrom: b.movedFrom,
    token: ticketToken(b.ref),
  }
}
export type TicketView = NonNullable<Awaited<ReturnType<typeof ticketView>>>

/** The ticket link key for a booking, if `email` is the address it was made with (case-insensitive). */
export async function ticketTokenFor(ref: string, email: string) {
  const db = await getDb()
  const b = await findBooking(db, ref)
  if (!b || b.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null
  return ticketToken(b.ref)
}
