// Price of a cruise booking. Pure functions with no server imports, so a client component may import this file
// to show exactly the total the server will charge.
//
// Rules (facts.md): adults pay the adult fare, children 4–11 the child fare, infants under 4 travel free.
// Discounts are not combined: a guest of Aegealis or Theodora gets 20%, a second cruise 15%, and when both are
// ticked the larger (20%) applies. Like the booking form, the discount is rounded to whole euros.

export type DiscountKind = 'none' | 'guest20' | 'second15'

const PERCENT: Record<DiscountKind, number> = { none: 0, guest20: 20, second15: 15 }

/** The larger discount when both boxes are ticked. */
export const discountKindOf = (guest: boolean, second: boolean): DiscountKind => (guest ? 'guest20' : second ? 'second15' : 'none')

export function quoteCents(fares: { adultCents: number; childCents: number }, party: { adults: number; children: number }, kind: DiscountKind) {
  const subtotalCents = party.adults * fares.adultCents + party.children * fares.childCents
  // integer maths: subtotal × percent / 100, rounded to whole euros (Math.round(24.75) = 25)
  const discountCents = Math.round((subtotalCents * PERCENT[kind]) / 10000) * 100
  return { subtotalCents, discountCents, amountCents: subtotalCents - discountCents, percent: PERCENT[kind] }
}

/** The same quote in euros, from fares in euros (as /api/cruises/schedule returns them). */
export function quoteEuros(fares: { adult: number; child: number }, party: { adults: number; children: number }, guest: boolean, second: boolean) {
  const q = quoteCents({ adultCents: Math.round(fares.adult * 100), childCents: Math.round(fares.child * 100) }, party, discountKindOf(guest, second))
  return { subtotal: q.subtotalCents / 100, discount: q.discountCents / 100, total: q.amountCents / 100, percent: q.percent }
}
