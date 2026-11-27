// E-mail templates in the guest's language (copy in src/content/{en,el,it}/payments.json → email).
// Table layout with inline styles, so they render in Gmail, Outlook and Apple Mail; every e-mail also has a
// plain-text part. Owner notifications are in Greek only, like the admin.

import enP from '@/content/en/payments.json'
import elP from '@/content/el/payments.json'
import itP from '@/content/it/payments.json'
import enC from '@/content/en/cruises.json'
import elC from '@/content/el/cruises.json'
import itC from '@/content/it/cruises.json'
import { site, whatsappLink } from '@/data/site'
import { fill, htmlLang, type Locale } from '@/lib/i18n'
import { attentionTexts } from '@/lib/attention'
import type { PickupTimes } from '../cruises/catalog'
import type { BookingRow, RequestRow } from '../db/schema'
import { toHHMM, toMinutes, utcDate } from '../time'
import { cruiseIcs } from './ics'
import type { EmailAttachment } from './providers'

const P = { en: enP, el: elP, it: itP }
const NAMES = { en: enC.list, el: elC.list, it: itC.list } as Record<Locale, Record<string, { name: string }>>
export type Copy = typeof enP
export const copyFor = (lang: string): Copy => P[(lang in P ? lang : 'en') as Locale] as Copy
export const cruiseName = (lang: string, key: string) => NAMES[(lang in NAMES ? lang : 'en') as Locale][key]?.name ?? key

const C = { ink: '#0F2430', soft: '#2A3F4B', mute: '#5B6B73', sea: '#17677A', sand: '#F5EFE5', paper: '#FBF8F2', line: '#E3DACB', terra: '#9C4529', terraLight: '#F3DDD2' }

