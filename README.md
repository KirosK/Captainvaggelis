# Captain Vangelis · Skala, Kefalonia (demo)

Website for Aegealis Studios, Theodora Studios & Apartments and Captain Vangelis Special Cruises.
Next.js 14 (App Router) + TypeScript + Tailwind, static pages in English, Greek and Italian.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3210
```

Admin (Greek): http://localhost:3210/admin (demo login, no password).

## What is real and what is demo

Real (taken from Booking.com, kefalonia-cruises.gr and guest reviews, see `../research/facts.md`):
room types, policies, distances, ratings, reviews, cruise days, times and prices (2026 season).

Demo only (not labelled on the site, at the owner's request):
- nightly room rates (`src/data/properties.ts` → `demoRates`)
- availability, seats sold, payments (nothing is charged)
- admin data lives in the visitor's browser (localStorage)

Before going live: connect the booking engine / channel manager (Vik), a payment provider
(Stripe or a Greek bank POS), a database for the cruise departures, and have the privacy and
terms texts reviewed. Open owner questions (discounts, kiosk payment, Theodora house rules,
larger original photos) are listed in `../research/facts.md`.

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
