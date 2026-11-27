// Drizzle schema for the cruise bookings. The SQL that creates these tables lives in ./migrations.ts
// (hand-written, so it runs the same on PGlite in development and on Postgres/Neon in production).
// Money is stored in euro cents; departure dates as 'YYYY-MM-DD' text (Greek calendar days).

import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const migrationsTable = pgTable('cv_migrations', {
  id: text('id').primaryKey(),
  appliedAt: ts('applied_at').notNull().defaultNow(),
})

/** One row per scheduled cruise (fiscardo, ithacaVathiKioni, ithacaVathi, zakynthos), seeded from src/data/cruises.ts. */
export const cruiseSettings = pgTable('cruise_settings', {
  cruise: text('cruise').primaryKey(),
  /** 0 = Sunday … 6 = Saturday */
  weekdays: jsonb('weekdays').$type<number[]>().notNull(),
  depart: text('depart').notNull(),
  returnSkala: text('return_skala').notNull(),
  adultCents: integer('adult_cents').notNull(),
  childCents: integer('child_cents').notNull(),
  capacity: integer('capacity').notNull(),
  active: boolean('active').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Small key/value settings, such as the bookable season. */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export type OverrideStatus = 'open' | 'cancelled' | 'closed'
export type CancelReason = 'weather' | 'technical'

/** What the Captain changed for one departure: cancelled, closed to online booking, or a different capacity. */
export const departureOverrides = pgTable(
  'departure_overrides',
  {
    cruise: text('cruise').notNull(),
    date: text('date').notNull(),
    status: text('status').$type<OverrideStatus>().notNull(),
    capacity: integer('capacity'),
    note: text('note'),
    cancelReason: text('cancel_reason').$type<CancelReason>(),
    cancelledAt: ts('cancelled_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cruise, t.date] })],
)

export type BookingStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUND_DUE' | 'REFUNDED'
export type DiscountKind = 'none' | 'guest20' | 'second15'
export type Pickup = 'skala' | 'poros'
export type Lang = 'en' | 'el' | 'it'
/** why a booking was cancelled or is due a refund */
export type BookingCancelReason = 'hold_expired' | 'weather' | 'technical' | 'departure_cancelled'

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    cruise: text('cruise').notNull(),
    date: text('date').notNull(),
    pickup: text('pickup').$type<Pickup>().notNull(),
    adults: integer('adults').notNull(),
    children: integer('children').notNull(),
    infants: integer('infants').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    hotel: text('hotel'),
    notes: text('notes'),
    lang: text('lang').$type<Lang>().notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountKind: text('discount_kind').$type<DiscountKind>().notNull(),
    discountCents: integer('discount_cents').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').$type<BookingStatus>().notNull(),
    /** seats count against the departure while PENDING_PAYMENT and this is in the future */
    holdExpiresAt: ts('hold_expires_at'),
    paymentProvider: text('payment_provider'),
    paymentOrderId: text('payment_order_id'),
    /** the gateway's transaction id of the successful payment (needed for refunds) */
    paymentReference: text('payment_reference'),
    paidAt: ts('paid_at'),
    cancelReason: text('cancel_reason').$type<BookingCancelReason>(),
    cancelledAt: ts('cancelled_at'),
    refundDueAt: ts('refund_due_at'),
    refundedAt: ts('refunded_at'),
    refundNote: text('refund_note'),
    /** something the owner must look at (paid after the hold ran out, a second payment, …); see bookings.ts */
    attention: text('attention'),
    /** the original date when the owner moved the booking to another day */
    movedFrom: text('moved_from'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('bookings_ref_key').on(t.ref), index('bookings_departure_idx').on(t.cruise, t.date), index('bookings_status_idx').on(t.status)],
)

export type PaymentStatus = 'started' | 'paid' | 'failed' | 'cancelled'

/** One row per payment attempt (a retry after a declined card gets a new order id, as the bank requires). */
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id),
    provider: text('provider').notNull(),
    orderId: text('order_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').$type<PaymentStatus>().notNull(),
    providerStatus: text('provider_status'),
    providerTxId: text('provider_tx_id'),
    providerMessage: text('provider_message'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
  },
  (t) => [uniqueIndex('payments_order_id_key').on(t.orderId), index('payments_booking_idx').on(t.bookingId)],
)

export type RequestStatus = 'new' | 'answered' | 'closed'

/** Enquiries for the cruises that run on request (BBQ, private, wedding). */
export const cruiseRequests = pgTable(
  'cruise_requests',
  {
    id: serial('id').primaryKey(),
    ref: text('ref').notNull(),
    cruise: text('cruise').notNull(),
    date: text('date'),
    people: integer('people').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    message: text('message'),
    lang: text('lang').$type<Lang>().notNull(),
    status: text('status').$type<RequestStatus>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('cruise_requests_ref_key').on(t.ref), index('cruise_requests_status_idx').on(t.status)],
)

export type EmailKind = 'confirmation' | 'reminder' | 'cancellation' | 'request_received' | 'owner_booking' | 'owner_request'
export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

/**
 * Every e-mail goes through this outbox: it is written in the same transaction as the change that causes it
 * (so a payment can never be marked paid without its confirmation being queued), and `dedupe_key` makes each
 * e-mail unique (a bank return arriving three times still sends one confirmation).
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: serial('id').primaryKey(),
    dedupeKey: text('dedupe_key').notNull(),
    kind: text('kind').$type<EmailKind>().notNull(),
    /** booking or request reference the e-mail is about */
    entityRef: text('entity_ref').notNull(),
    status: text('status').$type<OutboxStatus>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    sentAt: ts('sent_at'),
  },
  (t) => [uniqueIndex('email_outbox_dedupe_key').on(t.dedupeKey), index('email_outbox_status_idx').on(t.status, t.nextAttemptAt)],
)

/** Fixed-window counters for rate limiting; keys hold a keyed hash of the IP address. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: ts('window_start').notNull(),
  count: integer('count').notNull(),
})

/** What was done in the admin, and when (no personal data in `detail`). */
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  at: ts('at').notNull().defaultNow(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  detail: jsonb('detail'),
})

export type BookingRow = typeof bookings.$inferSelect
export type PaymentRow = typeof payments.$inferSelect
export type RequestRow = typeof cruiseRequests.$inferSelect
export type SettingsRow = typeof cruiseSettings.$inferSelect
export type OverrideRow = typeof departureOverrides.$inferSelect
