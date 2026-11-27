# Cruise booking server: API contract

Everything under `src/server` runs on the server only. Client components may `import type { … }` from these
files (types are erased) and may import `src/server/cruises/pricing.ts`, which is pure. Do not import any other
`src/server` module into a client component.

- Data: Postgres through Drizzle (`db/schema.ts`, migrations in `db/migrations.ts`, applied and seeded on first use).
  Development without `DATABASE_URL` uses PGlite in `.data/pglite`.
- Money in the API is in **euros** (numbers, e.g. `112` or `47.5`); the database stores cents.
- Dates are Greek calendar days `YYYY-MM-DD`; times are Greek wall-clock `HH:MM`.
- Errors are JSON `{ "error": "<code>", …extra }` with an HTTP status. `validation` errors list the field paths
  in `fields` (never the submitted values). Strings for every guest-facing code are in
  `src/content/{en,el,it}/payments.json → errors` (mapping below).
- POST/PATCH bodies must be `Content-Type: application/json`. Requests from a browser must come from this site
  (the `Origin` header is checked).

## Public

### `GET /api/cruises/schedule`
Live days, times and fares (what `/admin` last saved). Cached 15 s at the CDN.
```json
{ "season": { "start": "2027-05-01", "end": "2027-10-31" }, "today": "2026-11-25",
  "cruises": [{ "key": "ithacaVathiKioni", "active": true, "weekdays": [3, 0], "depart": "09:00", "returnSkala": "17:45",
    "times": { "skala": { "depart": "09:00", "back": "17:45" }, "poros": { "depart": "09:20", "back": "17:30" } },
    "prices": { "adult": 55, "child": 30 }, "capacity": 200, "updatedAt": "…" }] }
```
`times.poros` is `null` for the Zakynthos cruise (no Poros pick-up). Only the four scheduled cruises are listed.
`payments` (top level) is the payment page the booking will open: `"mock"` (test page: the pay step shows
`checkout.testMode`), `"alpha"`, or `null` when online payment is off (the pay step shows `errors.paymentsUnavailable`).
Fallback when the call fails: the static data in `src/data/cruises.ts` (`scheduleOf`).

### `GET /api/cruises/availability?cruise=ithacaVathiKioni[,fiscardo…]&from=YYYY-MM-DD&to=YYYY-MM-DD`
All params optional (default: every scheduled cruise, today to the end of the season; at most 400 days).
```json
{ "season": {…}, "today": "…", "from": "…", "to": "…",
  "departures": { "ithacaVathiKioni": [{ "date": "2027-06-09", "status": "open", "left": 196, "capacity": 200 }] } }
```
`status`: `open` · `soldout` · `cancelled` (the Captain cancelled it) · `closed` (closed by the Captain, or online
booking closed because the boat leaves within 60 minutes) · `past`. `left` is 0 unless `open`/`soldout`.
Seats left already subtract live 15-minute holds of guests who are paying.

### `POST /api/cruises/bookings`: create the booking and start the payment
```json
{ "cruise": "ithacaVathiKioni", "date": "2027-06-09", "adults": 2, "children": 1, "infants": 1,
  "pickup": "skala", "guest": true, "second": false,
  "name": "…", "email": "…", "phone": "+44 …", "hotel": "…", "notes": "…",
  "lang": "en", "acceptTerms": true, "expectedTotal": 112 }
```
- `children` = ages 4 to 11 (child fare), `infants` = under 4 (free, but they take a seat). At most 20 adults, 10 children and 4 infants per online booking (what the widget offers).
- `pickup: "poros"` only on cruises whose `times.poros` is not null (else `400 pickup_unavailable`).
- `guest` (staying at Aegealis/Theodora, 20%) and `second` (second cruise, 15%) are not combined: the server applies the larger.
  Use `quoteEuros(prices, { adults, children }, guest, second)` from `src/server/cruises/pricing.ts` to show the same total
  (discount rounded to whole euros, exactly as the server does).
- `acceptTerms` must be `true` (the bank requires a terms checkbox before payment): otherwise `400 validation, fields: ["acceptTerms"]`.
- `expectedTotal` (optional, euros): the total the guest saw. If the price changed, `409 price_changed { total }` and nothing is held.
- Phone must be international (`+30 …` or `0030 …`), as in the form today.

