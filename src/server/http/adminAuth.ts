// Admin session: a signed, httpOnly, SameSite=Strict cookie (no session table). The signing key depends on
// APP_SECRET and on the admin password, so changing ADMIN_PASSWORD signs everyone out.

import { createHash } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { adminPassword, cronSecret, isProduction } from '../env'
import { safeEqual, sign, verify } from '../crypto'
import { HttpError } from './respond'

export const ADMIN_COOKIE = 'cv_admin'
const MAX_AGE = 12 * 60 * 60

function purpose() {
  const pw = adminPassword()
  if (!pw) throw new HttpError('admin_disabled', 503)
  return `admin-session:${createHash('sha256').update(pw, 'utf8').digest('hex').slice(0, 16)}`
}

export function checkAdminPassword(input: string) {
  const pw = adminPassword()
  if (!pw) throw new HttpError('admin_disabled', 503)
  return safeEqual(input, pw)
}

export function setAdminCookie(res: NextResponse) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  const payload = `v1.${exp}`
  res.cookies.set(ADMIN_COOKIE, `${payload}.${sign(purpose(), payload)}`, { httpOnly: true, secure: isProduction(), sameSite: 'strict', path: '/', maxAge: MAX_AGE })
  return exp
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: isProduction(), sameSite: 'strict', path: '/', maxAge: 0 })
}

/** Seconds since epoch when the session ends, or null when there is no valid session. */
export function adminSession(req: NextRequest): number | null {
  const value = req.cookies.get(ADMIN_COOKIE)?.value
  if (!value || !adminPassword()) return null
  const m = /^(v1\.(\d{10}))\.([\w-]+)$/.exec(value)
  if (!m) return null
  const exp = Number(m[2])
  if (exp * 1000 < Date.now()) return null
  return verify(purpose(), m[1], m[3]) ? exp : null
}

export function requireAdmin(req: NextRequest) {
  if (!adminSession(req)) throw new HttpError('unauthorized', 401)
}

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export function requireCron(req: NextRequest) {
  const secret = cronSecret()
  if (!secret) throw new HttpError('cron_disabled', 503)
  const auth = req.headers.get('authorization') ?? ''
  if (!safeEqual(auth, `Bearer ${secret}`)) throw new HttpError('unauthorized', 401)
}
