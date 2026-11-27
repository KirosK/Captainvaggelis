// What the Greek admin (/admin) reads and changes. Every route that calls these requires the admin session.

import { revalidatePath } from 'next/cache'
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { getDb, type Queryable } from '../db/client'
import { auditLog, appSettings, bookings, cruiseRequests, cruiseSettings, departureOverrides, emailOutbox, payments, type BookingRow, type BookingStatus, type CancelReason } from '../db/schema'
import { deliverOutbox, enqueueEmail } from '../email/outbox'
import { getEmailProvider } from '../email/providers'
import { configuredProvider } from '../payments'
import { errorText, log } from '../log'
import { addDaysISO, athensNow, daysBetween, weekdayOf } from '../time'
import { BookingError, lockDeparture, seatsOf } from './bookings'
import { BOAT_CAPACITY, BOOKING_CUTOFF_MINUTES, HOLD_MINUTES, isScheduledKey, pickupTimes, SCHEDULED_KEYS, type ScheduledKey } from './catalog'
import { depKey, departureState, loadOverrides, loadSeason, loadSeatCounts, loadSettings, sailingDates, seatsTaken, type DepartureStatus, type Season } from './schedule'

export async function audit(q: Queryable, action: string, target: string, detail?: Record<string, unknown>) {
  await q.insert(auditLog).values({ action, target, detail: detail ?? null })
}

const euros = (cents: number) => cents / 100

// ----- overview ---------------------------------------------------------------------------------------------

export async function overview() {
  const db = await getDb()
  const count = async (q: Promise<{ n: number }[]>) => +((await q)[0]?.n ?? 0)
  const n = sql<number>`count(*)::int`
  const [refundDue, attention, newRequests, pendingEmails, failedEmails] = await Promise.all([
    count(db.select({ n }).from(bookings).where(eq(bookings.status, 'REFUND_DUE'))),
    count(db.select({ n }).from(bookings).where(sql`${bookings.attention} is not null and ${bookings.attention} <> ''`)),
    count(db.select({ n }).from(cruiseRequests).where(eq(cruiseRequests.status, 'new'))),
    count(db.select({ n }).from(emailOutbox).where(inArray(emailOutbox.status, ['pending', 'sending']))),
    count(db.select({ n }).from(emailOutbox).where(eq(emailOutbox.status, 'failed'))),
  ])
  return {
    today: athensNow().date,
    refundDue,
    attention,
    newRequests,
    pendingEmails,
    failedEmails,
    payments: configuredProvider(),
    email: getEmailProvider()?.id ?? null,
  }
}

// ----- departures -------------------------------------------------------------------------------------------

export type AdminDeparture = {
  cruise: ScheduledKey
  date: string
  weekday: number
  depart: string
  returnSkala: string
  status: DepartureStatus
  closedBy?: 'cutoff' | 'admin'
  /** false when the date is no longer on the schedule but still has bookings or an override */
  onSchedule: boolean
  capacity: number
  /** true when this departure has its own capacity (override), not the cruise's */
  customCapacity: boolean
  paidSeats: number
  heldSeats: number
  left: number
  refundDueSeats: number
  refundedSeats: number
  bookings: number
  note: string | null
  cancelReason: string | null
}

