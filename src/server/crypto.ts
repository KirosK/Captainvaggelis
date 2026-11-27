import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { appSecret } from './env'

/** Constant-time string comparison (different lengths compare as unequal without leaking where they differ). */
export function safeEqual(a: string, b: string) {
  const x = createHash('sha256').update(a, 'utf8').digest()
  const y = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(x, y) && a.length === b.length
}

/** HMAC-SHA256 of `data` under a key derived from APP_SECRET for one purpose, base64url. */
export function sign(purpose: string, data: string, key = appSecret()) {
  return createHmac('sha256', `${purpose}:${key}`).update(data, 'utf8').digest('base64url')
}

export function verify(purpose: string, data: string, signature: string | null | undefined, length?: number) {
  if (!signature) return false
  const expected = length ? sign(purpose, data).slice(0, length) : sign(purpose, data)
  return safeEqual(expected, signature)
}

/** Booking references: CV-7K2QXM (cruise bookings) and RQ-… (on-request enquiries). No 0/O or 1/I to misread. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeRef(prefix: 'CV' | 'RQ') {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `${prefix}-${s}`
}
export const BOOKING_REF = /^CV-[A-HJ-NP-Z2-9]{6}$/
export const REQUEST_REF = /^RQ-[A-HJ-NP-Z2-9]{6}$/

/**
 * The key in a ticket link (?k=…). Opening /{lang}/cruises/ticket/{ref} needs it, or the e-mail address the booking was made with.
 * It is not personal data, so it may appear in URLs; it only unlocks that one ticket.
 */
export const ticketToken = (ref: string) => sign('ticket', ref).slice(0, 32)
export const checkTicketToken = (ref: string, token: string | null | undefined) => verify('ticket', ref, token, 32)

/** Rate-limit keys store a keyed hash of the IP address, never the address itself. */
export const hashIp = (ip: string) => sign('ip', ip).slice(0, 24)

/** Payment order id for one payment attempt: letters and digits only (the bank's rule), 18 characters, starts with CV. */
export function makeOrderId(ref: string) {
  const body = ref.replace(/^CV-/, '')
  const time = Date.now().toString(36).toUpperCase().slice(-8)
  let rnd = ''
  for (let i = 0; i < 2; i++) rnd += ALPHABET[randomInt(ALPHABET.length)]
  return `CV${body}${time}${rnd}`
}
export const ORDER_ID = /^CV[0-9A-Z]{6,48}$/
