// iCalendar file for a cruise booking (attached to the confirmation e-mail, and served by
// GET /api/cruises/bookings/[ref]/ics). Times are Greek wall-clock times with an embedded Europe/Athens zone.

const ATHENS_TZ = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Athens',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds a content line at 75 octets (RFC 5545 §3.1); Greek letters take two octets each. */
function fold(line: string) {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let len = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (len + n > limit) {
      out.push(cur)
      cur = ''
      len = 0
      limit = 74 // continuation lines start with a space
    }
    cur += ch
    len += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function cruiseIcs(e: { uid: string; date: string; start: string; end: string; summary: string; location: string; description: string; url?: string }) {
  const day = e.date.replace(/-/g, '')
  const hms = (hhmm: string) => `${hhmm.replace(':', '')}00`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Captain Vangelis//Cruises//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...ATHENS_TZ,
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Athens:${day}T${hms(e.start)}`,
    `DTEND;TZID=Europe/Athens:${day}T${hms(e.end)}`,
    `SUMMARY:${icsText(e.summary)}`,
    `LOCATION:${icsText(e.location)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
