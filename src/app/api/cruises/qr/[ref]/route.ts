import { NextResponse } from 'next/server'
import { BOOKING_REF } from '@/server/crypto'
import { qrPng } from '@/server/email/qr'
import { HttpError, route } from '@/server/http/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** PNG QR code holding a booking reference (used as the image in e-mails). It reveals nothing but the reference itself. */
export const GET = route<{ params: { ref: string } }>('cruises.qr', async (_req, { params }) => {
  const ref = params.ref.replace(/\.png$/i, '').toUpperCase()
  if (!BOOKING_REF.test(ref)) throw new HttpError('not_found', 404)
  const png = await qrPng(ref)
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Robots-Tag': 'noindex' },
  })
})
