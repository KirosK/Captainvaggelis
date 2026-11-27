// Picks the payment provider. PAYMENT_PROVIDER=alpha|mock forces one; otherwise Alpha Bank when its credentials
// are set, else the mock (development and previews only). Production with neither refuses new bookings.

import { ConfigError, mockPaymentsAllowed } from '../env'
import { alphaConfig, alphaProvider } from './alpha'
import { mockProvider } from './mock'
import type { PaymentProvider, ProviderId } from './types'

export class PaymentsUnavailable extends ConfigError {}

export function configuredProvider(): ProviderId | null {
  const forced = process.env.PAYMENT_PROVIDER
  if (forced === 'alpha') return alphaConfig() ? 'alpha' : null
  if (forced === 'mock') return mockPaymentsAllowed() ? 'mock' : null
  if (alphaConfig()) return 'alpha'
  return mockPaymentsAllowed() ? 'mock' : null
}

export function getPaymentProvider(): PaymentProvider {
  const id = configuredProvider()
  if (id === 'alpha') return alphaProvider
  if (id === 'mock') return mockProvider
  throw new PaymentsUnavailable('ALPHA_MID / ALPHA_SHARED_SECRET')
}

export type { PaymentProvider, ProviderId, VerifiedResult } from './types'