export async function listDepartures(opts: { from: string; to: string; cruise?: ScheduledKey }): Promise<AdminDeparture[]> {
  const db = await getDb()
  const now = athensNow()
  const [settings, season] = await Promise.all([loadSettings(db), loadSeason(db)])
  const keys = opts.cruise ? [opts.cruise] : [...SCHEDULED_KEYS]
  const [overrides, counts] = await Promise.all([loadOverrides(db, opts.from, opts.to, keys), loadSeatCounts(db, opts.from, opts.to, keys)])
  const out: AdminDeparture[] = []
  for (const k of keys) {
    const setting = settings.get(k)
    if (!setting) continue
    const dates = new Set(sailingDates(setting, season, opts.from, opts.to))
    for (const key of [...overrides.keys(), ...counts.keys()]) if (key.startsWith(`${k}:`)) dates.add(key.slice(k.length + 1))
    for (const date of dates) {
      const c = counts.get(depKey(k, date)) ?? { paid: 0, held: 0, refundDue: 0, refunded: 0, bookings: 0 }
      const ov = overrides.get(depKey(k, date))
      const st = departureState({ setting, season, date, override: ov, taken: c.paid + c.held, now })
      out.push({
        cruise: k,
        date,
        weekday: weekdayOf(date),
        depart: setting.depart,
        returnSkala: setting.returnSkala,
        status: st.status,
        closedBy: st.closedBy,
        onSchedule: st.onSchedule,
        capacity: st.capacity,
        customCapacity: ov?.capacity != null,
        paidSeats: c.paid,
        heldSeats: c.held,
        left: st.left,
        refundDueSeats: c.refundDue,
        refundedSeats: c.refunded,
        bookings: c.bookings,
        note: ov?.note ?? null,
        cancelReason: ov?.cancelReason ?? null,
      })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.cruise.localeCompare(b.cruise) : a.date < b.date ? -1 : 1))
}

export type AdminBooking = ReturnType<typeof adminBooking>

export function adminBooking(b: BookingRow) {
  const holdActive = b.status === 'PENDING_PAYMENT' && !!b.holdExpiresAt && b.holdExpiresAt.getTime() > Date.now()
  return {
    ref: b.ref,
    cruise: b.cruise,
    date: b.date,
    status: b.status,
    holdActive,
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    name: b.name,
    email: b.email,
    phone: b.phone,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    seats: seatsOf(b),
    pickup: b.pickup,
    hotel: b.hotel,
    notes: b.notes,
    lang: b.lang,
    subtotal: euros(b.subtotalCents),
    discountKind: b.discountKind,
    discount: euros(b.discountCents),
    total: euros(b.amountCents),
    currency: b.currency,
    paidAt: b.paidAt?.toISOString() ?? null,
    paymentProvider: b.paymentProvider,
    paymentOrderId: b.paymentOrderId,
    paymentReference: b.paymentReference,
    cancelReason: b.cancelReason,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    refundDueAt: b.refundDueAt?.toISOString() ?? null,
    refundedAt: b.refundedAt?.toISOString() ?? null,
    refundNote: b.refundNote,
    attention: b.attention ? b.attention.split(',').filter(Boolean) : [],
    movedFrom: b.movedFrom,
    createdAt: b.createdAt.toISOString(),
  }
}

/** One departure and its passenger list: paid, held right now, due a refund and refunded (not expired or unpaid holds). */
export async function departureDetail(cruise: ScheduledKey, date: string) {
  const db = await getDb()
  const [departure] = await listDepartures({ from: date, to: date, cruise })
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.cruise, cruise), eq(bookings.date, date), ne(bookings.status, 'CANCELLED')))
    .orderBy(asc(bookings.pickup), asc(bookings.name))
  const passengers = rows.map(adminBooking).filter((b) => b.status !== 'PENDING_PAYMENT' || b.holdActive)
  const setting = (await loadSettings(db)).get(cruise)
  return {
    departure: departure ?? null,
    times: setting ? pickupTimes(cruise, setting.depart, setting.returnSkala) : null,
    passengers,
    totals: {
      paid: passengers.filter((p) => p.status === 'PAID').reduce((n, p) => n + p.seats, 0),
      adults: passengers.filter((p) => p.status === 'PAID').reduce((n, p) => n + p.adults, 0),
      children: passengers.filter((p) => p.status === 'PAID').reduce((n, p) => n + p.children, 0),
      infants: passengers.filter((p) => p.status === 'PAID').reduce((n, p) => n + p.infants, 0),
      poros: passengers.filter((p) => p.status === 'PAID' && p.pickup === 'poros').reduce((n, p) => n + p.seats, 0),
    },
  }
}

