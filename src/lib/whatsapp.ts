import { site } from '@/data/site'
import { cruises } from '@/data/cruises'
import type { Locale } from './i18n'

type Ctx = 'home' | 'aegealis' | 'theodora' | 'cruises' | 'cruise' | 'charter' | 'guide' | 'faq' | 'contact' | 'default'
type CharterKind = 'bbq' | 'private' | 'wedding'

// Pre-filled first lines for WhatsApp, written so the guest only has to add their details.
const MESSAGES: Record<Locale, Record<Ctx, string>> = {
  en: {
    home: 'Hello! We are planning a stay in Skala and would like to ask about ',
    aegealis: 'Hello! I am interested in Aegealis Studios. Do you have availability from … to … for … guests?',
    theodora: 'Hello! I am interested in Theodora Studios & Apartments. Do you have availability from … to … for … guests?',
    cruises: 'Hello! I would like some information about your cruises: ',
    cruise: 'Hello! I would like to book the “{name}” cruise. Date: … Adults: … Children: …',
    charter: 'Hello! I would like to arrange a {kind} for … people. Date: …',
    guide: 'Hello! I am planning a trip to Skala and would love a tip about ',
    faq: 'Hello! I have a question that is not in your FAQ: ',
    contact: 'Hello! ',
    default: 'Hello! I would like to ask about ',
  },
  el: {
    home: 'Γεια σας! Σχεδιάζουμε διακοπές στη Σκάλα και θα θέλαμε να ρωτήσουμε για ',
    aegealis: 'Γεια σας! Ενδιαφέρομαι για το Aegealis Studios. Έχετε διαθεσιμότητα από … έως … για … άτομα;',
    theodora: 'Γεια σας! Ενδιαφέρομαι για το Theodora Studios & Apartments. Έχετε διαθεσιμότητα από … έως … για … άτομα;',
    cruises: 'Γεια σας! Θα ήθελα πληροφορίες για τις κρουαζιέρες σας: ',
    cruise: 'Γεια σας! Θα ήθελα να κλείσω την κρουαζιέρα «{name}». Ημερομηνία: … Ενήλικες: … Παιδιά: …',
    charter: 'Γεια σας! Θα ήθελα να κανονίσω {kind} για … άτομα. Ημερομηνία: …',
    guide: 'Γεια σας! Οργανώνω ταξίδι στη Σκάλα και θα ήθελα μια συμβουλή για ',
    faq: 'Γεια σας! Έχω μια ερώτηση που δεν βρήκα στις συχνές ερωτήσεις: ',
    contact: 'Γεια σας! ',
    default: 'Γεια σας! Θα ήθελα να ρωτήσω για ',
  },
  it: {
    home: 'Buongiorno! Stiamo organizzando una vacanza a Skala e vorremmo chiedere informazioni su ',
    aegealis: "Buongiorno! Vorrei informazioni sull'Aegealis Studios. Avete disponibilità dal … al … per … persone?",
    theodora: 'Buongiorno! Vorrei informazioni sul Theodora Studios & Apartments. Avete disponibilità dal … al … per … persone?',
    cruises: 'Buongiorno! Vorrei qualche informazione sulle vostre crociere: ',
    cruise: 'Buongiorno! Vorrei prenotare la crociera «{name}». Data: … Adulti: … Bambini: …',
    charter: 'Buongiorno! Vorrei organizzare {kind} per … persone. Data: …',
    guide: 'Buongiorno! Sto organizzando un viaggio a Skala e vorrei un consiglio su ',
    faq: 'Buongiorno! Ho una domanda che non ho trovato nelle FAQ: ',
    contact: 'Buongiorno! ',
    default: 'Buongiorno! Vorrei chiedere informazioni su ',
  },
}

// The cruises sailed on request only (no timetable, no seats): what the guest is asking to arrange, ready for {kind}.
const CHARTER: Record<Locale, Record<CharterKind, string>> = {
  en: { bbq: 'Mini Myrtos BBQ cruise', private: 'private cruise', wedding: 'wedding cruise' },
  el: { bbq: 'την κρουαζιέρα με μπάρμπεκιου στον Μίνι Μύρτο', private: 'μια ιδιωτική κρουαζιέρα', wedding: 'μια κρουαζιέρα γάμου' },
  it: { bbq: 'una crociera con barbecue a Mini Myrtos', private: 'una crociera privata', wedding: 'una crociera di nozze' },
}
const isCharter = (k: string): k is CharterKind => k === 'bbq' || k === 'private' || k === 'wedding'

/** Picks the right message for a path such as /el/cruises/ithaca-vathi-kioni. */
export function whatsappMessage(locale: Locale, pathname: string, cruiseNames?: Record<string, string>) {
  const parts = pathname.split('/').filter(Boolean).slice(1) // drop the locale
  const m = MESSAGES[locale]
  if (parts.length === 0) return m.home
  const [first, second] = parts
  if (first === 'aegealis' || first === 'theodora') return m[first]
  if (first === 'cruises' && second) {
    const c = cruises.find((x) => x.slug === second)
    // request-only cruises have no seats to book: ask to arrange one, for a group and a date
    if (c && !c.scheduled && isCharter(c.key)) return m.charter.replace('{kind}', CHARTER[locale][c.key])
    const name = c && cruiseNames?.[c.key]
    return name ? m.cruise.replace('{name}', name) : m.cruises
  }
  if (first === 'cruises') return m.cruises
  if (first === 'guide' || first === 'faq' || first === 'contact') return m[first]
  return m.default
}

export function whatsappHref(text: string) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`
}
