import { cruises } from '@/data/cruises'
import { inventory, properties, unitsFor } from '@/data/properties'
import { ratings } from '@/data/reviews'
import { site } from '@/data/site'
import { bestLeg, pois } from '@/data/pois'
import { getDictionary, listFormat, weekdayName, type Locale } from './i18n'

/** Plain-language, fact-dense summary for AI assistants (llms.txt convention). Accommodation first. */
export async function buildLlmsText(locale: Locale = 'en', full = false) {
  const d = await getDictionary(locale)
  const u = (p: string) => `${site.url}/${locale}${p}`
  const L: string[] = []
  const total = inventory('aegealis').total + inventory('theodora').total

  L.push('# Aegealis Studios & Theodora Studios & Apartments — studios and apartments in Skala, Kefalonia, Greece')
  L.push('')
  L.push(`> Two family-run places to stay in Skala, on the south-east coast of Kefalonia: Aegealis Studios, directly opposite Skala beach, and Theodora Studios & Apartments, at the top of the village 100 m from the centre. ${total} units (rooms, studios and apartments) in total. Run by Captain Vangelis Spathis and his wife Frosso, whose day cruises have sailed from Skala since 1987. Guests get 20% off the scheduled cruises. Book direct with the family, with no booking fees.`)
  L.push('')
  L.push('## Key facts')
  L.push('- Location: Skala, Kefalonia, Ionian Islands, Greece, postcode 28086. Kefalonia airport (EFL) is about 33–35 km away.')
  L.push(`- Contact: phone/WhatsApp ${site.phones[0].display} (Captain Vangelis), ${site.phones[1].display}; e-mail ${site.email}.`)
  L.push('- Languages spoken: Greek, English, some Spanish. The website is in English, Greek and Italian.')
  L.push(`- Ratings: both properties score 9.1/10 on Booking.com (Aegealis ${ratings.aegealis.count} reviews, Theodora ${ratings.theodora.count} reviews), as of October 2026.`)
  L.push('')
  L.push('## Which one to choose')
  L.push('- Aegealis: across the road from the beach, garden with palms, use of the pools of the two hotels next door, free public parking nearby, the cruise boat leaves from in front. Studios are compact; the one-bedroom apartments sleep 4.')
  L.push('- Theodora: quiet house at the top of the village, 100 m from the centre and a 5–10 minute walk down to the beach (uphill on the way back), shady garden with sunbeds, gate to the neighbouring hotel\'s pool (subject to the hotel\'s season), two two-bedroom apartments for up to 5. No private parking; wired internet in common areas only.')
  L.push('')
  for (const p of ['aegealis', 'theodora'] as const) {
    const prop = properties[p]
    const r = ratings[p]
    const inv = inventory(p)
    L.push(`## ${prop.name}`)
    L.push(`- [${prop.name}](${u(`/${p}`)}): ${d.property[p].hero.subtitle}`)
    L.push(`- ${inv.total} units, ${inv.minSize}–${inv.maxSize} m², up to ${inv.maxGuests} guests per unit. Coordinates ${prop.geo.lat.toFixed(6)}, ${prop.geo.lng.toFixed(6)}. Licence (MHTE) ${prop.licence}.`)
    L.push(`- Guest scores (Booking.com, Oct 2026): ${r.score}/10 from ${r.count} reviews; location ${r.categories.location}, cleanliness ${r.categories.cleanliness}, staff ${r.categories.staff}.`)
    L.push(`- Check-in 14:00–00:00, check-out 08:00–10:00. ${d.property[p].policies.children} ${d.property[p].policies.extraBeds} ${d.property[p].policies.pets}`)
    L.push('- Room types:')
    for (const g of unitsFor(p)) L.push(`  - ${d.units[g.key].name} (${g.count} ${g.count === 1 ? 'unit' : 'units'}, ${g.size[0] === g.size[1] ? g.size[0] : `${g.size[0]}–${g.size[1]}`} m², up to ${g.maxGuests} guests): ${d.units[g.key].description}`)
    for (const x of d.property[p].goodToKnow as string[]) if (!/pin|map app/i.test(x)) L.push(`- Good to know: ${x}`)
    L.push(`- Listings: [Booking.com](${prop.bookingUrl})`)
    L.push(`- Other languages: [Ελληνικά](${site.url}/el/${p}), [Italiano](${site.url}/it/${p})`)
    L.push('')
  }

  L.push('## Captain Vangelis Special Cruises')
  L.push(`- [Cruises from Skala](${u('/cruises')}): daily cruises on NIRIIS (built 2017, 27.8 m, 200 passengers, stabilisers, water slide) from Skala beach, in front of Aegealis, at 09:00. On request, the Ithaca and Fiscardo cruises also pick up passengers at Poros, at the ferry quay, at 09:20; the stop lasts only a few minutes. The Zakynthos cruise leaves from Skala only.`)
  L.push('- Season: the times and prices below are the 2026 timetable; the 2027 dates are still to be confirmed.')
  for (const c of cruises) {
    const t = d.cruises.list[c.key]
    const when = c.weekdays.length ? listFormat(locale, c.weekdays.map((w) => weekdayName(locale, w))) : t.days
    const price = c.prices ? ` Adults €${c.prices.adult}, children (4–11) €${c.prices.child}.` : ''
    const time = c.depart ? ` Leaves Skala ${c.depart}, back about ${c.returnSkala}.` : ''
    L.push(`- [${t.name}](${u(`/cruises/${c.slug}`)}) — ${when}.${time}${price} ${t.summary}`)
  }
  L.push('- Zakynthos: the boat stays 40–50 m off Shipwreck (Navagio) beach for the view; landing and swimming there are not permitted. Not recommended for anyone prone to seasickness, small children, older guests, pregnant women or people with limited mobility.')
  L.push('- Rules: be at the boat 30 minutes early; second cruise 15% off; guests of Aegealis or Theodora 20% off the scheduled cruises; no refunds after departure; the Captain may change the route for safety.')
  L.push('')

  if (full) {
    L.push('## Walking and driving times from each property (by road)')
    for (const p of pois) {
      const a = bestLeg(p, 'aegealis')
      const t = bestLeg(p, 'theodora')
      L.push(`- ${p.nameEn}: from Aegealis ${a.min} min ${a.mode === 'walk' ? 'on foot' : 'by car'} (${a.m} m); from Theodora ${t.min} min ${t.mode === 'walk' ? 'on foot' : 'by car'} (${t.m} m).`)
    }
    L.push('')
    L.push('## Around Skala')
    for (const [, b] of Object.entries(d.guide.beaches.items as Record<string, { name: string; body: string }>)) L.push(`- ${b.name}: ${b.body}`)
    for (const [, x] of Object.entries(d.guide.todo.items as Record<string, { name: string; body: string }>)) L.push(`- ${x.name}: ${x.body}`)
    L.push('')
    L.push('## Frequently asked questions')
    for (const [g, grp] of Object.entries(d.faq.groups as Record<string, { items: Record<string, { q: string; a: string }> }>)) {
      if (g === 'booking') continue // direct-booking terms are still being finalised
      for (const it of Object.values(grp.items)) L.push(`- Q: ${it.q}\n  A: ${it.a}`)
    }
    L.push('')
  }

  L.push('## Pages')
  L.push(`- [Home](${u('')})`)
  L.push(`- [Aegealis Studios](${u('/aegealis')}) · [Theodora Studios & Apartments](${u('/theodora')})`)
  L.push(`- [Book direct](${u('/book')})`)
  L.push(`- [Skala & Kefalonia guide](${u('/guide')})`)
  L.push(`- [Questions](${u('/faq')}) · [Contact](${u('/contact')})`)
  L.push(`- Other languages: [Ελληνικά](${site.url}/el), [Italiano](${site.url}/it)`)
  if (!full) L.push(`- [Full version](${site.url}/llms-full.txt)`)
  return L.join('\n')
}
