// zod schemas for every API input. Free text is trimmed and length-limited; control characters are refused
// in single-line fields. The e-mail and phone rules match the booking form (src/lib/cruiseStore.ts).

import { z } from 'zod'
import { BOAT_CAPACITY, ON_REQUEST_KEYS, SCHEDULED_KEYS } from '../cruises/catalog'
import { isHHMM, isISODate } from '../time'

const CONTROL = /[\u0000-\u001f\u007f]/

export const langSchema = z.enum(['en', 'el', 'it'])
export const isoDate = z.string().refine(isISODate, 'date must be YYYY-MM-DD')
export const hhmm = z.string().refine(isHHMM, 'time must be HH:MM')
export const scheduledKey = z.enum(SCHEDULED_KEYS)
export const onRequestKey = z.enum(ON_REQUEST_KEYS)

const line = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !CONTROL.test(s), 'no control characters')
const optional = (max: number, multiline = false) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => multiline || !CONTROL.test(s), 'no control characters')
    .optional()
    .nullable()
    .transform((s) => (s ? s : null))

export const nameSchema = line(2, 120)
export const emailSchema = line(5, 160).refine((s) => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(s), 'invalid e-mail')
export const phoneSchema = line(8, 40).refine((s) => /^(\+|00)[\d\s()-]{8,}$/.test(s) && s.replace(/\D/g, '').length >= 8 && s.replace(/\D/g, '').length <= 17, 'invalid phone')

/**
 * One online booking takes at most what the booking widget offers (20 adults, 10 children, 4 infants: 34 seats), so
 * nobody can hold a large share of a sailing without paying; bigger groups contact the family.
 */
export const ONLINE_MAX = { adults: 20, children: 10, infants: 4 } as const

export const createBookingSchema = z
  .object({
    cruise: scheduledKey,
    date: isoDate,
    adults: z.number().int().min(1).max(ONLINE_MAX.adults),
    children: z.number().int().min(0).max(ONLINE_MAX.children).default(0),
    infants: z.number().int().min(0).max(ONLINE_MAX.infants).default(0),
    pickup: z.enum(['skala', 'poros']).default('skala'),
    guest: z.boolean().default(false),
    second: z.boolean().default(false),
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    hotel: optional(120),
    notes: optional(1000, true),
    lang: langSchema,
    acceptTerms: z.literal(true),
    expectedTotal: z.number().min(0).max(100000).optional(),
  })
  .refine((b) => b.adults + b.children + b.infants <= ONLINE_MAX.adults + ONLINE_MAX.children + ONLINE_MAX.infants, { path: ['adults'], message: 'too many passengers' })

export const tokenSchema = z.object({ k: z.string().min(16).max(64) })

export const lookupSchema = z.object({ ref: z.string().trim().toUpperCase().max(12), email: emailSchema })

export const createRequestSchema = z.object({
  cruise: onRequestKey,
  date: isoDate.optional().nullable(),
  people: z.number().int().min(1).max(BOAT_CAPACITY),
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  message: optional(2000, true),
  lang: langSchema,
})

export const availabilityQuery = z.object({
  cruise: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined))
    .pipe(z.array(scheduledKey).max(SCHEDULED_KEYS.length).optional()),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

// ----- admin ----------------------------------------------------------------------------------------------

export const loginSchema = z.object({ password: z.string().min(1).max(200) })

export const departuresQuery = z.object({ from: isoDate.optional(), to: isoDate.optional(), cruise: scheduledKey.optional() })

export const departurePatchSchema = z
  .object({
    status: z.enum(['open', 'closed']).optional(),
    capacity: z.number().int().min(0).max(BOAT_CAPACITY).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((p) => p.status !== undefined || p.capacity !== undefined || p.note !== undefined, 'nothing to change')

export const cancelSchema = z.object({ reason: z.enum(['weather', 'technical']), note: z.string().trim().max(500).nullable().optional() })
export const refundedSchema = z.object({ note: z.string().trim().max(500).nullable().optional() })
export const moveSchema = z.object({ date: isoDate })

const euros = z
  .number()
  .min(0)
  .max(1000)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'at most 2 decimals')

export const cruisePatchSchema = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    depart: hhmm.optional(),
    returnSkala: hhmm.optional(),
    adult: euros.optional(),
    child: euros.optional(),
    capacity: z.number().int().min(1).max(BOAT_CAPACITY).optional(),
    active: z.boolean().optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), 'nothing to change')

export const seasonSchema = z.object({ start: isoDate, end: isoDate })
export const settingsPatchSchema = z.object({ season: seasonSchema })

export const requestPatchSchema = z.object({ status: z.enum(['new', 'answered', 'closed']) })

const bookingStatus = z.enum(['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUND_DUE', 'REFUNDED'])

/** GET /api/admin/bookings: filters only. A text search (names, e-mails, phones) goes through POST …/search instead. */
export const bookingsQuery = z.object({
  status: bookingStatus.optional(),
  cruise: scheduledKey.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  attention: z
    .enum(['1', 'true'])
    .optional()
    .transform((v) => !!v),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
})

/** POST /api/admin/bookings/search: the same filters plus the search text, in the JSON body. */
export const bookingsSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: bookingStatus.optional(),
  cruise: scheduledKey.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  attention: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
})

export const requestsQuery = z.object({ status: z.enum(['new', 'answered', 'closed']).optional() })
