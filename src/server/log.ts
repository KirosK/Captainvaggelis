// One-line structured logs. Callers pass only booking references, order ids, statuses and counts:
// never names, e-mail addresses, phone numbers, card data or raw request bodies.

type Fields = Record<string, string | number | boolean | null | undefined>

function line(level: 'info' | 'warn' | 'error', event: string, fields?: Fields) {
  const parts = [`[cv] ${event}`]
  for (const [k, v] of Object.entries(fields ?? {})) if (v !== undefined) parts.push(`${k}=${String(v)}`)
  const text = parts.join(' ')
  if (level === 'error') console.error(text)
  else if (level === 'warn') console.warn(text)
  else console.info(text)
}

export const log = {
  info: (event: string, fields?: Fields) => line('info', event, fields),
  warn: (event: string, fields?: Fields) => line('warn', event, fields),
  error: (event: string, fields?: Fields) => line('error', event, fields),
}

/** An error's class and message, cut short, without stack or payload (some drivers echo query parameters). */
export function errorText(e: unknown) {
  if (e instanceof Error) return `${e.name}: ${e.message}`.replace(/\s+/g, ' ').slice(0, 160)
  return String(e).slice(0, 160)
}
