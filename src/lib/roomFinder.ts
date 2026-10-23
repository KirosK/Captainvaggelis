import { properties, unitGroups } from '@/data/properties'
import type { Audience, UnitGroup } from '@/data/types'

export type Priority = 'beach' | 'view' | 'quiet' | 'space' | 'value'
export type ReasonKey =
  | 'beachfront' | 'seaView' | 'quiet' | 'space' | 'twoBedrooms' | 'value' | 'kids' | 'terrace' | 'village' | 'cruise' | 'pool' | 'poolSeasonal' | 'budgetGroup'

export type Suggestion = { unit: UnitGroup; score: number; reasons: ReasonKey[] }

/** How a group splits into adults and children: families travel as one or two adults with the children; everyone else is an adult. */
export function partyFor(who: Audience, guests: number) {
  if (who !== 'family') return { adults: guests, children: 0 }
  const adults = guests >= 3 ? 2 : 1
  return { adults, children: Math.max(0, guests - adults) }
}

/** Scores every room type against who is travelling, what matters most and the group size. */
export function suggestRooms(who: Audience, priority: Priority, guests: number): Suggestion[] {
  const { adults } = partyFor(who, guests)
  // a room must take the whole group and its adults (the family studio is 2 adults + 2 children)
  const fits = unitGroups.filter((u) => u.maxGuests >= guests && u.maxAdults >= adults)
  const scored = fits.map((u) => {
    let score = 0
    const reasons: ReasonKey[] = []
    const isAeg = u.property === 'aegealis'
    if (u.audiences.includes(who)) score += 3
    switch (priority) {
      case 'beach':
        if (isAeg) score += 5
        break
      case 'view':
        if (u.seaView) score += 5
        if (u.features.includes('largeBalcony')) score += 1
        break
      case 'quiet':
        if (!isAeg) score += 5
        break
      case 'space':
        score += u.bedrooms * 3 + (u.maxGuests > guests ? 1 : 0)
        break
      case 'value':
        score += u.tier === 1 ? 5 : u.tier === 2 ? 2 : 0
        if (!isAeg) score += 1
        break
    }
    // prefer the room that fits the group snugly over a much bigger one
    score -= Math.max(0, u.maxGuests - guests) * 0.7
    if (who === 'family' && u.maxGuests >= 3) score += 1.5
    if (who === 'friends' && u.bedrooms > 0) score += 1

    if (isAeg) reasons.push('beachfront')
    if (u.seaView) reasons.push('seaView')
    if (!isAeg) reasons.push(priority === 'quiet' ? 'quiet' : 'village')
    if (u.bedrooms === 2) reasons.push('twoBedrooms')
    else if (u.bedrooms === 1) reasons.push('space')
    if (u.tier === 1) reasons.push('value')
    if (who === 'family' && u.maxGuests >= 3) reasons.push('kids')
    if (who === 'friends' && u.maxGuests >= 4 && !isAeg) reasons.push('budgetGroup')
    if (u.features.includes('terrace')) reasons.push('terrace')
    if (isAeg) reasons.push('cruise')
    // Aegealis guests use the pools on either side; Theodora's is the neighbouring hotel's, open with its season
    reasons.push(isAeg ? 'pool' : 'poolSeasonal')

    // keep the most relevant reason first
    const lead: Partial<Record<Priority, ReasonKey>> = { beach: 'beachfront', view: 'seaView', quiet: 'quiet', space: u.bedrooms === 2 ? 'twoBedrooms' : 'space', value: 'value' }
    const first = lead[priority]
    const ordered = first && reasons.includes(first) ? [first, ...reasons.filter((r) => r !== first)] : reasons
    return { unit: u, score, reasons: Array.from(new Set(ordered)).slice(0, 4) }
  })
  return scored.sort((a, b) => b.score - a.score)
}

export const propertyOf = (u: UnitGroup) => properties[u.property]