`201`:
```json
{ "ref": "CV-FNZQQR", "status": "PENDING_PAYMENT", "total": 112, "currency": "EUR",
  "holdExpiresAt": "…", "token": "…", "ticketUrl": "/en/cruises/ticket/CV-FNZQQR?k=…",
  "payment": { "provider": "mock", "orderId": "CVFNZQQR…", "redirectUrl": "/api/payments/mock?o=…&t=…" } }
```
Then: `window.location.assign(payment.redirectUrl)`. The guest pays (mock test page, or Alpha Bank's page), and the
bank's return lands on `ticketUrl` (`&p=ok` or `&p=failed`), which shows the e-ticket or a retry button.
Keep `ticketUrl` in sessionStorage if you want a "back to your booking" link.

Errors: `409 departure_unavailable { status: not_scheduled|cancelled|closed|soldout|past }`,
`409 not_enough_seats { left }`, `409 price_changed { total }`, `400 pickup_unavailable`, `400 validation { fields }`,
`429 rate_limited { retryAfter }` (12 per 10 minutes per visitor), `503 payments_unavailable`.

### `GET /api/cruises/bookings/{ref}?k={token}`
The guest view of a booking (no e-mail or phone): `ref, cruise, date, pickup, boarding {depart, back}, adults, children,
infants, seats, name, lang, status, holdActive, holdExpiresAt, lastPayment {status, at}, subtotal, discountKind, discount,
total, currency, paidAt, cancelReason, refundDueAt, refundedAt, movedFrom`. Wrong key: `404 not_found`.

### `POST /api/cruises/bookings/{ref}/pay` `{ "k": "<token>" }`
New payment attempt for an unpaid booking (after a declined card or an expired hold; re-checks the seats). A live hold keeps its end time; an expired one is taken again for 15 minutes.
`200 { ref, status, total, holdExpiresAt, payment: { redirectUrl, … } }`, or `409 already_paid`, `409 not_payable { status }`,
`409 departure_unavailable`, `409 not_enough_seats`, `429`.

### `POST /api/cruises/tickets/lookup` `{ "ref": "CV-…", "email": "…" }`
`200 { ref, token }` when the e-mail is the booking's (case-insensitive); `404 not_found` otherwise (same answer for an
unknown reference). 10 per 15 minutes per visitor. The ticket page uses it; open `/{lang}/cruises/ticket/{ref}?k={token}`.

### `GET /api/cruises/bookings/{ref}/ics?k={token}`: calendar file of a paid booking.
### `GET /api/cruises/qr/{ref}`: PNG QR code of the reference (used in e-mails).

### `POST /api/cruises/requests`: enquiry for an on-request cruise
```json
{ "cruise": "bbq" | "private" | "wedding", "date": "2027-07-15" | null, "people": 12,
  "name": "…", "email": "…", "phone": "+39 …", "message": "…", "lang": "it" }
```
`201 { ref: "RQ-…", status: "new" }`. The guest gets an acknowledgement e-mail and the owner a notification.
Date, if given, must be between today and two years ahead. 6 per 10 minutes per visitor.

### Ticket page `/{lang}/cruises/ticket/{ref}?k={token}` (noindex, done)
Shows the e-ticket (QR, details, calendar, print), the "payment not complete / retry" state, the expired hold, the
Captain's cancellation with the refund policy, or the refund. Without a valid `k` it asks for the booking e-mail.

## Admin (Greek UI; all routes need the session cookie, else `401 unauthorized`)

| Method & path | Body / query | Answer |
|---|---|---|
| `POST /api/admin/login` | `{ password }` | `200 { ok }` + httpOnly cookie (12 h); `401 wrong_password`; `429` after 6 tries / 15 min per visitor, or 30 wrong passwords / 15 min in all |
| `POST /api/admin/logout` | `{}` | clears the cookie |
| `GET /api/admin/session` | | `{ authenticated, expiresAt }` (no 401: use it to pick login vs dashboard) |
| `GET /api/admin/overview` | | `{ today, refundDue, attention, newRequests, pendingEmails, failedEmails, payments: 'mock'|'alpha'|null, email: 'file'|'smtp'|'resend'|null }` |
| `GET /api/admin/departures` | `?from&to&cruise` (default last 7 days to +120) | `{ from, to, departures: AdminDeparture[] }` |
| `GET /api/admin/departures/{cruise}/{date}` | | `{ departure, times, passengers: AdminBooking[], totals { paid, adults, children, infants, poros } }` |
| `PATCH /api/admin/departures/{cruise}/{date}` | `{ status?: 'open'|'closed', capacity?: number|null, note?: string|null }` | same as GET (reopening a cancelled departure: `status: 'open'`) |
| `POST /api/admin/departures/{cruise}/{date}/cancel` | `{ reason: 'weather'|'technical', note? }` | `{ refundDue: [refs], released, emailsQueued, delivery }` |
| `GET /api/admin/departures/{cruise}/{date}/passengers` | `?format=json|csv|html` | CSV download (UTF-8 BOM) or a printable A4 page (open in a new tab) |
| `GET /api/admin/bookings` | `?status&cruise&from&to&attention=1&limit` | `{ bookings: AdminBooking[] }` (expired holds hidden unless `status` is given) |
| `POST /api/admin/bookings/search` | `{ q?, status?, cruise?, from?, to?, attention?, limit? }` | same answer; the search text (name, e-mail, phone, ref) goes in the body, never in a URL |
| `GET /api/admin/bookings/{ref}` | | `{ booking, payments[], emails[] }` |
| `POST /api/admin/bookings/{ref}/refunded` | `{ note? }` | REFUND_DUE → REFUNDED (`409 not_refund_due` otherwise) |
| `POST /api/admin/bookings/{ref}/move` | `{ date }` | PAID or REFUND_DUE → PAID on another date of the same cruise, new e-ticket e-mailed |
| `POST /api/admin/bookings/{ref}/resend` | `{}` | sends the e-ticket again (PAID only) |
| `GET /api/admin/settings` | | `{ season, boatCapacity, holdMinutes, cutoffMinutes, cruises: [{ key, weekdays, depart, returnSkala, adult, child, capacity, active, times, updatedAt }] }` |
| `PATCH /api/admin/settings` | `{ season: { start, end } }` | settings |
| `PATCH /api/admin/settings/{cruise}` | any of `{ weekdays, depart, returnSkala, adult, child, capacity, active }` | settings; `409 weekday_conflict { weekday, cruise }` (one boat), `400 return_before_departure` |
| `GET /api/admin/requests` | `?status=new|answered|closed` | `{ requests[] }` |
| `PATCH /api/admin/requests/{ref}` | `{ status }` | `{ request }` |
| `POST /api/admin/outbox/flush` | `{}` | `{ sent, skipped, failed, retrying, pending, provider }`: call again while `pending > 0` |

