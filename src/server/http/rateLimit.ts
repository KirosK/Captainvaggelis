// Fixed-window rate limits kept in the database, so they hold across serverless instances.
// Keys contain a keyed hash of the IP address, never the address.

import { sql } from 'drizzle-orm'
import { getDb, rowsOf } from '../db/client'
import { hashIp } from '../crypto'
import { clientIp, HttpError } from './respond'

export const LIMITS = {
  booking: { limit: 12, windowSec: 600 },
  pay: { limit: 12, windowSec: 600 },
  lookup: { limit: 10, windowSec: 900 },
  request: { limit: 6, windowSec: 600 },
  login: { limit: 6, windowSec: 900 },
} as const

const disabled = () => process.env.RATE_LIMIT_DISABLED === '1' && process.env.NODE_ENV !== 'production'

/** Counts one hit on `key` in a fixed window and returns the count so far and the seconds left in the window. */
async function hit(key: string, windowSec: number) {
  const db = await getDb()
  const res = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}::int) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSec}::int) THEN now() ELSE rate_limits.window_start END
    RETURNING count, extract(epoch from (window_start + make_interval(secs => ${windowSec}::int) - now()))::int AS retry_after`)
  const [row] = rowsOf<{ count: number | string; retry_after: number | string }>(res)
  return { count: +(row?.count ?? 0), retryAfter: Math.max(1, +(row?.retry_after ?? windowSec)) }
}

const tooMany = (retryAfter: number) => new HttpError('rate_limited', 429, { retryAfter }, { 'Retry-After': String(retryAfter) })

export async function rateLimit(bucket: keyof typeof LIMITS, req: Request) {
  if (disabled()) return
  const { limit, windowSec } = LIMITS[bucket]
  const { count, retryAfter } = await hit(`${bucket}:${hashIp(clientIp(req))}`, windowSec)
  if (count > limit) throw tooMany(retryAfter)
}

/**
 * Wrong admin passwords from every address together: after 30 in 15 minutes the login refuses everyone until the
 * window ends, so changing address (or a forged forwarding header) never buys unlimited guesses.
 */
const FAILED_LOGINS = { key: 'login_failed:all', limit: 30, windowSec: 900 }

/** Throws 429 while the shared failed-login window is full. Checked before the password. */
export async function assertLoginOpen() {
  if (disabled()) return
  const db = await getDb()
  const res = await db.execute(sql`
    SELECT count, extract(epoch from (window_start + make_interval(secs => ${FAILED_LOGINS.windowSec}::int) - now()))::int AS retry_after
    FROM rate_limits WHERE key = ${FAILED_LOGINS.key} AND window_start >= now() - make_interval(secs => ${FAILED_LOGINS.windowSec}::int)`)
  const [row] = rowsOf<{ count: number | string; retry_after: number | string }>(res)
  if (row && +row.count >= FAILED_LOGINS.limit) throw tooMany(Math.max(1, +row.retry_after))
}

/** Counts a wrong admin password in the shared window (after the per-address limit). */
export async function recordFailedLogin() {
  if (disabled()) return
  await hit(FAILED_LOGINS.key, FAILED_LOGINS.windowSec)
}

/** Old counters are useless after their window; the daily cron removes them. */
export async function pruneRateLimits() {
  const db = await getDb()
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`)
}
