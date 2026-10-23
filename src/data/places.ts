import type { Locale } from '@/lib/i18n'

/** Short names of cruise stops, used on maps, timelines and structured data. */
const places: Record<string, Record<Locale, string>> = {
  skala: { en: 'Skala', el: 'Σκάλα', it: 'Skala' },
  poros: { en: 'Poros', el: 'Πόρος', it: 'Poros' },
  gidaki: { en: 'Gidaki beach', el: 'Παραλία Γιδάκι', it: 'Spiaggia di Gidaki' },
  vathi: { en: 'Vathi', el: 'Βαθύ', it: 'Vathy' },
  kioni: { en: 'Kioni', el: 'Κιόνι', it: 'Kioni' },
  aiGianni: { en: 'Cape Ai Gianni', el: 'Ακρωτήριο Άη Γιάννη', it: 'Capo Ai Gianni' },
  miniMyrtos: { en: 'Mini Myrtos', el: 'Μίνι Μύρτος', it: 'Mini Myrtos' },
  koutsoupia: { en: 'Koutsoupia (Mini Myrtos)', el: 'Κουτσουπιά (Μίνι Μύρτος)', it: 'Koutsoupia (Mini Myrtos)' },
  makriaPetra: { en: 'Makria Petra', el: 'Μακριά Πέτρα', it: 'Makria Petra' },
  antisamos: { en: 'Antisamos', el: 'Αντίσαμος', it: 'Antisamos' },
  sami: { en: 'Sami', el: 'Σάμη', it: 'Sami' },
  gorgotas: { en: 'Gorgotas bay', el: 'Όρμος Γοργότα', it: 'Baia di Gorgotas' },
  fiscardo: { en: 'Fiscardo', el: 'Φισκάρδο', it: 'Fiscardo' },
  skinari: { en: 'Cape Skinari', el: 'Ακρωτήριο Σκινάρι', it: 'Capo Skinari' },
  shipwreck: { en: 'Shipwreck (Navagio)', el: 'Ναυάγιο', it: 'Navagio' },
  blueCaves: { en: 'Blue Caves', el: 'Γαλάζιες Σπηλιές', it: 'Grotte Blu' },
  alykes: { en: 'Alykes', el: 'Αλυκές', it: 'Alykes' },
  return: { en: 'Back in Skala', el: 'Επιστροφή στη Σκάλα', it: 'Rientro a Skala' },
  // islands, drawn as quiet labels on the route maps (the base map itself has no labels)
  kefalonia: { en: 'Kefalonia', el: 'Κεφαλονιά', it: 'Cefalonia' },
  ithaca: { en: 'Ithaca', el: 'Ιθάκη', it: 'Itaca' },
  zakynthos: { en: 'Zakynthos', el: 'Ζάκυνθος', it: 'Zante' },
}

/** Where the island names sit on the route maps (over land, clear of the routes). */
export const islandLabels: { key: string; geo: [number, number] }[] = [
  { key: 'kefalonia', geo: [38.2, 20.62] },
  { key: 'ithaca', geo: [38.42, 20.66] },
  { key: 'zakynthos', geo: [37.78, 20.79] },
]

export function placeNames(locale: Locale) {
  return Object.fromEntries(Object.entries(places).map(([k, v]) => [k, v[locale]]))
}