`AdminDeparture`: `cruise, date, weekday, depart, returnSkala, status, closedBy ('cutoff'|'admin'), onSchedule (false =
off the current schedule but has bookings), capacity, customCapacity, paidSeats, heldSeats, left, refundDueSeats,
refundedSeats, bookings, note, cancelReason`.

`AdminBooking`: `ref, cruise, date, status, holdActive, holdExpiresAt, name, email, phone, adults, children, infants, seats,
pickup, hotel, notes, lang, subtotal, discountKind ('none'|'guest20'|'second15'), discount, total, currency, paidAt,
paymentProvider, paymentOrderId, paymentReference, cancelReason, cancelledAt, refundDueAt, refundedAt, refundNote,
attention[], movedFrom, createdAt`.

`attention` codes the admin should show (Greek wording is up to the UI): `over_capacity` (paid after the hold ran out and the
boat is now over capacity), `paid_after_departure_cancelled` (refund due), `double_payment` (a second successful payment:
refund the extra one in the bank's back office), `payment_amount_mismatch` (the bank reported another amount: check it).

Statuses: `PENDING_PAYMENT` (seats held while `holdActive`), `PAID`, `CANCELLED` (`cancelReason: hold_expired` or
`departure_cancelled`; nothing was charged), `REFUND_DUE` (the Captain cancelled; refund within 3 working days or move it),
`REFUNDED`.

Cancelling sends as many e-mails as fit in about 8 seconds; show `delivery.pending` and call `outbox/flush` until 0.
Refunds themselves are made in the bank's back office (the Alpha redirect platform has no refund API we can rely on yet),
then the admin presses "refunded".

## Error code → copy (`payments.json → errors`)

| code | key |
|---|---|
| `not_enough_seats { left }` | `notEnoughSeats` (`notEnoughSeatsOne` when left is 1) |
| `departure_unavailable { status: soldout }` | `soldOut` |
| `departure_unavailable { status: cancelled }` | `cancelled` |
| `departure_unavailable { status: closed }` | `closed` |
| `departure_unavailable` (other) | `unavailable` |
| `price_changed { total }` | `priceChanged` (`{amount}`) |
| `pickup_unavailable` | `pickupUnavailable` |
| `validation` with `acceptTerms` | `termsRequired` |
| `validation` (other) | `validation` |
| `rate_limited` | `rateLimited` |
| `payments_unavailable` | `paymentsUnavailable` |
| `already_paid` / `not_payable` | `alreadyPaid` / `notPayable` |
| anything else | `generic` |

`payments.json → checkout` has the pay-step strings (terms checkbox, "Pay {amount} securely", redirecting, secure-page note,
15-minute hold note, test-mode note when `payment.provider === 'mock'`).

## Cron (Vercel, `vercel.json`; header `Authorization: Bearer $CRON_SECRET`)
- `GET /api/cron/reminders` daily 15:00 UTC: reminder e-mail for every paid booking sailing tomorrow, then sends the queue.
- `GET /api/cron/expire-holds` daily 03:30 UTC: marks expired holds CANCELLED, retries e-mails, prunes rate-limit counters.
  (Seats of an expired hold are free immediately; this is housekeeping.)
