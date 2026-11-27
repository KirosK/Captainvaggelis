// Alpha Bank e-Commerce (now "Nexi e-Commerce", run on Cardlink's Modirum VPOS): redirect model with a SHA-256 digest.
// Implemented from research/alpha-ecommerce.md (sections 3.1 to 3.6). Enabled only when ALPHA_MID and
// ALPHA_SHARED_SECRET are set; nothing here is ever called without them.
//
// Flow: our page /api/payments/alpha/start posts a signed form to the bank → the guest pays on the bank's page →
// the bank posts the result back to /api/payments/alpha/return (browser, and optionally a background copy) →
// we check the digest, the merchant id, the order id format and the stored amount, then mark the booking paid once.

import { createHash } from 'node:crypto'
import { safeEqual, sign, verify } from '../crypto'
import type { PaymentProvider, VerifiedResult } from './types'

export const ALPHA_GATEWAYS = {
  test: 'https://alphaecommerce-test.cardlink.gr/vpos/shophandlermpi',
  production: 'https://www.alphaecommerce.gr/vpos/shophandlermpi',
} as const

export type AlphaConfig = { mid: string; secret: string; gatewayUrl: string; reject3dsU: boolean }

/** Read from the environment; null when the bank's credentials are not set. */
export function alphaConfig(): AlphaConfig | null {
  const mid = process.env.ALPHA_MID?.trim()
  const secret = process.env.ALPHA_SHARED_SECRET
  if (!mid || !secret) return null
  const env = process.env.ALPHA_ENV === 'production' ? 'production' : 'test'
  return {
    mid,
    secret,
    gatewayUrl: process.env.ALPHA_GATEWAY_URL || ALPHA_GATEWAYS[env],
    // refuse payments whose 3-D Secure result is "unavailable" (no liability shift) unless ALPHA_REJECT_3DSU=N
    reject3dsU: process.env.ALPHA_REJECT_3DSU !== 'N',
  }
}

/** Field order of the request digest (research §3.3 / §3.4). Fields not sent add nothing. */
export const REQUEST_ORDER = [
  'version', 'mid', 'lang', 'deviceCategory', 'orderid', 'orderDesc', 'orderAmount', 'currency',
  'payerEmail', 'payerPhone', 'billCountry', 'billState', 'billZip', 'billCity', 'billAddress', 'weight', 'dimensions',
  'shipCountry', 'shipState', 'shipZip', 'shipCity', 'shipAddress', 'addFraudScore', 'maxPayRetries', 'reject3dsU',
  'payMethod', 'trType', 'extInstallmentoffset', 'extInstallmentperiod', 'extRecurringfrequency', 'extRecurringenddate',
  'blockScore', 'cssUrl', 'confirmUrl', 'cancelUrl', 'var1', 'var2', 'var3', 'var4', 'var5', 'var6', 'var7', 'var8', 'var9',
] as const

/** Field order of the response digest (research §3.5). */
export const RESPONSE_ORDER = ['version', 'mid', 'orderid', 'status', 'orderAmount', 'currency', 'paymentTotal', 'message', 'riskScore', 'payMethod', 'txId', 'paymentRef', 'extData'] as const

/** Base64(SHA-256(UTF-8(value1 + value2 + … + secret))) over the raw values, in order, with no separator. */
export function alphaDigest(fields: Record<string, string | undefined>, order: readonly string[], secret: string) {
  const s = order.map((k) => fields[k] ?? '').join('') + secret
  return createHash('sha256').update(s, 'utf8').digest('base64')
}

/** "110.00": a dot, two decimals, no thousands separator. */
export const alphaAmount = (cents: number) => (cents / 100).toFixed(2)

/** "+30 697 269 3260" → "30-6972693260" (only Greek numbers, whose country code length we know; others are left out). */
export function alphaPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^00/, '+')
  const m = /^\+30(\d{10})$/.exec(digits)
  return m ? `30-${m[1]}` : undefined
}

/** Removes characters the bank's free-text fields reject and keeps within the length limit. */
const plain = (s: string, max: number) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