const STATUS_EL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Σε αναμονή πληρωμής',
  PAID: 'Πληρωμένη',
  CANCELLED: 'Ακυρωμένη',
  REFUND_DUE: 'Οφείλεται επιστροφή',
  REFUNDED: 'Επιστράφηκαν',
}
const DISCOUNT_EL: Record<string, string> = { none: '', guest20: 'Φιλοξενούμενοι 20%', second15: 'Δεύτερη κρουαζιέρα 15%' }
const PICKUP_EL: Record<string, string> = { skala: 'Σκάλα', poros: 'Πόρος' }
const LANG_EL: Record<string, string> = { en: 'EN', el: 'EL', it: 'IT' }

/** Spreadsheet cells that start with = + - @ (or a tab) are prefixed with ' so Excel does not run them as formulas. */
const csvCell = (v: string | number | null | undefined) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Phones always start with + (or 00), which would trip the formula guard on every row and show a stray ' in Excel and
 * Numbers. "+44 7700 900123" is written as "0044 7700 900123" instead: the same international number, not a formula;
 * a number typed without spaces gets one after the 00, so the spreadsheet keeps it as text with its leading zeros.
 */
export function csvPhone(phone: string) {
  const s = phone.trim().replace(/^\+/, '00')
  return /^\d+$/.test(s) ? `${s.slice(0, 2)} ${s.slice(2)}` : s
}

export function passengersCsv(passengers: AdminBooking[]) {
  const head = ['Κωδικός', 'Κατάσταση', 'Όνομα', 'Τηλέφωνο', 'E-mail', 'Ενήλικες', 'Παιδιά', 'Βρέφη', 'Θέσεις', 'Επιβίβαση', 'Πού μένει', 'Σημειώσεις', 'Ποσό €', 'Έκπτωση', 'Γλώσσα']
  const rows = passengers.map((p) => [
    p.ref,
    STATUS_EL[p.status],
    p.name,
    csvPhone(p.phone),
    p.email,
    p.adults,
    p.children,
    p.infants,
    p.seats,
    PICKUP_EL[p.pickup] ?? p.pickup,
    p.hotel,
    p.notes,
    p.total.toFixed(2).replace('.', ','),
    DISCOUNT_EL[p.discountKind] ?? '',
    LANG_EL[p.lang] ?? p.lang,
  ])
  // BOM + CRLF so Excel opens the Greek text correctly
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A printable passenger list (A4), opened from the admin in a new tab. */
export function passengersHtml(d: Awaited<ReturnType<typeof departureDetail>>, cruiseName: string) {
  const dep = d.departure
  const dateText = dep ? new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dep.date}T00:00:00Z`)) : ''
  const paid = d.passengers.filter((p) => p.status === 'PAID')
  const others = d.passengers.filter((p) => p.status !== 'PAID')
  const rows = (list: AdminBooking[]) =>
    list
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td class="mono">${escHtml(p.ref)}</td><td>${escHtml(p.name)}</td><td>${escHtml(p.phone)}</td><td class="num">${p.adults}</td><td class="num">${p.children}</td><td class="num">${p.infants}</td><td class="num"><b>${p.seats}</b></td><td>${escHtml(PICKUP_EL[p.pickup] ?? p.pickup)}</td><td>${escHtml([p.hotel, p.notes].filter(Boolean).join(' · '))}</td><td>${p.status === 'PAID' ? '' : escHtml(STATUS_EL[p.status])}</td><td class="tick"></td></tr>`,
      )
      .join('')
  const table = (list: AdminBooking[]) =>
    `<table><thead><tr><th>#</th><th>Κωδικός</th><th>Όνομα</th><th>Τηλέφωνο</th><th>Ενήλ.</th><th>Παιδιά</th><th>Βρέφη</th><th>Θέσεις</th><th>Επιβίβαση</th><th>Διαμονή / σημειώσεις</th><th>Κατάσταση</th><th>✓</th></tr></thead><tbody>${rows(list)}</tbody></table>`
  return `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Επιβάτες · ${escHtml(cruiseName)} · ${escHtml(dep?.date ?? '')}</title>
<style>
body{font:13px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0F2430;margin:24px}
h1{font:400 22px Georgia,serif;margin:0 0 4px}p{margin:0 0 12px;color:#2A3F4B}
table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{border:1px solid #cfc6b6;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#F5EFE5;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.num{text-align:right}.mono{font-family:Menlo,Consolas,monospace}.tick{width:28px}
.bar{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 4px}.bar b{font-size:15px}
@media print{body{margin:10mm}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px;border-radius:999px;border:1px solid #0F2430;background:#fff;cursor:pointer">Εκτύπωση</button>
<h1>${escHtml(cruiseName)}</h1>
<p>${escHtml(dateText)} · Αναχώρηση Σκάλα ${escHtml(d.times?.skala.depart ?? '')}${d.times?.poros ? ` · Πόρος ${escHtml(d.times.poros.depart)}` : ''} · Επιστροφή ${escHtml(d.times?.skala.back ?? '')}</p>
<div class="bar"><span>Θέσεις πληρωμένες: <b>${d.totals.paid}</b></span><span>Ενήλικες: <b>${d.totals.adults}</b></span><span>Παιδιά: <b>${d.totals.children}</b></span><span>Βρέφη: <b>${d.totals.infants}</b></span>${d.times?.poros ? `<span>Από Πόρο: <b>${d.totals.poros}</b></span>` : ''}${dep ? `<span>Χωρητικότητα: <b>${dep.capacity}</b></span>` : ''}</div>
${dep?.status === 'cancelled' ? '<p><b>Η αναχώρηση έχει ακυρωθεί.</b></p>' : ''}
${table(paid)}
${others.length ? `<h2 style="font:400 16px Georgia,serif">Άλλες κρατήσεις (δεν επιβιβάζονται)</h2>${table(others)}` : ''}
</body></html>`
}

