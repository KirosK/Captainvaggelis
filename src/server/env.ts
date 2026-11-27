// Server-only configuration. Every secret is read from the environment at call time and never sent to the browser
// (none of these names starts with NEXT_PUBLIC_). Development has safe defaults so the site runs with no setup;
// production refuses to run a feature whose secret is missing instead of falling back to a guessable value.

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** `next build` + `next start` and Vercel run with NODE_ENV=production; `next dev` does not. */
export const isProduction = () => process.env.NODE_ENV === 'production'

/** Folder for local data in development: the PGlite database, the e-mail outbox and the generated dev secret. */
export const dataDir = () => process.env.CV_DATA_DIR || path.join(process.cwd(), '.data')

/** The default admin password when ADMIN_PASSWORD is not set: development only (README → "Admin"). */
export const DEV_ADMIN_PASSWORD = 'captain-dev'
/** The default cron secret when CRON_SECRET is not set: development only. */
export const DEV_CRON_SECRET = 'dev-cron-secret'

export class ConfigError extends Error {
  constructor(public readonly setting: string) {
    super(`${setting} is not configured`)
  }
}

let devSecret: string | undefined
/**
 * Signs ticket links, payment hand-offs and admin sessions. Production needs APP_SECRET (32+ random characters);
 * development generates one once and keeps it in .data/dev-secret so links survive a restart.
 */
export function appSecret(): string {
  const s = process.env.APP_SECRET
  if (s && s.length >= 32) return s
  if (isProduction()) throw new ConfigError('APP_SECRET')
  if (devSecret) return devSecret
  const file = path.join(dataDir(), 'dev-secret')
  try {
    devSecret = readFileSync(file, 'utf8').trim()
  } catch {
    devSecret = randomBytes(32).toString('hex')
    try {
      mkdirSync(dataDir(), { recursive: true })
      writeFileSync(file, devSecret, { mode: 0o600 })
    } catch {}
  }
  return devSecret
}

/** The admin password, or null when the admin cannot be used (production without ADMIN_PASSWORD). */
export function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD
  if (p) return p
  return isProduction() ? null : DEV_ADMIN_PASSWORD
}

/** Bearer token Vercel Cron sends; null when cron routes must refuse every call. */
export function cronSecret(): string | null {
  const s = process.env.CRON_SECRET
  if (s) return s
  return isProduction() ? null : DEV_CRON_SECRET
}

/**
 * Absolute base URL for links in e-mails and for the bank's return addresses.
 * NEXT_PUBLIC_SITE_URL in production; in development the request's own origin, then localhost:3210.
 */
export function baseUrl(requestOrigin?: string | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (!isProduction() && requestOrigin) return requestOrigin.replace(/\/+$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT || 3210}`
}

/** Mock payments are allowed in development, and in production only when ALLOW_MOCK_PAYMENTS=1 (preview deployments). */
export const mockPaymentsAllowed = () => !isProduction() || process.env.ALLOW_MOCK_PAYMENTS === '1'

/** Where the owner receives new bookings and on-request enquiries. */
export const ownerEmail = () => process.env.OWNER_EMAIL || 'info@kefalonia-cruises.gr'
