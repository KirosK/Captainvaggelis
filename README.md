# Captain Vangelis · Skala, Kefalonia (demo)

Website for Aegealis Studios, Theodora Studios & Apartments and Captain Vangelis Special Cruises.
Next.js 14 (App Router) + TypeScript + Tailwind, static pages in English, Greek and Italian.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3210
```

Admin (Greek): http://localhost:3210/admin. Without `ADMIN_PASSWORD` set, the development password is
`captain-dev` (development only: production refuses admin logins until `ADMIN_PASSWORD` is set).

## What is real and what is demo

Real (taken from Booking.com, kefalonia-cruises.gr and guest reviews, see `../research/facts.md`):
room types, policies, distances, ratings, reviews, cruise days, times and prices (2026 season).

Demo only (not labelled on the site, at the owner's request):
- nightly room rates (`src/data/properties.ts` → `demoRates`)
- room availability and room payments in the demo room flow (nothing is charged)

Cruise bookings are real: departures, seats, payments, e-mails and the admin run on a database
(see "Cruise bookings" and "Going live" below). Rooms are booked through the owner's VikBooking on
cptvangelis-apartments.com.

Before going live: follow "Going live" below and have the privacy and terms texts reviewed.
Open owner questions (discounts, Theodora house rules, larger original photos) are listed in
`../research/facts.md`.

## Content

- Copy: `src/content/{en,el,it}/*.json` (briefs in `src/content/brief`)
- Photos: curated in `../research/curation.json`, prepared with `npm run media:images`
- Films: defined in `../research/videos.json`, rendered with `npm run media:video`

The research folder (facts, photo curation, source photos) lives next to this repository and is
not part of it; the prepared photos and films in `public/media` are.

## Deploy (Vercel)

Set `NEXT_PUBLIC_SITE_URL` to the final domain. For a private preview set `NEXT_PUBLIC_NOINDEX=1`
(adds noindex headers and blocks robots). Maps use the free OpenFreeMap vector tiles (no key)
through MapLibre, recoloured in `src/components/map/BaseMap.tsx`.

## Cruise bookings

Guests book and pay for the scheduled cruises on the site; the Captain manages everything in `/admin`.
Server code: `src/server` (API contract in `src/server/README.md`), routes in `src/app/api`, the e-ticket page
in `src/app/[lang]/cruises/ticket/[ref]`, guest-facing strings in `src/content/{en,el,it}/payments.json`.

- **Seats**: a booking holds its seats for 15 minutes while the guest pays (`PENDING_PAYMENT`); the capacity check
  runs in a locked transaction per departure, so two guests can never buy the same last seats. Online booking
  closes 60 minutes before departure. Capacity is 200 (NIRIIS) unless the admin lowers it.
- **Payment**: 100% at booking. `mock` provider in development (a test page that simulates the bank, clearly
  labelled); Alpha Bank e-Commerce (Nexi, redirect + SHA-256 digest) when its credentials are set. Bank returns are
  signature-checked and applied once.
- **E-mails** (guest's language): e-ticket with QR code and calendar file, reminder the day before, the Captain's
  cancellation (full refund within 3 working days or another date), and the acknowledgement of an on-request
  enquiry; the owner gets new bookings and enquiries. They go through an outbox table and are retried if sending fails.
- **Admin**: departures with seats sold and left, passenger lists (print and CSV), cancel a departure for weather
  (bookings become `REFUND_DUE`, guests are e-mailed), mark refunded, move a booking to another date, prices, days,
  times, capacity, on/off, season, on-request inbox.
- **Public pages**: the booking widget (`src/components/cruises/CruiseBooking.tsx`), the day strip and the live
  days, times and fares (`WeekStrip`, `LiveCruise`) read `/api/cruises/schedule` and `/api/cruises/availability`
  through `src/lib/cruiseStore.ts`. The cruise pages and the home page are also rendered on the server with the
  schedule saved in `/admin` (`scheduleSeed`, revalidated every minute and right after a change in `/admin`), so the
  HTML and the JSON-LD carry the live fares. Without the database they show the static schedule in
  `src/data/cruises.ts` (seats then unknown; the server still checks them when the guest pays). The pay step
  creates the booking, sends the guest to the payment page and the bank returns them to the e-ticket page.
  The BBQ, private and wedding pages send their enquiry to `/api/cruises/requests`.

Locally nothing external is needed: without `DATABASE_URL` the data lives in PGlite under `.data/pglite`,
e-mails are written as HTML files to `.data/outbox` (the path is logged), and payments use the mock page.
To start from an empty database, stop the dev server and delete `.data`. The crons can be called by hand:
`curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3210/api/cron/reminders`.

## Going live

Set these in Vercel (Project → Settings → Environment Variables, Production). None of them is ever sent to the browser.

| Variable | What |
|---|---|
| `DATABASE_URL` | Postgres connection string: Neon or Vercel Postgres (use the pooled `-pooler` host, `sslmode=require`). Tables are created on the first request. |
| `APP_SECRET` | 32+ random characters (`openssl rand -hex 32`). Signs e-ticket links, payment hand-offs and admin sessions. Do not change it later: old e-ticket links would stop working. |
| `ADMIN_PASSWORD` | Password for `/admin`. Changing it signs everyone out. |
| `CRON_SECRET` | Random string; Vercel Cron sends it to `/api/cron/*` (crons are in `vercel.json`, daily, fine on the Hobby plan). |
| `NEXT_PUBLIC_SITE_URL` | The final domain, e.g. `https://www.example.gr` (links in e-mails, the bank's return address). |
| `ALPHA_MID` | Alpha Bank e-Commerce (Nexi) merchant ID for the cruise business. |
| `ALPHA_SHARED_SECRET` | The shared secret that goes with it (for the digest). |
| `ALPHA_ENV` | `test` while testing with the bank's test credentials, then `production`. (`ALPHA_GATEWAY_URL` overrides the address if Nexi gives another one.) |
| `RESEND_API_KEY` | E-mail sending with Resend (or instead `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, optional `SMTP_SECURE`). |
| `EMAIL_FROM` | Sender, on a domain verified with the e-mail provider, e.g. `Captain Vangelis <bookings@example.gr>`. |
| `OWNER_EMAIL` | Where new bookings and enquiries go (default `info@kefalonia-cruises.gr`). `EMAIL_REPLY_TO` sets the reply address (same default). |

Optional: `PAYMENT_PROVIDER=alpha` (otherwise chosen automatically when the Alpha credentials are set),
`ALPHA_REJECT_3DSU=N` (accept cards whose 3-D Secure check is "unavailable"; refused by default),
`TRUST_PROXY=1` only when the site runs behind a proxy other than Vercel that sets `X-Real-IP` / `X-Forwarded-For`
(rate limits then count per visitor; on Vercel this is automatic, and elsewhere all visitors share one counter).
Never set in production: `ALLOW_MOCK_PAYMENTS` (only for a preview deployment that should take test payments),
`ALLOW_PGLITE`. Without Alpha credentials, production refuses new bookings with a clear message instead of
taking fake payments.

With the bank (details in `../research/alpha-ecommerce.md`, sections 7, 8 and 10):
1. Ask Nexi which gateway the cruise merchant ID is on (this site implements the Alpha/Nexi e-Commerce redirect),
   for the test and production credentials, and to enable **background confirmation** to
   `https://<domain>/api/payments/alpha/return` (it is also the confirm and cancel address).
2. Run a test payment with `ALPHA_ENV=test`, then let the bank check the site (terms checkbox before paying,
   card logos, receipt: the e-ticket page and e-mail) before switching to `production`. The pay step lists the
   accepted cards as text; if the bank asks for its official logo images, add them there.
3. Refunds are made in the bank's back office; then press «Έγινε η επιστροφή» (refund done) on the booking in `/admin`.

