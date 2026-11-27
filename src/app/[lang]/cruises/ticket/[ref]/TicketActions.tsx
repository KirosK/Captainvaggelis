'use client'

// Small client pieces of the e-ticket page: open a ticket with the booking e-mail, retry a payment, print.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Loader2, Lock, Printer } from 'lucide-react'
import { fill, type Dict } from '@/lib/i18n'

/** Error code from the API → sentence in payments.json → errors. */
function errorMessage(errors: Dict, body: { error?: string; status?: string; left?: number; total?: number } | null) {
  switch (body?.error) {
    case 'rate_limited':
      return errors.rateLimited
    case 'payments_unavailable':
      return errors.paymentsUnavailable
    case 'already_paid':
      return errors.alreadyPaid
    case 'not_payable':
      return errors.notPayable
    case 'not_enough_seats':
      return body.left === 1 ? errors.notEnoughSeatsOne : fill(errors.notEnoughSeats, { count: body.left ?? 0 })
    case 'departure_unavailable':
      return body.status === 'cancelled' ? errors.cancelled : body.status === 'soldout' ? errors.soldOut : body.status === 'closed' ? errors.closed : errors.unavailable
    default:
      return errors.generic
  }
}

export function RetryPayment({ bookingRef, token, label, errors, primary = true }: { bookingRef: string; token: string; label: string; errors: Dict; primary?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const retry = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/cruises/bookings/${bookingRef}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: token }) })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.payment?.redirectUrl) {
        window.location.assign(body.payment.redirectUrl)
        return
      }
      if (body?.error === 'already_paid') {
        window.location.reload()
        return
      }
      setError(errorMessage(errors, body))
    } catch {
      setError(errors.generic)
    }
    setBusy(false)
  }
  return (
    <div>
      <button type="button" onClick={retry} disabled={busy} className={`btn ${primary ? 'btn-sea' : 'btn-ghost'} w-full py-4 sm:w-auto`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} {label}
      </button>
      {error && (
        <p className="mt-3 rounded-xl bg-terra-light px-4 py-3 text-[0.9rem] font-medium text-terra-deep" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function TicketAccess({ bookingRef, t, errors }: { bookingRef: string; t: Dict; errors: Dict }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim())) {
      setError(t.invalid)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/cruises/tickets/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: bookingRef, email: email.trim() }) })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.token) {
        router.replace(`?k=${encodeURIComponent(body.token)}`)
        router.refresh()
        return
      }
      setError(res.status === 429 ? errors.rateLimited : res.status === 404 ? t.wrong : errors.generic)
    } catch {
      setError(errors.generic)
    }
    setBusy(false)
  }
  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-4 rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5 sm:p-8">
      <div>
        <label className="label" htmlFor="ticket-email">
          {t.email}
        </label>
        <input
          id="ticket-email"
          type="email"
          autoComplete="email"
          className={`field ${error ? 'ring-2 ring-terra' : ''}`}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError('')
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'ticket-email-err' : undefined}
        />
        {error && (
          <p id="ticket-email-err" className="mt-1 text-[0.85rem] text-terra-deep" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary w-full py-4">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} {t.submit} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  )
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ghost w-full">
      <Printer className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  )
}
