// Mock payment provider for development and preview deployments: a page of this site, clearly marked as a test,
// that plays the bank. Its buttons post a signed result back exactly like the bank would, so the whole flow
// (hold → pay → signed return → paid → e-mail) is exercised without a card. Never enabled in production unless
// ALLOW_MOCK_PAYMENTS=1.

import { randomBytes } from 'node:crypto'
import { sign, verify } from '../crypto'
import type { PaymentProvider, VerifiedResult } from './types'

export const MOCK_STATUSES = ['CAPTURED', 'REFUSED', 'CANCELED'] as const
export type MockStatus = (typeof MOCK_STATUSES)[number]

export const mockStartToken = (orderId: string) => sign('mock-start', orderId).slice(0, 32)
export const checkMockStartToken = (orderId: string, t: string | null) => verify('mock-start', orderId, t, 32)

const payload = (f: { orderid: string; status: string; amount: string; currency: string }) => `${f.orderid}|${f.status}|${f.amount}|${f.currency}`

/** The hidden fields of one button on the test page, signed like a bank response. */
export function mockReturnFields(orderId: string, status: MockStatus, amountCents: number, currency: string) {
  const f = { orderid: orderId, status, amount: String(amountCents), currency }
  return { ...f, signature: sign('mock-return', payload(f)) }
}

export function verifyMockReturn(form: URLSearchParams): VerifiedResult | null {
  const f = { orderid: form.get('orderid') ?? '', status: form.get('status') ?? '', amount: form.get('amount') ?? '', currency: form.get('currency') ?? '' }
  if (!verify('mock-return', payload(f), form.get('signature'))) return null
  if (!/^CV[0-9A-Z]{6,48}$/.test(f.orderid) || !/^\d{1,9}$/.test(f.amount) || !(MOCK_STATUSES as readonly string[]).includes(f.status)) return null
  return {
    provider: 'mock',
    orderId: f.orderid,
    outcome: f.status === 'CAPTURED' ? 'paid' : f.status === 'CANCELED' ? 'cancelled' : 'failed',
    amountCents: Number(f.amount),
    currency: f.currency,
    txId: f.status === 'CAPTURED' ? `MOCK${randomBytes(5).toString('hex').toUpperCase()}` : null,
    providerStatus: f.status,
    message: 'mock payment',
  }
}

export const mockProvider: PaymentProvider = {
  id: 'mock',
  startUrl: (orderId) => `/api/payments/mock?o=${orderId}&t=${mockStartToken(orderId)}`,
}
