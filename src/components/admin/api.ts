'use client'

// Typed calls to the admin API (src/app/api/admin/*, contract in src/server/README.md). The session is an httpOnly
// cookie set by POST /api/admin/login, so nothing secret lives in this code or in the browser's storage.
// Types are imported from the server modules with `import type`, which is erased from the client bundle.

import type { AdminBooking, AdminDeparture } from '@/server/cruises/admin'
import type { PickupTimes } from '@/server/cruises/catalog'
import type { DeliveryReport } from '@/server/email/outbox'

export type { AdminBooking, AdminDeparture, DeliveryReport }

export type Overview = {
  today: string
  refundDue: number
  attention: number
  newRequests: number
  pendingEmails: number
  failedEmails: number
  payments: 'mock' | 'alpha' | null
  email: 'file' | 'smtp' | 'resend' | null
}
export type CruiseSetting = {
  key: string
  weekdays: number[]
  depart: string
  returnSkala: string
  adult: number
  child: number
  capacity: number
  active: boolean
  times: PickupTimes
  updatedAt: string
}
export type Settings = { season: { start: string; end: string }; boatCapacity: number; holdMinutes: number; cutoffMinutes: number; cruises: CruiseSetting[] }
export type DepartureDetail = {
  departure: AdminDeparture | null
  times: PickupTimes | null
  passengers: AdminBooking[]
  totals: { paid: number; adults: number; children: number; infants: number; poros: number }
}
export type RequestStatus = 'new' | 'answered' | 'closed'
export type CruiseRequestRow = {
  ref: string
  cruise: string
  date: string | null
  people: number
  name: string
  email: string
  phone: string
  message: string | null
  lang: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
}
export type BookingStatus = AdminBooking['status']

/** An error answer from the API: `code` is the stable error code (`wrong_password`, `weekday_conflict`, …). */
export class AdminApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> | null,
  ) {
    super(code)
  }
}

let onUnauthorized: (() => void) | null = null
/** Called when any call answers 401 (the 12-hour session ran out): the app shows the login screen again. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch {
    throw new AdminApiError('network', 0, null)
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/admin/login') onUnauthorized?.()
    throw new AdminApiError(typeof data?.error === 'string' ? data.error : `http_${res.status}`, res.status, data)
  }
  return data as T
}

const dep = (cruise: string, date: string) => `/api/admin/departures/${encodeURIComponent(cruise)}/${encodeURIComponent(date)}`
const bk = (ref: string) => `/api/admin/bookings/${encodeURIComponent(ref)}`

export const adminApi = {
  session: () => call<{ authenticated: boolean; expiresAt: string | null }>('/api/admin/session'),
  login: (password: string) => call<{ ok: true }>('/api/admin/login', 'POST', { password }),
  logout: () => call<{ ok: true }>('/api/admin/logout', 'POST', {}),
  overview: () => call<Overview>('/api/admin/overview'),
  settings: () => call<Settings>('/api/admin/settings'),
  saveSeason: (season: { start: string; end: string }) => call<Settings>('/api/admin/settings', 'PATCH', { season }),
  saveCruise: (key: string, patch: Partial<Pick<CruiseSetting, 'weekdays' | 'depart' | 'returnSkala' | 'adult' | 'child' | 'capacity' | 'active'>>) =>
    call<Settings>(`/api/admin/settings/${encodeURIComponent(key)}`, 'PATCH', patch),
  departures: (from: string, to: string) => call<{ from: string; to: string; departures: AdminDeparture[] }>(`/api/admin/departures?from=${from}&to=${to}`),
  departure: (cruise: string, date: string) => call<DepartureDetail>(dep(cruise, date)),
  patchDeparture: (cruise: string, date: string, patch: { status?: 'open' | 'closed'; capacity?: number | null; note?: string | null }) => call<DepartureDetail>(dep(cruise, date), 'PATCH', patch),
  cancelDeparture: (cruise: string, date: string, reason: 'weather' | 'technical', note?: string) =>
    call<{ refundDue: string[]; released: number; emailsQueued: number; delivery: DeliveryReport }>(`${dep(cruise, date)}/cancel`, 'POST', { reason, note: note || null }),
  passengersUrl: (cruise: string, date: string, format: 'html' | 'csv') => `${dep(cruise, date)}/passengers?format=${format}`,
  // a POST, so the search text (names, e-mails, phones) is sent in the body and never appears in a URL or a request log
  bookings: (q: { q?: string; status?: BookingStatus; attention?: boolean }) =>
    call<{ bookings: AdminBooking[] }>('/api/admin/bookings/search', 'POST', { q: q.q || undefined, status: q.status, attention: q.attention || undefined, limit: 500 }),
  refunded: (ref: string, note?: string) => call<AdminBooking>(`${bk(ref)}/refunded`, 'POST', { note: note || null }),
  move: (ref: string, date: string) => call<{ booking: AdminBooking; delivery: DeliveryReport }>(`${bk(ref)}/move`, 'POST', { date }),
  resend: (ref: string) => call<Record<string, unknown>>(`${bk(ref)}/resend`, 'POST', {}),
  requests: () => call<{ requests: CruiseRequestRow[] }>('/api/admin/requests'),
  setRequest: (ref: string, status: RequestStatus) => call<{ request: CruiseRequestRow }>(`/api/admin/requests/${encodeURIComponent(ref)}`, 'PATCH', { status }),
  flush: () => call<DeliveryReport>('/api/admin/outbox/flush', 'POST', {}),
}

/** Sends the queued e-mails, a batch per call, until none are left (or `rounds` calls have been made). */
export async function flushOutbox(rounds = 10): Promise<DeliveryReport | null> {
  let last: DeliveryReport | null = null
  for (let i = 0; i < rounds; i++) {
    last = await adminApi.flush()
    if (!last.pending) break
  }
  return last
}