/** Close or reopen a departure to online booking, or give it its own capacity. Cancelling has its own action. */
export async function setDeparture(cruise: ScheduledKey, date: string, patch: { status?: 'open' | 'closed'; capacity?: number | null; note?: string | null }) {
  const db = await getDb()
  if (patch.capacity != null && patch.capacity > BOAT_CAPACITY) throw new BookingError('capacity_too_high', 400, { max: BOAT_CAPACITY })
  await db.transaction(async (tx) => {
    await lockDeparture(tx, cruise, date)
    const [cur] = await tx
      .select()
      .from(departureOverrides)
      .where(and(eq(departureOverrides.cruise, cruise), eq(departureOverrides.date, date)))
    const next = {
      status: patch.status ?? cur?.status ?? 'open',
      capacity: patch.capacity !== undefined ? patch.capacity : cur?.capacity ?? null,
      note: patch.note !== undefined ? patch.note || null : cur?.note ?? null,
      cancelReason: patch.status === 'open' ? null : cur?.cancelReason ?? null,
      cancelledAt: patch.status === 'open' ? null : cur?.cancelledAt ?? null,
    }
    if (next.status === 'open' && next.capacity == null && !next.note) {
      await tx.delete(departureOverrides).where(and(eq(departureOverrides.cruise, cruise), eq(departureOverrides.date, date)))
    } else {
      await tx
        .insert(departureOverrides)
        .values({ cruise, date, ...next, updatedAt: new Date() })
        .onConflictDoUpdate({ target: [departureOverrides.cruise, departureOverrides.date], set: { ...next, updatedAt: new Date() } })
    }
    await audit(tx, 'departure.update', depKey(cruise, date), { from: cur ? { status: cur.status, capacity: cur.capacity } : null, to: { status: next.status, capacity: next.capacity } })
  })
  return departureDetail(cruise, date)
}