export type AlphaOrder = {
  orderId: string
  amountCents: number
  currency: string
  lang: 'en' | 'el' | 'it'
  description: string
  email: string
  phone: string
  returnUrl: string
}

/** The form fields to post to the bank, with the digest (computed on the server only). */
export function alphaRequestFields(cfg: AlphaConfig, o: AlphaOrder): [string, string][] {
  const fields: Record<string, string | undefined> = {
    version: '2',
    mid: cfg.mid,
    lang: o.lang,
    deviceCategory: '0',
    orderid: o.orderId,
    orderDesc: plain(o.description, 128),
    orderAmount: alphaAmount(o.amountCents),
    currency: o.currency,
    payerEmail: o.email.trim().slice(0, 64),
    payerPhone: alphaPhone(o.phone),
    reject3dsU: cfg.reject3dsU ? 'Y' : undefined,
    trType: '1',
    confirmUrl: o.returnUrl,
    cancelUrl: o.returnUrl,
  }
  const sent = REQUEST_ORDER.filter((k) => fields[k] !== undefined && fields[k] !== '')
  const values = Object.fromEntries(sent.map((k) => [k, fields[k]!]))
  return [...sent.map((k) => [k, values[k]] as [string, string]), ['digest', alphaDigest(values, REQUEST_ORDER, cfg.secret)]]
}

export type AlphaCheck =
  | { ok: true; result: VerifiedResult }
  | { ok: false; reason: 'not_configured' | 'bad_digest' | 'wrong_mid' | 'bad_order_id' | 'bad_amount'; orderId?: string }

/**
 * Verifies a response posted by the bank (research §3.5, steps 1 to 3). `form` must hold the raw posted values.
 * Step 3's amount check against the stored booking, and step 4's idempotency, happen in applyPaymentResult.
 */
export function verifyAlphaResponse(form: URLSearchParams, cfg = alphaConfig()): AlphaCheck {
  if (!cfg) return { ok: false, reason: 'not_configured' }
  const fields: Record<string, string | undefined> = {}
  for (const k of RESPONSE_ORDER) {
    const v = form.get(k)
    if (v !== null) fields[k] = v
  }
  const orderId = fields.orderid
  const expected = alphaDigest(fields, RESPONSE_ORDER, cfg.secret)
  if (!safeEqual(expected, form.get('digest') ?? '')) return { ok: false, reason: 'bad_digest', orderId }
  // pin the merchant id and a strict order id, so values cannot slide between adjacent fields (research §3.5)
  if (fields.mid !== cfg.mid) return { ok: false, reason: 'wrong_mid', orderId }
  if (!orderId || !/^CV[0-9A-Z]{6,48}$/.test(orderId)) return { ok: false, reason: 'bad_order_id', orderId }
  const amount = fields.orderAmount ?? ''
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) return { ok: false, reason: 'bad_amount', orderId }
  const status = (fields.status ?? '').toUpperCase()
  const outcome = status === 'CAPTURED' || status === 'AUTHORIZED' ? 'paid' : status === 'CANCELED' ? 'cancelled' : 'failed'
  return {
    ok: true,
    result: {
      provider: 'alpha',
      orderId,
      outcome,
      amountCents: Math.round(Number(amount) * 100),
      currency: fields.currency ?? null,
      txId: fields.txId ?? null,
      providerStatus: status || 'UNKNOWN',
      message: fields.message?.slice(0, 200) ?? null,
    },
  }
}

/** The link to our own hand-off page for one attempt; `t` stops anyone else from opening it (it shows the payer's e-mail). */
export const alphaStartToken = (orderId: string) => sign('alpha-start', orderId).slice(0, 32)
export const checkAlphaStartToken = (orderId: string, t: string | null) => verify('alpha-start', orderId, t, 32)

export const alphaProvider: PaymentProvider = {
  id: 'alpha',
  startUrl: (orderId) => `/api/payments/alpha/start?o=${orderId}&t=${alphaStartToken(orderId)}`,
}
