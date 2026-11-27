export type ProviderId = 'mock' | 'alpha'

/** A payment result whose signature the provider has already checked. Only these may change a booking. */
export type VerifiedResult = {
  provider: ProviderId
  orderId: string
  outcome: 'paid' | 'failed' | 'cancelled'
  /** amount and currency the gateway reports, compared with what we stored before a booking is marked paid */
  amountCents: number | null
  currency: string | null
  txId?: string | null
  /** the gateway's own status word (CAPTURED, REFUSED, …) */
  providerStatus: string
  message?: string | null
}

export interface PaymentProvider {
  id: ProviderId
  /**
   * Where to send the guest's browser to pay for one attempt (`orderId`). It is always a page of this site
   * (/api/payments/…), which then shows the test page (mock) or posts the signed form to the bank (alpha),
   * so the browser never sees a secret and the UI only needs `window.location.assign(redirectUrl)`.
   */
  startUrl(orderId: string): string
}