/**
 * The Captain cancels a departure for weather or technical reasons (facts.md): paid bookings become REFUND_DUE
 * and each guest gets the cancellation e-mail; holds of guests still paying are released.
 * E-mails are queued in the same transaction; this call sends as many as fit in a few seconds and the admin
 * sends the rest with POST /api/admin/outbox/flush.
 */
export async function cancelDeparture(cruise: ScheduledKey, date: string, reason: CancelReason, note?: string | null) {
  const db = await getDb()
  const now = athensNow()
  if (date < now.date) throw new BookingError('departure_past', 409)
  const result = await db.transaction(async (tx) => {
    await lockDeparture(tx, cruise, date)
    const at = new Date()
    await tx
      .insert(departureOverrides)
      .values({ cruise, date, status: 'cancelled', cancelReason: reason, cancelledAt: at, note: note || null, updatedAt: at })
      .onConflictDoUpdate({
        target: [departureOverrides.cruise, departureOverrides.date],
        set: { status: 'cancelled', cancelReason: reason, cancelledAt: at, note: note || null, updatedAt: at },
      })
    const refundDue = await tx
      .update(bookings)
      .set({ status: 'REFUND_DUE', cancelReason: reason, cancelledAt: at, refundDueAt: at, updatedAt: at })
      .where(and(eq(bookings.cruise, cruise), eq(bookings.date, date), eq(bookings.status, 'PAID')))
      .returning({ ref: bookings.ref })
    const released = await tx
      .update(bookings)
      .set({ status: 'CANCELLED', cancelReason: 'departure_cancelled', cancelledAt: at, holdExpiresAt: null, updatedAt: at })
      .where(and(eq(bookings.cruise, cruise), eq(bookings.date, date), eq(bookings.status, 'PENDING_PAYMENT')))
      .returning({ ref: bookings.ref })
    let queued = 0
    for (const { ref } of refundDue) if (await enqueueEmail(tx, { kind: 'cancellation', entityRef: ref, dedupeKey: `cancellation:${ref}:${date}` })) queued++
    await audit(tx, 'departure.cancel', depKey(cruise, date), { reason, refundDue: refundDue.length, released: released.length })
    return { refundDue: refundDue.map((r) => r.ref), released: released.length, emailsQueued: queued }
  })
  log.info('departure.cancelled', { cruise, date, reason, refundDue: result.refundDue.length, released: result.released })
  const delivery = await deliverOutbox({ budgetMs: 8000 })
  return { ...result, delivery }
}

/** After the refund was made in the bank's back office. */
export async function markRefunded(ref: string, note?: string | null) {
  const db = await getDb()
  const [b] = await db
    .update(bookings)
    .set({ status: 'REFUNDED', refundedAt: new Date(), refundNote: note || null, updatedAt: new Date() })
    .where(and(eq(bookings.ref, ref), eq(bookings.status, 'REFUND_DUE')))
    .returning()
  if (!b) {
    const [cur] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.ref, ref))
    if (!cur) throw new BookingError('not_found', 404)
    throw new BookingError('not_refund_due', 409, { status: cur.status })
  }
  await audit(db, 'booking.refunded', ref)
  return adminBooking(b)
}

/**
 * Moves a paid booking, or one due a refund after a cancellation, to another date of the same cruise
 * (the guest chose "another date" instead of the refund). Seats are checked like a new booking; the guest
 * gets a new confirmation with the new date.
 */
