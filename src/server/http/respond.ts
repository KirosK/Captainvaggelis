// Shared helpers for the API route handlers: JSON in and out, zod validation, error mapping, origin checks.

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { ConfigError } from '../env'
import { errorText, log } from '../log'
import { BookingError } from '../cruises/bookings'
import { PaymentsUnavailable } from '../payments'

export class HttpError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly extra?: Record<string, unknown>,
    public readonly headers?: Record<string, string>,
  ) {
    super(code)
  }
}

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, { status: init.status ?? 200, headers: { 'Cache-Control': 'no-store', ...init.headers } })
}

const MAX_BODY = 32 * 1024

/** Reads and validates a JSON body. Only application/json is accepted, which a cross-site HTML form cannot send. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new HttpError('unsupported_media_type', 415)
  const raw = await req.text()
  if (raw.length > MAX_BODY) throw new HttpError('payload_too_large', 413)
  let body: unknown
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    throw new HttpError('invalid_json', 400)
  }
  return schema.parse(body)
}

/** Validates query-string parameters. */
export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()))
}

/**
 * Requests that change data must come from this site: a browser always sends Origin on a POST/PATCH,
 * and it must match the host the request was sent to. (Requests without Origin, such as curl, pass.)
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {}
  if (!host || originHost !== host) throw new HttpError('forbidden_origin', 403)
}

/**
 * The visitor's IP address, for rate limiting only. Anyone can send X-Real-IP or X-Forwarded-For, so they are read
 * only where a known proxy sets them: on Vercel (which overwrites both) or behind a proxy declared with TRUST_PROXY=1.
 * Anywhere else every visitor shares one key, so a forged header cannot buy extra attempts.
 */
export function clientIp(req: Request) {
  if (!process.env.VERCEL && process.env.TRUST_PROXY !== '1') return 'direct'
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>

/** Wraps a route handler: known errors become JSON with a stable `error` code; anything else is logged and answered 500. */
export function route<C = unknown>(name: string, fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, { status: e.status, headers: e.headers })
      if (e instanceof BookingError) return json({ error: e.code, ...e.extra }, { status: e.status })
      if (e instanceof ZodError) {
        // field paths only, never the submitted values
        const fields = [...new Set(e.issues.map((i) => i.path.join('.') || '(body)'))]
        return json({ error: 'validation', fields }, { status: 400 })
      }
      if (e instanceof PaymentsUnavailable) {
        log.error('payments.unavailable', { route: name })
        return json({ error: 'payments_unavailable' }, { status: 503 })
      }
      if (e instanceof ConfigError) {
        log.error('config.missing', { route: name, setting: e.setting })
        return json({ error: 'not_configured' }, { status: 503 })
      }
      log.error('route.failed', { route: name, error: errorText(e) })
      return json({ error: 'server_error' }, { status: 500 })
    }
  }
}