export function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** "Wednesday 9 June 2027" (labels) or "9 June 2027" (inside sentences) in the guest's language. */
export function longDate(lang: string, iso: string, weekday = true, capitalise = true) {
  let s = new Intl.DateTimeFormat(htmlLang[(lang in htmlLang ? lang : 'en') as Locale], {
    weekday: weekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(iso))
  // Italian writes the first of the month as an ordinal: "1º giugno" ("del 1º giugno", "Il 1º giugno")
  if (lang === 'it') s = s.replace(/(^|\s)1 (?=[^\d\s])/, (_, before: string) => `${before}1º `)
  return capitalise ? s.charAt(0).toLocaleUpperCase(lang) + s.slice(1) : s
}

/**
 * The date as it follows a preposition, for the {onDate} placeholder of the Greek copy, which writes "σ{onDate}" and
 * "για {onDate}": Greek needs the article and, on the first of the month, the ordinal ("στις 23 Ιουνίου 2027",
 * "στην 1η Ιουνίου 2027"). English and Italian use the plain date, as {date} does.
 */
export function onDate(lang: string, iso: string) {
  const s = longDate(lang, iso, false)
  if (lang !== 'el') return s
  return /^1 /.test(s) ? `την 1η ${s.slice(2)}` : `τις ${s}`
}

/** {date} and {onDate} for the copy (see onDate). */
export const dateVars = (lang: string, iso: string) => ({ date: longDate(lang, iso, false), onDate: onDate(lang, iso) })

export function money(lang: string, cents: number) {
  return new Intl.NumberFormat(htmlLang[(lang in htmlLang ? lang : 'en') as Locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function passengerLine(lang: string, b: { adults: number; children: number; infants: number }) {
  const t = copyFor(lang).count
  const one = (n: number, s: string, p: string) => (n === 1 ? s : fill(p, { count: n }))
  return [one(b.adults, t.adult, t.adults), b.children ? one(b.children, t.child, t.children) : '', b.infants ? one(b.infants, t.infant, t.infants) : ''].filter(Boolean).join(' · ')
}

export const peopleText = (lang: string, n: number) => (n === 1 ? copyFor(lang).count.person : fill(copyFor(lang).count.people, { count: n }))

// ----- layout ----------------------------------------------------------------------------------------------

type Row = [label: string, value: string]

function rowsTable(rows: Row[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;line-height:1.5">${rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:9px 0;color:${C.mute};vertical-align:top;${i ? `border-top:1px solid ${C.line};` : ''}width:42%">${esc(k)}</td><td style="padding:9px 0;color:${C.ink};text-align:right;vertical-align:top;${i ? `border-top:1px solid ${C.line};` : ''}font-weight:600">${v}</td></tr>`,
    )
    .join('')}</table>`
}

const p = (html: string, extra = '') => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.soft};${extra}">${html}</p>`
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="border-radius:999px;background:${C.ink}"><a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`
const note = (html: string, tone: 'sea' | 'terra' = 'sea') =>
  `<div style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:${tone === 'sea' ? '#E8F2F2' : C.terraLight};color:${tone === 'sea' ? '#0C4655' : C.terra};font-size:14px;line-height:1.55">${html}</div>`

function layout(lang: string, o: { preheader: string; title: string; body: string }) {
  const t = copyFor(lang)
  const contact = `${esc(site.phones[0].display)} · <a href="mailto:${site.email}" style="color:${C.mute}">${site.email}</a>`
  return `<!doctype html>
<html lang="${htmlLang[(lang in htmlLang ? lang : 'en') as Locale]}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.sand};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sand}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 6px 16px;font-family:Georgia,'Times New Roman',serif;font-size:19px;color:${C.ink}">${esc(t.email.brand)} <span style="color:${C.mute};font-size:14px">· ${esc(t.email.place)}</span></td></tr>
<tr><td style="background:${C.paper};border-radius:22px;padding:30px 28px;border:1px solid ${C.line}">
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.2;color:${C.ink}">${esc(o.title)}</h1>
${o.body}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:${C.mute};text-align:center">${esc(t.email.footer)}<br>${contact}</td></tr>
</table></td></tr></table>
</body></html>`
}

const text = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join('\n\n') + '\n'

// ----- guest e-mails ---------------------------------------------------------------------------------------

export type BookingMail = {
  booking: BookingRow
  times: PickupTimes | null
  ticketUrl: string
  qrUrl: string
}

function boardingOf(m: BookingMail) {
  const b = m.booking
  const t = copyFor(b.lang)
  const poros = b.pickup === 'poros' && m.times?.poros
  const at = poros ? m.times!.poros! : m.times?.skala ?? { depart: '', back: '' }
  const place = poros ? t.places.poros : t.places.skala
  return { place, at, poros: !!poros }
}

function bookingRows(m: BookingMail, opts: { paid: boolean }): Row[] {
  const b = m.booking
  const t = copyFor(b.lang)
  const { place, at, poros } = boardingOf(m)
  const rows: Row[] = [
    [t.labels.cruise, esc(cruiseName(b.lang, b.cruise))],
    [t.labels.date, esc(longDate(b.lang, b.date))],
    [t.labels.boarding, `${esc(place)}, ${at.depart}${poros ? ` <span style="color:${C.mute};font-weight:400">(${esc(t.labels.onRequest)})</span>` : ''}`],
    [t.labels.return, esc(fill(t.labels.returnAround, { place, time: at.back }))],
    [t.labels.passengers, esc(passengerLine(b.lang, b))],
  ]
  if (b.discountKind !== 'none') rows.push([t.labels.discount[b.discountKind], `−${esc(money(b.lang, b.discountCents))}`])
  rows.push([opts.paid ? t.labels.paid : t.labels.total, esc(money(b.lang, b.amountCents))])
  rows.push([t.labels.reference, `<span style="font-family:Menlo,Consolas,monospace;letter-spacing:1px">${esc(b.ref)}</span>`])
  return rows
}

function ticketBlock(m: BookingMail) {
  const t = copyFor(m.booking.lang)
  // QR above the details (no side-by-side columns), so it also reads well on a phone
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#ffffff;border-radius:16px;border:1px solid ${C.line}">
<tr><td align="center" style="padding:20px 18px 6px"><img src="${esc(m.qrUrl)}" width="160" height="160" alt="${esc(fill(t.ticket.qrLabel, { ref: m.booking.ref }))}" style="display:block;border:0;width:160px;height:160px"><div style="margin-top:6px;font-family:Menlo,Consolas,monospace;font-size:17px;font-weight:700;letter-spacing:2px;color:${C.ink}">${esc(m.booking.ref)}</div></td></tr>
<tr><td style="padding:8px 20px 14px">${rowsTable(bookingRows(m, { paid: true }))}</td></tr></table>`
}

export function confirmationEmail(m: BookingMail): { subject: string; html: string; text: string; attachments: EmailAttachment[] } {
  const b = m.booking
  const t = copyFor(b.lang)
  const name = cruiseName(b.lang, b.cruise)
  const { place, at, poros } = boardingOf(m)
  const showText = poros ? fill(t.ticket.showPoros, { time: at.depart }) : t.ticket.show
  // a booking the Captain moved to another date (after a cancellation, or at the guest's request) says so first
  const moved = !!b.movedFrom && b.movedFrom !== b.date
  const intro = moved ? fill(t.email.confirmation.movedIntro, dateVars(b.lang, b.date)) : t.email.confirmation.intro
  const movedNote = moved ? fill(t.ticket.moved, { date: longDate(b.lang, b.movedFrom!) }) : ''
  const body = [
    p(esc(fill(t.email.greeting, { name: b.name }))),
    p(esc(intro)),
    ticketBlock(m),
    movedNote ? p(esc(movedNote), `font-size:14px;color:${C.mute}`) : '',
    note(esc(showText)),
    b.discountKind === 'guest20' ? p(esc(t.ticket.guestCheck)) : '',
    button(m.ticketUrl, t.email.viewTicket),
    p(esc(t.email.confirmation.calendar), `font-size:14px;color:${C.mute}`),
    `<h2 style="margin:22px 0 8px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:19px;color:${C.ink}">${esc(t.email.confirmation.termsTitle)}</h2>`,
    p(esc(t.email.confirmation.terms), 'font-size:14px'),
    p(`${esc(t.email.signOff)}<br><strong style="color:${C.ink}">${esc(t.email.signature)}</strong>`, 'margin-top:22px'),
  ].join('\n')
  const rowsText = bookingRows(m, { paid: true }).map(([k, v]) => `${k}: ${v.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&')}`)
  return {
    subject: fill(t.email.confirmation.subject, { cruise: name, date: longDate(b.lang, b.date, false) }),
    html: layout(b.lang, { preheader: fill(t.email.confirmation.preheader, { ref: b.ref, place, time: at.depart }), title: t.email.confirmation.title, body }),
    text: text(
      fill(t.email.greeting, { name: b.name }),
      intro,
      rowsText.join('\n'),
      movedNote,
      showText,
      b.discountKind === 'guest20' && t.ticket.guestCheck,
      `${t.email.viewTicket}: ${m.ticketUrl}`,
      `${t.email.confirmation.termsTitle}\n${t.email.confirmation.terms}`,
      `${t.email.signOff}\n${t.email.signature}`,
    ),
    attachments: [{ filename: `${b.ref}.ics`, content: Buffer.from(bookingIcs(m), 'utf8'), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
  }
}

export function bookingIcs(m: BookingMail) {
  const b = m.booking
  const t = copyFor(b.lang)
  const { place, at, poros } = boardingOf(m)
  return cruiseIcs({
    uid: `${b.ref}@captain-vangelis`,
    date: b.date,
    start: at.depart || '09:00',
    end: at.back || '17:45',
    summary: fill(t.ics.summary, { cruise: cruiseName(b.lang, b.cruise) }),
    location: poros ? t.places.porosFull : t.places.skalaFull,
    description: [`${t.labels.reference}: ${b.ref}`, passengerLine(b.lang, b), `${t.labels.boarding}: ${place}, ${at.depart}`, poros ? t.ics.porosNote : t.ics.checkIn, fill(t.ics.return, { place, time: at.back }), m.ticketUrl].join('\n'),
    url: m.ticketUrl,
  })
}

export function reminderEmail(m: BookingMail) {
  const b = m.booking
  const t = copyFor(b.lang)
  const name = cruiseName(b.lang, b.cruise)
  const { place, at, poros } = boardingOf(m)
  const checkIn = toHHMM(toMinutes(at.depart) - 30)
  const where = poros ? fill(t.email.reminder.poros, { checkIn, time: at.depart }) : fill(t.email.reminder.skala, { checkIn, time: at.depart })
  const body = [
    p(esc(fill(t.email.greeting, { name: b.name }))),
    p(esc(fill(t.email.reminder.intro, { date: longDate(b.lang, b.date, true, false) }))),
    note(esc(where)),
    ticketBlock(m),
    p(esc(fill(t.email.reminder.bring, { ref: b.ref }))),
    button(m.ticketUrl, t.email.viewTicket),
    p(esc(t.email.reminder.weather), 'font-size:14px'),
    p(`${esc(t.email.signOff)}<br><strong style="color:${C.ink}">${esc(t.email.signature)}</strong>`, 'margin-top:22px'),
  ].join('\n')
  return {
    subject: fill(t.email.reminder.subject, { cruise: name }),
    html: layout(b.lang, { preheader: fill(t.email.reminder.preheader, { place, time: at.depart }), title: t.email.reminder.title, body }),
    text: text(
      fill(t.email.greeting, { name: b.name }),
      fill(t.email.reminder.intro, { date: longDate(b.lang, b.date, true, false) }),
      where,
      fill(t.email.reminder.bring, { ref: b.ref }),
      `${t.email.viewTicket}: ${m.ticketUrl}`,
      t.email.reminder.weather,
      `${t.email.signOff}\n${t.email.signature}`,
    ),
  }
}

export function cancellationEmail(m: BookingMail) {
  const b = m.booking
  const t = copyFor(b.lang)
  const name = cruiseName(b.lang, b.cruise)
  const dates = dateVars(b.lang, b.date)
  const why = fill(b.cancelReason === 'technical' ? t.email.cancellation.technical : t.email.cancellation.weather, { cruise: name, ...dates })
  const refund = fill(t.email.cancellation.refund, { amount: money(b.lang, b.amountCents) })
  const wa = whatsappLink(`${b.ref}`)
  const body = [
    p(esc(fill(t.email.greeting, { name: b.name }))),
    p(esc(why)),
    note(esc(refund), 'terra'),
    p(esc(t.email.cancellation.rebook)),
    button(wa, t.email.whatsapp),
    rowsTable([
      [t.labels.reference, `<span style="font-family:Menlo,Consolas,monospace;letter-spacing:1px">${esc(b.ref)}</span>`],
      [t.labels.passengers, esc(passengerLine(b.lang, b))],
    ]),
    p(`${esc(t.email.signOffPlain)}<br><strong style="color:${C.ink}">${esc(t.email.signature)}</strong>`, 'margin-top:22px'),
  ].join('\n')
  return {
    subject: fill(t.email.cancellation.subject, dates),
    html: layout(b.lang, { preheader: t.email.cancellation.preheader, title: t.email.cancellation.title, body }),
    text: text(fill(t.email.greeting, { name: b.name }), why, refund, t.email.cancellation.rebook, `${t.email.whatsapp}: ${wa}`, `${t.labels.reference}: ${b.ref}`, `${t.email.signOffPlain}\n${t.email.signature}`),
  }
}

export function requestReceivedEmail(r: RequestRow) {
  const t = copyFor(r.lang)
  const kind = (t.kinds as Record<string, string>)[r.cruise] ?? t.kinds.private
  const people = peopleText(r.lang, r.people)
  const bodyText = r.date ? fill(t.email.request.body, { kind, ...dateVars(r.lang, r.date), people }) : fill(t.email.request.bodyNoDate, { kind, people })
  const wa = whatsappLink(r.ref)
  const body = [
    p(esc(fill(t.email.greeting, { name: r.name }))),
    p(esc(bodyText)),
    p(esc(t.email.request.reply)),
    rowsTable([[t.labels.requestReference, `<span style="font-family:Menlo,Consolas,monospace;letter-spacing:1px">${esc(r.ref)}</span>`]]),
    p(esc(t.email.request.add), 'margin-top:16px'),
    button(wa, t.email.whatsapp),
    p(`${esc(t.email.signOffPlain)}<br><strong style="color:${C.ink}">${esc(t.email.signature)}</strong>`, 'margin-top:22px'),
  ].join('\n')
  return {
    subject: fill(t.email.request.subject, { ref: r.ref }),
    html: layout(r.lang, { preheader: fill(t.email.request.preheader, { ref: r.ref, people }), title: t.email.request.title, body }),
    text: text(fill(t.email.greeting, { name: r.name }), bodyText, t.email.request.reply, `${t.labels.requestReference}: ${r.ref}`, t.email.request.add, `${t.email.whatsapp}: ${wa}`, `${t.email.signOffPlain}\n${t.email.signature}`),
  }
}

// ----- owner notifications (Greek) -------------------------------------------------------------------------

const LANG_EL: Record<string, string> = { en: 'Αγγλικά', el: 'Ελληνικά', it: 'Ιταλικά' }
const DISCOUNT_EL: Record<string, string> = { none: 'Καμία', guest20: 'Φιλοξενούμενοι 20%', second15: 'Δεύτερη κρουαζιέρα 15%' }
const KIND_EL: Record<string, string> = { bbq: 'Μπάρμπεκιου στον Μίνι Μύρτο', private: 'Ιδιωτική κρουαζιέρα', wedding: 'Κρουαζιέρα γάμου' }

export function ownerBookingEmail(m: BookingMail, adminUrl: string) {
  const b = m.booking
  const { place, at } = boardingOf({ ...m, booking: { ...b, lang: 'el' } })
  const rows: Row[] = [
    ['Κρουαζιέρα', esc(cruiseName('el', b.cruise))],
    ['Ημερομηνία', esc(longDate('el', b.date))],
    ['Επιβίβαση', `${esc(place)}, ${at.depart}${b.pickup === 'poros' ? ' (κατόπιν αιτήματος: επιβεβαιώστε στο WhatsApp)' : ''}`],
    ['Επιβάτες', esc(passengerLine('el', b))],
    ['Ποσό', esc(money('el', b.amountCents))],
    ['Έκπτωση', esc(DISCOUNT_EL[b.discountKind] ?? b.discountKind)],
    ['Όνομα', esc(b.name)],
    ['Τηλέφωνο', esc(b.phone)],
    ['E-mail', esc(b.email)],
    ['Πού μένει', esc(b.hotel ?? '—')],
    ['Σημειώσεις', esc(b.notes ?? '—')],
    ['Γλώσσα', esc(LANG_EL[b.lang] ?? b.lang)],
    ['Κωδικός', esc(b.ref)],
  ]
  // the warning codes in Greek, as the admin shows them (src/lib/attention.ts)
  const warnings = attentionTexts(b.attention)
  const body = [rowsTable(rows), warnings.length ? note(`<strong>Προσοχή:</strong> ${warnings.map(esc).join('<br>')}`, 'terra') : '', button(adminUrl, 'Άνοιγμα διαχείρισης')].join('\n')
  return {
    subject: `Νέα κράτηση ${b.ref}: ${cruiseName('el', b.cruise)}, ${longDate('el', b.date, false)}, ${passengerLine('el', b)}`,
    html: layout('el', { preheader: `${b.ref} · ${money('el', b.amountCents)}`, title: 'Νέα πληρωμένη κράτηση', body }),
    text: text(
      warnings.length > 0 && `Προσοχή: ${warnings.join(' ')}`,
      rows.map(([k, v]) => `${k}: ${v.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')}`).join('\n'),
      adminUrl,
    ),
  }
}

export function ownerRequestEmail(r: RequestRow, adminUrl: string) {
  const rows: Row[] = [
    ['Τι ζητά', esc(KIND_EL[r.cruise] ?? r.cruise)],
    ['Ημερομηνία', esc(r.date ? longDate('el', r.date) : '—')],
    ['Άτομα', String(r.people)],
    ['Όνομα', esc(r.name)],
    ['Τηλέφωνο', esc(r.phone)],
    ['E-mail', esc(r.email)],
    ['Μήνυμα', esc(r.message ?? '—').replace(/\n/g, '<br>')],
    ['Γλώσσα', esc(LANG_EL[r.lang] ?? r.lang)],
    ['Κωδικός', esc(r.ref)],
  ]
  return {
    subject: `Νέο αίτημα ${r.ref}: ${KIND_EL[r.cruise] ?? r.cruise}${r.date ? `, ${longDate('el', r.date, false)}` : ''}, ${r.people} άτομα`,
    html: layout('el', { preheader: `${r.ref} · ${r.people} άτομα`, title: 'Νέο αίτημα για κρουαζιέρα', body: [rowsTable(rows), button(adminUrl, 'Άνοιγμα διαχείρισης')].join('\n') }),
    text: text(rows.map(([k, v]) => `${k}: ${v.replace(/<br>/g, '\n').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')}`).join('\n'), adminUrl),
  }
}
