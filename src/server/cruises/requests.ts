// Enquiries for the cruises that only run on request (BBQ, private, wedding): stored for the admin inbox,
// acknowledged to the guest by e-mail and forwarded to the owner.

import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { cruiseRequests, type Lang, type RequestRow, type RequestStatus } from '../db/schema'
import { deliverOutbox, enqueueEmail } from '../email/outbox'
import { makeRef } from '../crypto'
import { log } from '../log'
import type { OnRequestKey } from './catalog'

export type CreateRequestInput = {
  cruise: OnRequestKey
  date?: string | null
  people: number
  name: string
  email: string
  phone: string
  message?: string | null
  lang: Lang
}

export async function createRequest(input: CreateRequestInput): Promise<RequestRow> {
  const db = await getDb()
  const row = await db.transaction(async (tx) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const [r] = await tx
        .insert(cruiseRequests)
        .values({ ref: makeRef('RQ'), cruise: input.cruise, date: input.date || null, people: input.people, name: input.name, email: input.email, phone: input.phone, message: input.message || null, lang: input.lang, status: 'new' })
        .onConflictDoNothing({ target: cruiseRequests.ref })
        .returning()
      if (r) {
        await enqueueEmail(tx, { kind: 'request_received', entityRef: r.ref, dedupeKey: `request_received:${r.ref}` })
        await enqueueEmail(tx, { kind: 'owner_request', entityRef: r.ref, dedupeKey: `owner_request:${r.ref}` })
        return r
      }
    }
    throw new Error('could not allocate a request reference')
  })
  log.info('request.created', { ref: row.ref, cruise: row.cruise })
  await deliverOutbox({ budgetMs: 6000 })
  return row
}

export async function listRequests(status?: RequestStatus) {
  const db = await getDb()
  return db
    .select()
    .from(cruiseRequests)
    .where(status ? eq(cruiseRequests.status, status) : undefined)
    .orderBy(desc(cruiseRequests.createdAt))
    .limit(500)
}

export async function setRequestStatus(ref: string, status: RequestStatus) {
  const db = await getDb()
  const [r] = await db
    .update(cruiseRequests)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(cruiseRequests.ref, ref)))
    .returning()
  return r ?? null
}
