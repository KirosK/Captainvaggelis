// Database connection. Production: Postgres from DATABASE_URL (Neon / Vercel Postgres; POSTGRES_URL is read too).
// Development without DATABASE_URL: PGlite, a real Postgres compiled to WebAssembly, storing its files in .data/pglite,
// so the whole booking flow runs locally with no external service. Both go through the same Drizzle API.
// The first call applies pending migrations and seeds the cruise settings.

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { ConfigError, dataDir, isProduction } from '../env'
import { log } from '../log'
import { DEFAULT_SEASON, SCHEDULED_KEYS, BOAT_CAPACITY, staticSchedule } from '../cruises/catalog'
import { migrations } from './migrations'
import * as schema from './schema'

export type DB = PostgresJsDatabase<typeof schema>
/** A transaction handle; it has the same query API as DB. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export type Queryable = DB | Tx

type Holder = { promise?: Promise<DB>; driver?: 'postgres' | 'pglite' }
// one connection per server process, kept across hot reloads in development
const holder: Holder = ((globalThis as { __cvDb?: Holder }).__cvDb ??= {})

export function getDb(): Promise<DB> {
  if (!holder.promise) {
    holder.promise = connect().catch((e) => {
      holder.promise = undefined
      throw e
    })
  }
  return holder.promise
}

export const dbDriver = () => holder.driver

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  let db: DB
  if (url) {
    const { default: postgres } = await import('postgres')
    const { drizzle } = await import('drizzle-orm/postgres-js')
    // prepare:false keeps it compatible with transaction-mode poolers (Neon's -pooler host, PgBouncer)
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} })
    db = drizzle(client, { schema })
    holder.driver = 'postgres'
  } else {
    if (isProduction() && process.env.ALLOW_PGLITE !== '1') throw new ConfigError('DATABASE_URL')
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const dir = process.env.PGLITE_DIR || path.join(dataDir(), 'pglite')
    await mkdir(dir, { recursive: true })
    const client = new PGlite(dir)
    await client.waitReady
    db = drizzle(client, { schema }) as unknown as DB
    holder.driver = 'pglite'
  }
  await migrate(db)
  await seed(db)
  return db
}

async function migrate(db: DB) {
  await db.transaction(async (tx) => {
    // one migrator at a time across instances (released at commit)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(727001)`)
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS cv_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    const done = new Set((await tx.select({ id: schema.migrationsTable.id }).from(schema.migrationsTable)).map((r) => r.id))
    for (const m of migrations) {
      if (done.has(m.id)) continue
      for (const statement of m.statements) await tx.execute(sql.raw(statement))
      await tx.insert(schema.migrationsTable).values({ id: m.id })
      log.info('db.migrated', { id: m.id })
    }
  })
}

/** Inserts what is missing only: the Captain's later changes are never overwritten. */
async function seed(db: DB) {
  await db
    .insert(schema.cruiseSettings)
    .values(SCHEDULED_KEYS.map((cruise) => ({ cruise, ...staticSchedule(cruise), capacity: BOAT_CAPACITY, active: true })))
    .onConflictDoNothing()
  await db.insert(schema.appSettings).values({ key: 'season', value: DEFAULT_SEASON }).onConflictDoNothing()
}

/** Rows of a raw `execute` result: postgres.js returns an array, PGlite an object with `rows`. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  return ((result as { rows?: T[] })?.rows ?? []) as T[]
}
