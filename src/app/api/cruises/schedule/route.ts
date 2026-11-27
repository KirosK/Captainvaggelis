import { getSchedule } from '@/server/cruises/schedule'
import { json, route } from '@/server/http/respond'
import { configuredProvider } from '@/server/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Live schedule and fares of the scheduled cruises (what /admin last saved), plus which payment page the booking form
 * will open (`payments`: 'mock' for the test page, 'alpha' for Alpha Bank, null when online payment is off), so the
 * form can say "test mode" or offer another way to book before the guest presses pay.
 */
export const GET = route('cruises.schedule', async () =>
  json({ ...(await getSchedule()), payments: configuredProvider() }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' } }),
)