export async function moveBooking(ref: string, date: string) {
  const db = await getDb()
  const [b0] = await db.select().from(bookings).where(eq(bookings.ref, ref))
  if (!b0) throw new BookingError('not_found', 404)
  if (b0.status !== 'PAID' && b0.status !== 'REFUND_DUE') throw new BookingError('not_movable', 409, { status: b0.status })
  // the same date is allowed only to restore a booking whose cancelled departure the Captain reopened
  if (b0.date === date && b0.status === 'PAID') throw new BookingError('same_date', 400)
  const moved = await db.transaction(async (tx) => {
    await lockDeparture(tx, b0.cruise, date)
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, b0.id)).for('update')
    if (b.status !== 'PAID' && b.status !== 'REFUND_DUE') throw new BookingError('not_movable', 409, { status: b.status })
    const setting = (await loadSettings(tx)).get(b.cruise as ScheduledKey)
    if (!setting) throw new BookingError('departure_unavailable', 409, { status: 'not_scheduled' })
    const season = await loadSeason(tx)
    const [override] = await tx
      .select()
      .from(departureOverrides)
      .where(and(eq(departureOverrides.cruise, b.cruise), eq(departureOverrides.date, date)))
    const st = departureState({ setting, season, date, override, taken: await seatsTaken(tx, b.cruise, date) })
    // the owner may fill a departure that is closed to online booking, but not a past or cancelled one
    if (st.status === 'past' || st.status === 'cancelled') throw new BookingError('departure_unavailable', 409, { status: st.status })
    if (!st.onSchedule) throw new BookingError('departure_unavailable', 409, { status: 'not_scheduled' })
    if (st.left < seatsOf(b)) throw new BookingError('not_enough_seats', 409, { left: st.left })
    const [u] = await tx
      .update(bookings)
      .set({ date, status: 'PAID', movedFrom: date === b.date ? b.movedFrom : b.movedFrom ?? b.date, cancelReason: null, cancelledAt: null, refundDueAt: null, updatedAt: new Date() })
      .where(eq(bookings.id, b.id))
      .returning()
    // a fresh confirmation for every move (the guest may move back to a date that already had one)
    await enqueueEmail(tx, { kind: 'confirmation', entityRef: u.ref, dedupeKey: `confirmation:${u.ref}:${date}:moved:${u.updatedAt.getTime()}` })
    await audit(tx, 'booking.move', ref, { from: b.date, to: date })
    return u
  })
  const delivery = await deliverOutbox({ budgetMs: 6000 })
  return { booking: adminBooking(moved), delivery }
}

