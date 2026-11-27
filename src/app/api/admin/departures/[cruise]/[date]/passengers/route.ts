import { NextResponse } from 'next/server'
import { departureDetail, passengersCsv, passengersHtml } from '@/server/cruises/admin'
import { isScheduledKey } from '@/server/cruises/catalog'
import { cruiseName } from '@/server/email/templates'
import { requireAdmin } from '@/server/http/adminAuth'
import { HttpError, json, route } from '@/server/http/respond'
import { isISODate } from '@/server/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Passenger list: ?format=json (default) | csv (download) | html (printable page). */
export const GET = route<{ params: { cruise: string; date: string } }>('admin.passengers', async (req, { params }) => {
  requireAdmin(req)
  if (!isScheduledKey(params.cruise) || !isISODate(params.date)) throw new HttpError('not_found', 404)
  const d = await departureDetail(params.cruise, params.date)
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (format === 'csv') {
    return new NextResponse(passengersCsv(d.passengers), {
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="passengers-${params.cruise}-${params.date}.csv"` },
    })
  }
  if (format === 'html') {
    return new NextResponse(passengersHtml(d, cruiseName('el', params.cruise)), {
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'" },
    })
  }
  return json(d)
})