export async function listBookings(opts: { q?: string; status?: BookingStatus; cruise?: ScheduledKey; from?: string; to?: string; attention?: boolean; limit?: number }) {
  const db = await getDb()
  const like = opts.q ? `%${opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : undefined
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        like ? or(ilike(bookings.ref, like), ilike(bookings.name, like), ilike(bookings.email, like), ilike(bookings.phone, like)) : undefined,
        opts.status ? eq(bookings.status, opts.status) : undefined,
        // expired holds are noise in the list unless asked for
        !opts.status ? sql`not (${bookings.status} = 'CANCELLED' and ${bookings.cancelReason} in ('hold_expired', 'departure_cancelled'))` : undefined,
        opts.cruise ? eq(bookings.cruise, opts.cruise) : undefined,
        opts.from ? gte(bookings.date, opts.from) : undefined,
        opts.to ? lte(bookings.date, opts.to) : undefined,
        opts.attention ? sql`${bookings.attention} is not null and ${bookings.attention} <> ''` : undefined,
      ),
    )
    .orderBy(desc(bookings.createdAt))
    .limit(Math.min(opts.limit ?? 200, 1000))
  return rows.map(adminBooking)
}

export async function bookingDetail(ref: string) {
  const db = await getDb()
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref))
  if (!b) return null
  const [pays, mails] = await Promise.all([
    db.select().from(payments).where(eq(payments.bookingId, b.id)).orderBy(asc(payments.id)),
    db.select().from(emailOutbox).where(eq(emailOutbox.entityRef, ref)).orderBy(asc(emailOutbox.id)),
  ])
  return {
    booking: adminBooking(b),
    payments: pays.map((p) => ({
      orderId: p.orderId,
      provider: p.provider,
      status: p.status,
      amount: euros(p.amountCents),
      providerStatus: p.providerStatus,
      providerTxId: p.providerTxId,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
    })),
    emails: mails.map((m) => ({ kind: m.kind, status: m.status, attempts: m.attempts, lastError: m.lastError, sentAt: m.sentAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString() })),
  }
}

// ----- settings -------------------------------------------------------------------------------------------

export async function getAdminSettings() {
  const db = await getDb()
  const [settings, season] = await Promise.all([loadSettings(db), loadSeason(db)])
  return {
    season,
    boatCapacity: BOAT_CAPACITY,
    holdMinutes: HOLD_MINUTES,
    cutoffMinutes: BOOKING_CUTOFF_MINUTES,
    cruises: SCHEDULED_KEYS.filter((k) => settings.has(k)).map((k) => {
      const s = settings.get(k)!
      return {
        key: k,
        weekdays: s.weekdays,
        depart: s.depart,
        returnSkala: s.returnSkala,
        adult: euros(s.adultCents),
        child: euros(s.childCents),
        capacity: s.capacity,
        active: s.active,
        times: pickupTimes(k, s.depart, s.returnSkala),
        updatedAt: s.updatedAt.toISOString(),
      }
    }),
  }
}

/**
 * The public pages render the fares, days, times and season saved here (scheduleSeed, revalidated every minute):
 * after a change they are rebuilt on their next visit instead of up to a minute later.
 */
function refreshPublicPages() {
  try {
    revalidatePath('/[lang]/cruises', 'layout')
    revalidatePath('/[lang]', 'page')
  } catch (e) {
    log.warn('revalidate.failed', { error: errorText(e) })
  }
}

export type CruisePatch = { weekdays?: number[]; depart?: string; returnSkala?: string; adult?: number; child?: number; capacity?: number; active?: boolean }

export async function updateCruiseSettings(cruise: ScheduledKey, patch: CruisePatch) {
  const db = await getDb()
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(727002)`)
    const all = await loadSettings(tx)
    const cur = all.get(cruise)
    if (!cur) throw new BookingError('unknown_cruise', 404)
    const weekdays = patch.weekdays ? [...new Set(patch.weekdays)].sort() : cur.weekdays
    const active = patch.active ?? cur.active
    const depart = patch.depart ?? cur.depart
    const returnSkala = patch.returnSkala ?? cur.returnSkala
    if (returnSkala <= depart) throw new BookingError('return_before_departure', 400)
    // one boat: two active cruises cannot sail on the same weekday
    if (active) {
      for (const [k, s] of all) {
        if (k === cruise || !s.active) continue
        const clash = weekdays.find((d) => s.weekdays.includes(d))
        if (clash !== undefined) throw new BookingError('weekday_conflict', 409, { weekday: clash, cruise: k })
      }
    }
    await tx
      .update(cruiseSettings)
      .set({
        weekdays,
        active,
        depart,
        returnSkala,
        adultCents: patch.adult !== undefined ? Math.round(patch.adult * 100) : cur.adultCents,
        childCents: patch.child !== undefined ? Math.round(patch.child * 100) : cur.childCents,
        capacity: patch.capacity ?? cur.capacity,
        updatedAt: new Date(),
      })
      .where(eq(cruiseSettings.cruise, cruise))
    await audit(tx, 'cruise.update', cruise, { ...patch })
  })
  refreshPublicPages()
  return getAdminSettings()
}

export async function updateSeason(season: Season) {
  if (season.end < season.start || daysBetween(season.start, season.end) > 366) throw new BookingError('invalid_season', 400)
  const db = await getDb()
  await db
    .insert(appSettings)
    .values({ key: 'season', value: season, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: season, updatedAt: new Date() } })
  await audit(db, 'season.update', 'season', { ...season })
  refreshPublicPages()
  return getAdminSettings()
}

export const isCruiseKey = (k: string): k is ScheduledKey => isScheduledKey(k)
export const defaultRange = () => {
  const today = athensNow().date
  return { from: addDaysISO(today, -7), to: addDaysISO(today, 120) }
}
