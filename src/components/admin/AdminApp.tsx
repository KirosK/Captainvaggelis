'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  AlertTriangle, Anchor, ArrowRightLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, CloudRain, Download, ExternalLink, LayoutDashboard,
  ListChecks, Loader2, LogOut, Mail, MessageSquare, Phone, Printer, RefreshCw, RotateCcw, Save, Send, Settings2, Ship, Users, Wind, X,
} from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { cruises, scheduledCruises } from '@/data/cruises'
import elCruises from '@/content/el/cruises.json'
import { CAPACITY, isTime, pickupTimes } from '@/lib/cruiseStore'
import { addDays, fromISO, toISO } from '@/lib/dates'
import { ATTENTION_EL } from '@/lib/attention'
import {
  adminApi, AdminApiError, flushOutbox, setUnauthorizedHandler,
  type AdminBooking, type AdminDeparture, type BookingStatus, type CruiseRequestRow, type CruiseSetting, type DeliveryReport, type Overview, type RequestStatus, type Settings,
} from './api'

const NAMES = Object.fromEntries(Object.entries(elCruises.list as Record<string, { name: string }>).map(([k, v]) => [k, v.name])) as Record<string, string>
/** Short codes for the month grid on phones, where the full names do not fit. */
const CODES: Record<string, string> = { fiscardo: 'ΦΙΣ', ithacaVathiKioni: 'ΙΘ·Κ', ithacaVathi: 'ΙΘ·Β', zakynthos: 'ΖΑΚ' }
const ACCENT = Object.fromEntries(cruises.map((c) => [c.key, c.accent])) as Record<string, string>
const DAYS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ']
const DAYS_LONG = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
/** "την Τρίτη", "το Σάββατο" */
const onDay = (w: number) => `${w === 6 ? 'το' : 'την'} ${DAYS_LONG[w]}`
const LANG: Record<string, string> = { en: 'Αγγλικά', el: 'Ελληνικά', it: 'Ιταλικά' }
const fmt = (d: Date, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('el-GR', o).format(d)
const fmtISO = (iso: string, o?: Intl.DateTimeFormatOptions) => {
  const d = fromISO(iso)
  return d ? fmt(d, o) : iso
}
// 24-hour clock in Greek time (el-GR would otherwise print 12:48 μ.μ.)
const fmtTime = (iso: string) => new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date(iso))
const eur = (n: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const persons = (n: number) => plural(n, 'άτομο', 'άτομα')
const party = (b: { adults: number; children: number; infants?: number }) =>
  [plural(b.adults, 'ενήλικας', 'ενήλικες'), b.children ? plural(b.children, 'παιδί', 'παιδιά') : '', b.infants ? plural(b.infants, 'βρέφος', 'βρέφη') : ''].filter(Boolean).join(' · ')
const cruiseOf = (key: string) => cruises.find((c) => c.key === key)
const timesOf = (key: string, depart: string, returnSkala: string) => {
  const c = cruiseOf(key)
  return c ? pickupTimes(c, { depart, returnSkala }) : undefined
}
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** Greek wording of the API's error codes. */
function errorText(e: unknown) {
  const code = e instanceof AdminApiError ? e.code : ''
  const body = e instanceof AdminApiError ? e.body : null
  switch (code) {
    case 'network':
      return 'Δεν υπάρχει σύνδεση με τον διακομιστή. Ελέγξτε το διαδίκτυο και δοκιμάστε ξανά.'
    case 'rate_limited':
      return 'Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.'
    case 'not_enough_seats':
      return `Δεν υπάρχουν αρκετές θέσεις σε αυτή την ημερομηνία (ελεύθερες: ${Number(body?.left ?? 0)}).`
    case 'departure_unavailable':
      return body?.status === 'cancelled' ? 'Η αναχώρηση αυτή έχει ακυρωθεί.' : body?.status === 'past' ? 'Η αναχώρηση αυτή έχει περάσει.' : 'Η ημερομηνία αυτή δεν είναι στο πρόγραμμα.'
    case 'departure_past':
      return 'Η αναχώρηση αυτή έχει ήδη γίνει.'
    case 'weekday_conflict': {
      const w = Number(body?.weekday)
      return `Το σκάφος έχει ήδη πρόγραμμα ${onDay(w)} με την κρουαζιέρα «${NAMES[String(body?.cruise)] ?? body?.cruise}». Αφαιρέστε πρώτα αυτή την ημέρα από εκείνη την κρουαζιέρα.`
    }
    case 'return_before_departure':
      return 'Η επιστροφή πρέπει να είναι μετά την αναχώρηση.'
    case 'capacity_too_high':
      return `Η χωρητικότητα δεν μπορεί να ξεπερνά τα ${CAPACITY} άτομα (άδεια σκάφους).`
    case 'invalid_season':
      return 'Η περίοδος πρέπει να τελειώνει μετά την έναρξη και να μην ξεπερνά τον έναν χρόνο.'
    case 'not_refund_due':
      return 'Η κράτηση δεν περιμένει επιστροφή χρημάτων.'
    case 'not_movable':
      return 'Μόνο πληρωμένες κρατήσεις ή κρατήσεις που περιμένουν επιστροφή μπορούν να μεταφερθούν.'
    case 'same_date':
      return 'Η κράτηση είναι ήδη σε αυτή την ημερομηνία.'
    case 'not_paid':
      return 'Το e-ticket στέλνεται μόνο για πληρωμένες κρατήσεις.'
    case 'validation':
      return 'Ελέγξτε τις τιμές που δώσατε.'
    default:
      return 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.'
  }
}

/** "Στάλθηκαν 3 e-mail." / "… 2 περιμένουν ακόμη αποστολή." */
function deliveryText(d: DeliveryReport | null | undefined) {
  if (!d) return ''
  const parts = []
  if (d.sent) parts.push(`Στάλθηκαν ${plural(d.sent, 'e-mail', 'e-mail')}.`)
  if (d.pending) parts.push(`${plural(d.pending, 'e-mail περιμένει', 'e-mail περιμένουν')} ακόμη αποστολή.`)
  if (d.failed) parts.push(`${plural(d.failed, 'e-mail απέτυχε', 'e-mail απέτυχαν')}.`)
  return parts.join(' ')
}

/** What Tab can reach inside the departure panel. */
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 24-hour times in 15-minute steps for the schedule (native time inputs show AM/PM in some browsers). */
const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => `${String(6 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

/** Guests type the names, hotels, notes and messages: a cell starting with =, +, - or @ would run as a formula in Excel, so it gets a leading apostrophe. */
const csvSafe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const body = '﻿' + rows.map((r) => r.map((x) => `"${csvSafe(String(x ?? '')).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** The departures the admin loads: from a week ago (or the start of the season) to the end of the season, at most 400 days. */
function rangeFor(season: { start: string; end: string }, today: string) {
  const t = fromISO(today) ?? new Date()
  const weekAgo = toISO(addDays(t, -7))
  let from = season.start < weekAgo ? season.start : weekAgo
  const to = season.end > today ? season.end : toISO(addDays(t, 120))
  const toDate = fromISO(to)!
  const earliest = toISO(addDays(toDate, -400))
  if (from < earliest) from = earliest
  return { from, to }
}

type Tab = 'today' | 'calendar' | 'schedule' | 'bookings' | 'requests'
type Toast = { text: string; tone?: 'ok' | 'error' }
type Notify = (text: string, tone?: Toast['tone']) => void
type DepKey = { cruise: string; date: string }

// ----- App: session ---------------------------------------------------------------------------------------

export function AdminApp() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking')
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth('out'))
    adminApi
      .session()
      .then((s) => setAuth(s.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'))
    return () => setUnauthorizedHandler(null)
  }, [])
  if (auth === 'checking')
    return (
      <div className="grid min-h-screen place-items-center bg-ink" role="status" aria-label="Φόρτωση">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    )
  if (auth === 'out') return <Login onLogin={() => setAuth('in')} />
  return <Dashboard onLogout={() => setAuth('out')} />
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const submit = async () => {
    if (!password || busy) {
      if (!password) setError('Γράψτε τον κωδικό.')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await adminApi.login(password)
      onLogin()
    } catch (e) {
      const code = e instanceof AdminApiError ? e.code : ''
      setError(code === 'wrong_password' ? 'Λάθος κωδικός. Δοκιμάστε ξανά.' : code === 'rate_limited' ? 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.' : errorText(e))
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <m.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
        className="w-full max-w-sm rounded-xl3 bg-sand-paper p-8 shadow-lift"
      >
        <LogoMark className="h-12 w-12 text-ink" />
        <h1 className="mt-5 font-display text-3xl">Καλώς ήρθατε</h1>
        <p className="mt-2 text-[0.95rem] text-ink-soft">Διαχείριση κρουαζιερών και κρατήσεων.</p>
        <label className="label mt-6" htmlFor="pin">
          Κωδικός
        </label>
        <input
          ref={inputRef}
          id="pin"
          type="password"
          className={`field ${error ? 'ring-2 ring-terra' : ''}`}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError('')
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'pin-err' : undefined}
          autoFocus
        />
        {error && (
          <p id="pin-err" className="mt-2 text-[0.85rem] text-terra-deep" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full py-4">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Είσοδος
        </button>
      </m.form>
    </div>
  )
}

// ----- Dashboard -----------------------------------------------------------------------------------------

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('today')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [departures, setDepartures] = useState<AdminDeparture[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<DepKey | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [bookingFilter, setBookingFilter] = useState<Filter>('all')
  const [flushing, setFlushing] = useState(false)

  const notify: Notify = useCallback((text, tone = 'ok') => setToast({ text, tone }), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.tone === 'error' ? 6000 : 4200)
    return () => clearTimeout(id)
  }, [toast])

  const reload = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([adminApi.overview(), adminApi.settings()])
      const range = rangeFor(s.season, o.today)
      const d = await adminApi.departures(range.from, range.to)
      setOverview(o)
      setSettings(s)
      setDepartures(d.departures)
      setLoadError(false)
    } catch (e) {
      if (!(e instanceof AdminApiError && e.status === 401)) setLoadError(true)
    }
  }, [])
  useEffect(() => {
    reload()
    // new bookings arrive while the page is open: refresh every minute, and when the owner comes back to the tab
    const id = setInterval(() => document.visibilityState === 'visible' && reload(), 60_000)
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  const flush = async () => {
    setFlushing(true)
    try {
      const d = await flushOutbox()
      notify(deliveryText(d) || 'Δεν υπάρχουν e-mail για αποστολή.')
    } catch (e) {
      notify(errorText(e), 'error')
    }
    setFlushing(false)
    reload()
  }

  const logout = async () => {
    try {
      await adminApi.logout()
    } catch {}
    onLogout()
  }

  const openBookings = (f: Filter) => {
    setBookingFilter(f)
    setTab('bookings')
  }

  const nav: { k: Tab; label: string; icon: typeof Ship; badge?: number }[] = [
    { k: 'today', label: 'Επόμενες', icon: LayoutDashboard },
    { k: 'calendar', label: 'Ημερολόγιο', icon: CalendarDays },
    { k: 'schedule', label: 'Πρόγραμμα & τιμές', icon: Settings2 },
    { k: 'bookings', label: 'Κρατήσεις', icon: ListChecks, badge: (overview?.refundDue ?? 0) + (overview?.attention ?? 0) },
    { k: 'requests', label: 'Αιτήματα', icon: MessageSquare, badge: overview?.newRequests ?? 0 },
  ]
  const today = overview?.today ?? toISO(new Date())

  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-30 border-b border-line bg-sand-paper/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="h-8 w-8 shrink-0 text-ink" />
            <div className="min-w-0 leading-tight">
              <h1 className="truncate font-display text-lg">Διαχείριση κρουαζιερών</h1>
              <p className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-mute">Καπετάν Βαγγέλης · Σκάλα</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/el/cruises" target="_blank" className="btn btn-ghost hidden py-2.5 sm:inline-flex">
              Δείτε την ιστοσελίδα <ExternalLink className="h-4 w-4" />
            </Link>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-white" aria-label="Αποσύνδεση" title="Αποσύνδεση" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="container scrollbar-none flex gap-1 overflow-x-auto pb-2" aria-label="Ενότητες">
          {nav.map((n) => (
            <button key={n.k} type="button" onClick={() => setTab(n.k)} aria-current={tab === n.k ? 'page' : undefined} className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[0.9rem] font-medium ${tab === n.k ? 'text-white' : 'text-ink-soft hover:bg-white'}`}>
              {tab === n.k && <m.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-ink" />}
              <n.icon className="relative h-4 w-4" />
              <span className="relative">{n.label}</span>
              {!!n.badge && <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-terra px-1.5 text-[0.7rem] font-semibold text-white">{n.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="container py-8">
        <ModeBanner overview={overview} />
        {overview && (overview.pendingEmails > 0 || overview.failedEmails > 0) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-[0.9rem] shadow-soft ring-1 ring-ink/5">
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sea" />
              <span>
                {overview.pendingEmails > 0 && <>{plural(overview.pendingEmails, 'e-mail περιμένει', 'e-mail περιμένουν')} αποστολή. </>}
                {overview.failedEmails > 0 && <span className="text-terra-deep">{plural(overview.failedEmails, 'e-mail δεν στάλθηκε', 'e-mail δεν στάλθηκαν')}: ελέγξτε τις ρυθμίσεις e-mail.</span>}
              </span>
            </p>
            {overview.pendingEmails > 0 && (
              <button type="button" onClick={flush} disabled={flushing} className="btn btn-ghost py-2.5">
                {flushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Αποστολή τώρα
              </button>
            )}
          </div>
        )}
        {loadError && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-terra-light p-4 text-[0.9rem] text-terra-deep" role="alert">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Δεν ήταν δυνατή η φόρτωση των στοιχείων.
            </p>
            <button type="button" onClick={reload} className="btn btn-ghost bg-white py-2.5">
              <RefreshCw className="h-4 w-4" /> Δοκιμάστε ξανά
            </button>
          </div>
        )}

        {!departures || !settings || !overview ? (
          !loadError && (
            <div className="grid place-items-center py-24 text-ink-mute" role="status" aria-label="Φόρτωση">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )
        ) : (
          <>
            {tab === 'today' && <Upcoming departures={departures} today={today} overview={overview} onOpen={setSelected} onBookings={openBookings} notify={notify} onChange={reload} />}
            {tab === 'calendar' && <MonthCalendar departures={departures} season={settings.season} today={today} onOpen={setSelected} />}
            {tab === 'schedule' && (
              <Schedule
                settings={settings}
                onSaved={(s) => {
                  setSettings(s)
                  reload()
                }}
                notify={notify}
              />
            )}
            {tab === 'bookings' && <Bookings filter={bookingFilter} setFilter={setBookingFilter} departures={departures} today={today} notify={notify} onChange={reload} />}
            {tab === 'requests' && <Requests notify={notify} onChange={reload} />}
          </>
        )}
      </main>

      <AnimatePresence>
        {selected && departures && (
          <DeparturePanel key={`${selected.cruise}:${selected.date}`} dep={selected} departures={departures} today={today} onClose={() => setSelected(null)} notify={notify} onChange={reload} />
        )}
      </AnimatePresence>

      {/* centred by a flex wrapper: framer-motion's transform would override a translate-x class on the toast itself */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl px-5 py-3 text-[0.9rem] text-white shadow-lift sm:rounded-full ${toast.tone === 'error' ? 'bg-terra-deep' : 'bg-ink'}`}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              {toast.tone === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0 text-sea-light" />} {toast.text}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Where the data is kept, and whether payments and e-mails are real or in test mode. */
function ModeBanner({ overview }: { overview: Overview | null }) {
  const test = overview && (overview.payments === 'mock' || overview.email === 'file')
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-start gap-3 rounded-2xl bg-sea-mist p-4 text-[0.9rem] text-sea-deep">
        <Anchor className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Οι αλλαγές αποθηκεύονται αμέσως και φαίνονται στην ιστοσελίδα μέσα σε λίγα δευτερόλεπτα. Οι επιβάτες κλείνουν και πληρώνουν online και λαμβάνουν το e-ticket με e-mail.</p>
      </div>
      {test && (
        <div className="flex items-start gap-3 rounded-2xl bg-sun-light p-4 text-[0.88rem] text-ink ring-1 ring-sun/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="font-semibold">Δοκιμαστική λειτουργία.</strong>{' '}
            {overview.payments === 'mock' && 'Οι πληρωμές γίνονται σε δοκιμαστική σελίδα και καμία κάρτα δεν χρεώνεται. '}
            {overview.email === 'file' && 'Τα e-mail αποθηκεύονται σε αρχεία και δεν στέλνονται στους επιβάτες. '}
            Για κανονική λειτουργία χρειάζονται τα στοιχεία της Alpha Bank και του e-mail (δείτε «Going live» στο README).
          </p>
        </div>
      )}
      {overview && overview.payments === null && (
        <div className="flex items-start gap-3 rounded-2xl bg-terra-light p-4 text-[0.88rem] text-terra-deep" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Οι online πληρωμές είναι απενεργοποιημένες: οι επισκέπτες δεν μπορούν να κλείσουν θέσεις. Ελέγξτε τα στοιχεία της Alpha Bank στις ρυθμίσεις του διακομιστή.</p>
        </div>
      )}
    </div>
  )
}

// ----- Status badges and the seat bar --------------------------------------------------------------------

const DEP_STATUS: Record<AdminDeparture['status'], [string, string]> = {
  open: ['Ανοιχτή', 'bg-sea-mist text-sea-deep'],
  cancelled: ['Ακυρώθηκε', 'bg-terra-light text-terra-deep'],
  closed: ['Κλειστές κρατήσεις', 'bg-sand-deep text-ink-soft'],
  soldout: ['Γεμάτη', 'bg-sun-light text-ink'],
  past: ['Ολοκληρώθηκε', 'bg-sand text-ink-mute'],
}
function depBadge(d: Pick<AdminDeparture, 'status' | 'closedBy'>) {
  const [label, cls] = DEP_STATUS[d.status]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-semibold ${cls}`}>{d.status === 'closed' && d.closedBy === 'cutoff' ? 'Έκλεισε (αναχωρεί σύντομα)' : label}</span>
}

const BOOKING_STATUS: Record<BookingStatus, [string, string]> = {
  PENDING_PAYMENT: ['Σε αναμονή πληρωμής', 'bg-sun-light text-ink'],
  PAID: ['Πληρωμένη', 'bg-sea-mist text-sea-deep'],
  CANCELLED: ['Ακυρωμένη', 'bg-sand text-ink-mute'],
  REFUND_DUE: ['Οφείλεται επιστροφή', 'bg-terra-light text-terra-deep'],
  REFUNDED: ['Επιστράφηκαν', 'bg-sand-deep text-ink-soft'],
}
function bookingBadge(s: BookingStatus) {
  const [label, cls] = BOOKING_STATUS[s]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-semibold ${cls}`}>{label}</span>
}

const ATTENTION = ATTENTION_EL
const REASON: Record<string, string> = { weather: 'καιρικές συνθήκες', technical: 'τεχνικοί λόγοι', hold_expired: 'δεν ολοκληρώθηκε η πληρωμή', departure_cancelled: 'ακυρώθηκε η αναχώρηση' }
const DISCOUNT: Record<string, string> = { guest20: 'Φιλοξενούμενοι −20%', second15: 'Δεύτερη κρουαζιέρα −15%' }

/** "Πληρώθηκε με κάρτα · 12 Ιουν 10:42" and the like, under the amount. */
function paymentLine(b: AdminBooking) {
  switch (b.status) {
    case 'PAID':
      return `Πληρώθηκε με κάρτα${b.paidAt ? ` · ${fmtTime(b.paidAt)}` : ''}`
    case 'PENDING_PAYMENT':
      return b.holdActive && b.holdExpiresAt ? `Πληρώνει τώρα· οι θέσεις κρατούνται έως ${fmtTime(b.holdExpiresAt)}` : 'Δεν πληρώθηκε'
    case 'REFUND_DUE':
      return `Επιστροφή ${eur(b.total)} στην κάρτα (μέσα σε 3 εργάσιμες)`
    case 'REFUNDED':
      return `Επιστράφηκαν${b.refundedAt ? ` · ${fmtTime(b.refundedAt)}` : ''}`
    default:
      return `Ακυρώθηκε χωρίς χρέωση${b.cancelReason ? ` (${REASON[b.cancelReason] ?? b.cancelReason})` : ''}`
  }
}

const fillColour = (pct: number) => (pct > 90 ? 'bg-terra' : pct > 60 ? 'bg-sun' : 'bg-sea')
const taken = (d: AdminDeparture) => d.paidSeats + d.heldSeats

function Fill({ sold, cap, held = 0 }: { sold: number; cap: number; held?: number }) {
  const pct = Math.min(100, Math.round((sold / Math.max(1, cap)) * 100))
  return (
    <div>
      <div className="flex justify-between gap-3 text-[0.8rem] text-ink-mute">
        <span>
          <strong className="text-ink tabular-nums">{sold}</strong> / {cap} θέσεις
          {held > 0 && <span> · {held} σε αναμονή πληρωμής</span>}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
        <m.div className={`h-full rounded-full ${fillColour(pct)}`} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
    </div>
  )
}

function ContactAlert({ overview, onBookings }: { overview: Overview; onBookings?: (f: Filter) => void }) {
  if (!overview.refundDue && !overview.attention) return null
  return (
    <div className="space-y-3">
      {overview.refundDue > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-terra-light p-4 text-[0.92rem] text-terra-deep" role="alert">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {plural(overview.refundDue, 'κράτηση περιμένει', 'κρατήσεις περιμένουν')} επιστροφή χρημάτων μετά από ακύρωση: κάντε την επιστροφή από την τράπεζα (μέσα σε 3 εργάσιμες) ή μεταφέρετε την κράτηση σε άλλη ημερομηνία.
          </p>
          {onBookings && (
            <button type="button" onClick={() => onBookings('REFUND_DUE')} className="btn btn-ghost bg-white py-2.5">
              Δείτε τις κρατήσεις
            </button>
          )}
        </div>
      )}
      {overview.attention > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-light p-4 text-[0.92rem] text-ink ring-1 ring-sun/40" role="alert">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {plural(overview.attention, 'πληρωμή χρειάζεται', 'πληρωμές χρειάζονται')} έλεγχο.
          </p>
          {onBookings && (
            <button type="button" onClick={() => onBookings('attention')} className="btn btn-ghost bg-white py-2.5">
              Δείτε ποιες
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ----- Upcoming departures -------------------------------------------------------------------------------

function Upcoming({
  departures,
  today,
  overview,
  onOpen,
  onBookings,
  notify,
  onChange,
}: {
  departures: AdminDeparture[]
  today: string
  overview: Overview
  onOpen: (d: DepKey) => void
  onBookings: (f: Filter) => void
  notify: Notify
  onChange: () => void
}) {
  const next = departures.filter((d) => d.date >= today && d.status !== 'past').slice(0, 9)
  // the hero shows the next departure that actually sails; cancelled ones stay in the list with their badge
  const first = next.find((d) => d.status === 'open' || d.status === 'soldout') ?? next[0]
  const rest = next.filter((d) => d !== first)
  const times = first ? timesOf(first.cruise, first.depart, first.returnSkala) : undefined
  const [busy, setBusy] = useState(false)
  const reopen = async (d: AdminDeparture) => {
    setBusy(true)
    try {
      await adminApi.patchDeparture(d.cruise, d.date, { status: 'open' })
      notify('Η αναχώρηση άνοιξε ξανά.')
      onChange()
    } catch (e) {
      notify(errorText(e), 'error')
    }
    setBusy(false)
  }
  return (
    <div className="space-y-6">
      <ContactAlert overview={overview} onBookings={onBookings} />
      {next.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-ink-mute shadow-soft ring-1 ring-ink/5">Δεν υπάρχουν προγραμματισμένες αναχωρήσεις. Ελέγξτε την περίοδο και τις ημέρες στο «Πρόγραμμα & τιμές».</p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {first && times && (
          <div className="rounded-xl3 bg-ink p-6 text-white shadow-lift sm:p-7 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-white/60">Επόμενη αναχώρηση</p>
              {first.status !== 'open' && depBadge(first)}
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="font-display text-3xl">{NAMES[first.cruise]}</p>
                <p className="mt-1 text-white/70">
                  {fmtISO(first.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {times.skala.depart} από τη Σκάλα
                  {times.hasPoros && ` · ${times.poros.depart} από τον Πόρο`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpen(first)} className="btn bg-white text-ink hover:bg-sand">
                  Λεπτομέρειες
                </button>
                {first.status === 'cancelled' ? (
                  <button type="button" disabled={busy} onClick={() => reopen(first)} className="btn btn-ghost-light">
                    Άνοιγμα ξανά
                  </button>
                ) : (
                  <button type="button" onClick={() => onOpen(first)} className="btn btn-ghost-light">
                    <CloudRain className="h-4 w-4" /> Ακύρωση λόγω καιρού
                  </button>
                )}
              </div>
            </div>
            <div className="mt-6 max-w-md [&_*]:!text-white/80">
              <Fill sold={taken(first)} held={first.heldSeats} cap={first.capacity} />
            </div>
          </div>
        )}
        {rest.map((d) => (
          <button
            key={`${d.cruise}:${d.date}`}
            type="button"
            onClick={() => onOpen(d)}
            className={`rounded-xl2 p-5 text-left shadow-soft ring-1 transition hover:-translate-y-0.5 hover:shadow-lift ${d.status === 'cancelled' ? 'bg-terra-light/40 ring-terra/30' : 'bg-white ring-ink/5'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.85rem] font-semibold text-ink-mute">{fmtISO(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              {depBadge(d)}
            </div>
            <p className="mt-2 font-display text-xl">{NAMES[d.cruise]}</p>
            <div className="mt-4">
              <Fill sold={taken(d)} held={d.heldSeats} cap={d.capacity} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ----- Month calendar ------------------------------------------------------------------------------------

function MonthCalendar({ departures, season, today, onOpen }: { departures: AdminDeparture[]; season: { start: string; end: string }; today: string; onOpen: (d: DepKey) => void }) {
  // opens on the current month during the season, otherwise on the first month of the season
  const startOn = today >= season.start && today <= season.end ? today : season.start
  const [month, setMonth] = useState(() => {
    const d = fromISO(startOn) ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const byDay = useMemo(() => {
    const m = new Map<string, AdminDeparture[]>()
    for (const d of departures) m.set(d.date, [...(m.get(d.date) ?? []), d])
    return m
  }, [departures])
  const offset = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: offset + days }, (_, i) => (i < offset ? null : new Date(month.getFullYear(), month.getMonth(), i - offset + 1)))

  return (
    <div className="rounded-xl3 bg-white p-3 shadow-soft ring-1 ring-ink/5 sm:p-5 md:p-7">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Προηγούμενος μήνας" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-sand">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-2xl capitalize">{fmt(month, { month: 'long', year: 'numeric' })}</h2>
        <button type="button" aria-label="Επόμενος μήνας" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-sand">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-ink-mute sm:gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <div key={w}>{DAYS[w]}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((c, i) =>
          c ? (
            <div key={i} className={`min-h-[64px] min-w-0 rounded-lg p-1 md:min-h-[92px] md:rounded-xl md:p-1.5 ${toISO(c) === today ? 'bg-sun-light/50 ring-1 ring-sun' : 'bg-sand/50'}`}>
              <p className="px-0.5 text-[0.72rem] font-semibold tabular-nums text-ink-mute md:px-1 md:text-[0.78rem]">{c.getDate()}</p>
              {(byDay.get(toISO(c)) ?? []).map((d) => {
                const sold = taken(d)
                const pct = Math.min(100, Math.round((sold / Math.max(1, d.capacity)) * 100))
                const cancelled = d.status === 'cancelled'
                const tint = cancelled ? 'bg-terra-light text-terra-deep' : d.status === 'closed' ? 'bg-sand-deep text-ink-soft' : pct > 90 ? 'bg-terra-light/60 text-ink' : pct > 60 ? 'bg-sun-light/70 text-ink' : 'bg-white text-ink'
                return (
                  <button
                    key={d.cruise}
                    type="button"
                    onClick={() => onOpen(d)}
                    title={`${NAMES[d.cruise]} · ${sold}/${d.capacity}`}
                    aria-label={`${NAMES[d.cruise]}, ${fmtISO(d.date, { day: 'numeric', month: 'long' })}, ${cancelled ? 'ακυρώθηκε' : `${sold} από ${d.capacity} θέσεις`}`}
                    style={{ borderLeftColor: ACCENT[d.cruise] }}
                    className={`relative mt-1 w-full overflow-hidden rounded-md border-l-2 px-1 pb-1.5 pt-1 text-left text-[0.62rem] font-semibold leading-tight shadow-sm transition hover:ring-2 hover:ring-ink md:rounded-lg md:border-l-0 md:px-1.5 md:text-[0.7rem] ${tint}`}
                  >
                    <span className={`flex items-center gap-1 ${cancelled ? 'line-through' : ''}`}>
                      <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full md:block" style={{ background: ACCENT[d.cruise] }} aria-hidden="true" />
                      <span className="whitespace-nowrap md:hidden">{CODES[d.cruise] ?? NAMES[d.cruise]}</span>
                      <span className="hidden md:line-clamp-2">{NAMES[d.cruise]}</span>
                    </span>
                    {!cancelled && (
                      <span className="mt-0.5 block font-normal tabular-nums text-ink-mute">
                        <span className="md:hidden">{sold}</span>
                        <span className="hidden md:inline">
                          {sold}/{d.capacity}
                        </span>
                      </span>
                    )}
                    {!cancelled && (
                      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/5" aria-hidden="true">
                        <span className={`block h-full ${fillColour(pct)}`} style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.8rem] text-ink-soft">
        {scheduledCruises.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: c.accent }} aria-hidden="true" />
            <span className="font-semibold md:hidden">{CODES[c.key]}</span> {NAMES[c.key]}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-ink-mute">
          <span className="h-2 w-4 rounded-sm bg-sun-light" aria-hidden="true" /> &gt; 60%
        </li>
        <li className="flex items-center gap-1.5 text-ink-mute">
          <span className="h-2 w-4 rounded-sm bg-terra-light" aria-hidden="true" /> &gt; 90% ή ακύρωση
        </li>
      </ul>
      <p className="mt-3 text-[0.8rem] text-ink-mute">Ο αριθμός σε κάθε αναχώρηση δείχνει τις θέσεις που έχουν πουληθεί (μαζί με όσους πληρώνουν αυτή τη στιγμή).</p>
    </div>
  )
}

// ----- Departure panel: seats, passengers, cancel ---------------------------------------------------------

const CANCEL_REASONS: { label: string; reason: 'weather' | 'technical' }[] = [
  { label: 'Δυνατός άνεμος', reason: 'weather' },
  { label: 'Υψηλό κύμα', reason: 'weather' },
  { label: 'Βλάβη / συντήρηση', reason: 'technical' },
]

function DeparturePanel({ dep, departures, today, onClose, notify, onChange }: { dep: DepKey; departures: AdminDeparture[]; today: string; onClose: () => void; notify: Notify; onChange: () => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.departure>> | null>(null)
  const [failed, setFailed] = useState(false)
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [cap, setCap] = useState<number>(NaN)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await adminApi.departure(dep.cruise, dep.date)
      setDetail(d)
      setCap(d.departure?.capacity ?? CAPACITY)
      setFailed(false)
    } catch (e) {
      if (!(e instanceof AdminApiError && e.status === 401)) setFailed(true)
    }
  }, [dep.cruise, dep.date])
  useEffect(() => {
    load()
  }, [load])
  const changed = () => {
    load()
    onChange()
  }

  const state = detail?.departure
  const times = detail?.times ? { skala: detail.times.skala, poros: detail.times.poros } : undefined
  const passengers = detail?.passengers ?? []
  const paidBookings = passengers.filter((b) => b.status === 'PAID')
  const capValid = Number.isFinite(cap) && cap >= 1 && cap <= CAPACITY

  const run = async (what: string, fn: () => Promise<string>) => {
    setBusy(what)
    try {
      notify(await fn())
      changed()
    } catch (e) {
      notify(errorText(e), 'error')
    }
    setBusy(null)
  }
  const saveCap = (value: number | null) =>
    run('cap', async () => {
      await adminApi.patchDeparture(dep.cruise, dep.date, { capacity: value })
      return value == null ? 'Η χωρητικότητα επανήλθε στην κανονική.' : 'Η χωρητικότητα ενημερώθηκε.'
    })
  const setOpen = (status: 'open' | 'closed') =>
    run('status', async () => {
      await adminApi.patchDeparture(dep.cruise, dep.date, { status })
      return status === 'closed' ? 'Οι κρατήσεις έκλεισαν για αυτή την αναχώρηση.' : 'Η αναχώρηση άνοιξε ξανά.'
    })
  const cancel = () => {
    const n = paidBookings.length
    const ok = window.confirm(
      `Ακύρωση της αναχώρησης «${NAMES[dep.cruise]}» ${fmtISO(dep.date, { weekday: 'long', day: 'numeric', month: 'long' })} (${reason.reason === 'weather' ? 'καιρός' : 'τεχνικοί λόγοι'});\n\n` +
        (n
          ? `${plural(n, 'πληρωμένη κράτηση θα σημειωθεί', 'πληρωμένες κρατήσεις θα σημειωθούν')} για επιστροφή χρημάτων και οι επιβάτες θα λάβουν e-mail με τις επιλογές τους (πλήρης επιστροφή μέσα σε 3 εργάσιμες ή άλλη ημερομηνία).`
          : 'Δεν υπάρχουν πληρωμένες κρατήσεις. Η ημερομηνία θα κλείσει στην ιστοσελίδα.'),
    )
    if (!ok) return
    run('cancel', async () => {
      const r = await adminApi.cancelDeparture(dep.cruise, dep.date, reason.reason, reason.label)
      let delivery = r.delivery
      if (delivery.pending > 0) delivery = (await flushOutbox()) ?? delivery
      const head = r.refundDue.length ? `Η αναχώρηση ακυρώθηκε. ${plural(r.refundDue.length, 'κράτηση περιμένει', 'κρατήσεις περιμένουν')} επιστροφή χρημάτων.` : 'Η αναχώρηση ακυρώθηκε και έκλεισε στην ιστοσελίδα.'
      return `${head} ${deliveryText(delivery)}`.trim()
    })
  }

  // Escape closes; Tab and Shift+Tab stay inside the panel (as in the photo viewer)
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  // move focus into the dialog when it opens, and back to the card or button that opened it when it closes
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    return () => opener?.focus?.({ preventScroll: true })
  }, [])

  return (
    <>
      <m.div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.aside
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-sand-paper p-6 shadow-lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dep-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.8rem] font-semibold text-ink-mute">{fmtISO(dep.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h2 id="dep-title" className="mt-1 font-display text-2xl">
              {NAMES[dep.cruise]}
            </h2>
            {times && (
              <p className="mt-1 text-[0.85rem] text-ink-mute">
                Σκάλα {times.skala.depart}
                {times.poros && ` · Πόρος ${times.poros.depart} (κατόπιν αιτήματος)`} · επιστροφή {times.skala.back}
              </p>
            )}
            {state && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {depBadge(state)}
                {!state.onSchedule && <span className="inline-block rounded-full bg-sand-deep px-2.5 py-1 text-[0.75rem] font-semibold text-ink-soft">Εκτός προγράμματος</span>}
              </div>
            )}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Κλείσιμο" className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {failed && (
          <div className="mt-6 rounded-2xl bg-terra-light p-4 text-[0.9rem] text-terra-deep" role="alert">
            Δεν ήταν δυνατή η φόρτωση.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Δοκιμάστε ξανά
            </button>
          </div>
        )}
        {!detail && !failed && (
          <div className="grid place-items-center py-16 text-ink-mute" role="status" aria-label="Φόρτωση">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {state && (
          <>
            <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
              <Fill sold={taken(state)} held={state.heldSeats} cap={state.capacity} />
              {state.status !== 'cancelled' && state.status !== 'past' && <p className="mt-2 text-[0.8rem] text-ink-mute">Ελεύθερες για online κράτηση: {state.left}</p>}
              {state.status !== 'cancelled' && state.status !== 'past' && (
                <>
                  <div className="mt-4 flex items-end gap-3">
                    <div className="flex-1">
                      <label className="label" htmlFor="cap">
                        Χωρητικότητα (άτομα, μαζί με βρέφη)
                      </label>
                      <input id="cap" type="number" inputMode="numeric" min={1} max={CAPACITY} value={Number.isFinite(cap) ? cap : ''} onChange={(e) => setCap(e.target.valueAsNumber)} className={`field ${capValid ? '' : 'ring-2 ring-terra'}`} aria-invalid={!capValid} />
                    </div>
                    <button type="button" disabled={!capValid || cap === state.capacity || !!busy} onClick={() => saveCap(Math.round(cap))} className="btn btn-primary py-3.5">
                      {busy === 'cap' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Αποθήκευση
                    </button>
                  </div>
                  {!capValid && <p className="mt-1 text-[0.8rem] text-terra-deep">Από 1 έως {CAPACITY} άτομα (άδεια σκάφους).</p>}
                  {capValid && cap < taken(state) && <p className="mt-1 text-[0.8rem] text-terra-deep">Λιγότερες από τις θέσεις που έχουν ήδη κλειστεί ({taken(state)}): η αναχώρηση θα εμφανίζεται γεμάτη.</p>}
                  {state.customCapacity && (
                    <button type="button" disabled={!!busy} onClick={() => saveCap(null)} className="mt-2 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-ink-mute hover:text-ink">
                      <RotateCcw className="h-3.5 w-3.5" /> Κανονική χωρητικότητα της κρουαζιέρας
                    </button>
                  )}
                </>
              )}
            </div>

            {state.status === 'cancelled' ? (
              <div className="mt-5 rounded-2xl bg-terra-light p-5">
                <p className="flex items-center gap-2 font-semibold text-terra-deep">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Ακυρώθηκε: {[state.cancelReason ? REASON[state.cancelReason] : '', state.note].filter(Boolean).join(' · ') || '—'}
                </p>
                {passengers.some((b) => b.status === 'REFUND_DUE') && (
                  <p className="mt-2 text-[0.88rem] text-terra-deep">Οι επιβάτες έλαβαν e-mail. Κάντε την επιστροφή από την τράπεζα και πατήστε «Έγινε η επιστροφή», ή μεταφέρετε την κράτηση σε άλλη ημερομηνία.</p>
                )}
                {state.date >= today && (
                  <>
                    <button type="button" disabled={!!busy} onClick={() => setOpen('open')} className="btn btn-primary mt-4 w-full">
                      {busy === 'status' && <Loader2 className="h-4 w-4 animate-spin" />} Άνοιγμα ξανά
                    </button>
                    <p className="mt-2 text-[0.8rem] text-terra-deep/80">Το άνοιγμα δεν επαναφέρει τις κρατήσεις: για όποιον θέλει να ταξιδέψει, πατήστε «Νέα ημερομηνία» και επιλέξτε την ίδια ημερομηνία.</p>
                  </>
                )}
              </div>
            ) : state.status === 'past' ? null : (
              <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
                <p className="flex items-center gap-2 font-semibold">
                  <Wind className="h-4 w-4 text-terra" /> Λόγος ακύρωσης
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CANCEL_REASONS.map((r) => (
                    <button key={r.label} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={`rounded-full px-3 py-1.5 text-[0.82rem] font-medium ${reason === r ? 'bg-ink text-white' : 'bg-sand hover:bg-sand-deep'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={!!busy} onClick={cancel} className="btn mt-4 w-full bg-terra text-white hover:bg-terra-deep">
                  {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudRain className="h-4 w-4" />} Ακύρωση αναχώρησης
                </button>
                <button type="button" disabled={!!busy} onClick={() => setOpen(state.status === 'closed' && state.closedBy === 'admin' ? 'open' : 'closed')} className="btn btn-ghost mt-2 w-full">
                  {state.status === 'closed' && state.closedBy === 'admin' ? 'Άνοιγμα κρατήσεων' : 'Κλείσιμο κρατήσεων (χωρίς ακύρωση)'}
                </button>
                <p className="mt-3 text-[0.8rem] text-ink-mute">
                  Με την ακύρωση, η ημερομηνία κλείνει αμέσως στην ιστοσελίδα, οι πληρωμένες κρατήσεις περνούν σε «Οφείλεται επιστροφή» και κάθε επιβάτης λαμβάνει e-mail στη γλώσσα του: πλήρης επιστροφή μέσα σε 3 εργάσιμες ή άλλη ημερομηνία.
                </p>
              </div>
            )}

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                  <Users className="h-4 w-4" /> Επιβάτες ({passengers.length})
                </p>
                <div className="flex gap-2">
                  <a href={adminApi.passengersUrl(dep.cruise, dep.date, 'html')} target="_blank" rel="noopener" className="btn btn-ghost bg-white px-3.5 py-2 text-[0.82rem]">
                    <Printer className="h-4 w-4" /> Εκτύπωση
                  </a>
                  <a href={adminApi.passengersUrl(dep.cruise, dep.date, 'csv')} download className="btn btn-ghost bg-white px-3.5 py-2 text-[0.82rem]">
                    <Download className="h-4 w-4" /> CSV
                  </a>
                </div>
              </div>
              {detail && detail.totals.paid > 0 && (
                <p className="mt-2 text-[0.85rem] text-ink-soft">
                  Πληρωμένες θέσεις: <strong className="tabular-nums">{detail.totals.paid}</strong> ({party(detail.totals)})
                </p>
              )}
              {detail && detail.totals.poros > 0 && <p className="mt-2 rounded-xl bg-sun-light/70 px-3 py-2 text-[0.85rem] font-medium">Επιβίβαση στον Πόρο: {persons(detail.totals.poros)}</p>}
              {passengers.length === 0 ? (
                <p className="mt-3 text-[0.9rem] text-ink-mute">Καμία ηλεκτρονική κράτηση ακόμη για αυτή την ημερομηνία.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {passengers.map((b) => (
                    <li key={b.ref} className={`rounded-xl p-3 text-[0.88rem] ring-1 ${b.status === 'REFUND_DUE' ? 'bg-terra-light/40 ring-terra/30' : 'bg-white ring-ink/5'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-semibold">
                          {b.name} <span className="font-mono text-[0.8rem] text-ink-mute">{b.ref}</span>
                        </p>
                        {bookingBadge(b.status)}
                      </div>
                      <p className="text-ink-mute">
                        {party(b)} · {b.pickup === 'poros' ? `Πόρος ${times?.poros?.depart ?? ''}` : `Σκάλα ${times?.skala.depart ?? ''}`}
                      </p>
                      <p className="text-ink-mute">
                        {eur(b.total)} · {paymentLine(b)}
                        {b.discountKind !== 'none' && ` · ${DISCOUNT[b.discountKind]}`}
                      </p>
                      {(b.hotel || b.notes) && <p className="mt-1 text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ')}</p>}
                      {b.attention.map((a) => (
                        <p key={a} className="mt-1 text-[0.8rem] font-semibold text-terra-deep">
                          {ATTENTION[a] ?? a}
                        </p>
                      ))}
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <a href={telHref(b.phone)} className="inline-flex items-center gap-1.5 font-medium text-sea-deep hover:text-ink">
                          <Phone className="h-3.5 w-3.5" /> {b.phone}
                        </a>
                        <a href={`mailto:${b.email}`} className="break-all text-ink-mute hover:text-ink">
                          {b.email}
                        </a>
                      </p>
                      <BookingActions booking={b} departures={departures} today={today} notify={notify} onChange={changed} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </m.aside>
    </>
  )
}

/** Refund done, move to another date, send the e-ticket again: the actions a booking allows in its current state. */
function BookingActions({ booking: b, departures, today, notify, onChange }: { booking: AdminBooking; departures: AdminDeparture[]; today: string; notify: Notify; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [target, setTarget] = useState('')
  if (b.status !== 'PAID' && b.status !== 'REFUND_DUE') return null

  // dates of the same cruise this booking fits in; the same date only to restore a booking whose cancelled departure was reopened
  const options = departures.filter(
    (d) => d.cruise === b.cruise && d.date >= today && d.onSchedule && d.status !== 'cancelled' && d.status !== 'past' && (d.date !== b.date || b.status === 'REFUND_DUE') && d.left >= b.seats,
  )
  const run = async (what: string, fn: () => Promise<string>) => {
    setBusy(what)
    try {
      notify(await fn())
      setMoving(false)
      onChange()
    } catch (e) {
      notify(errorText(e), 'error')
    }
    setBusy(null)
  }
  const refunded = () => {
    if (!window.confirm(`Επιβεβαιώνετε ότι επιστρέψατε ${eur(b.total)} στην κάρτα του επιβάτη ${b.name} (${b.ref}) από την τράπεζα;`)) return
    run('refunded', async () => {
      await adminApi.refunded(b.ref)
      return `Η κράτηση ${b.ref} σημειώθηκε ως «Επιστράφηκαν».`
    })
  }
  const move = () => {
    if (!target) return
    run('move', async () => {
      const r = await adminApi.move(b.ref, target)
      return `Η κράτηση ${b.ref} μεταφέρθηκε στις ${fmtISO(target, { day: 'numeric', month: 'long' })}. ${r.delivery.sent ? 'Το νέο e-ticket στάλθηκε.' : 'Το νέο e-ticket θα σταλεί σε λίγο.'}`
    })
  }
  const resend = () =>
    run('resend', async () => {
      await adminApi.resend(b.ref)
      return `Το e-ticket της κράτησης ${b.ref} στάλθηκε ξανά στο ${b.email}.`
    })

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {b.status === 'REFUND_DUE' && (
          <button type="button" disabled={!!busy} onClick={refunded} className="btn bg-terra px-3.5 py-2 text-[0.82rem] text-white hover:bg-terra-deep">
            {busy === 'refunded' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Έγινε η επιστροφή
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => setMoving((v) => !v)} aria-expanded={moving} className="btn btn-ghost bg-white px-3.5 py-2 text-[0.82rem]">
          <ArrowRightLeft className="h-3.5 w-3.5" /> {b.status === 'REFUND_DUE' ? 'Νέα ημερομηνία' : 'Μεταφορά'}
        </button>
        {b.status === 'PAID' && (
          <button type="button" disabled={!!busy} onClick={resend} className="btn btn-ghost bg-white px-3.5 py-2 text-[0.82rem]">
            {busy === 'resend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Αποστολή e-ticket ξανά
          </button>
        )}
      </div>
      {moving && (
        <div className="mt-3 rounded-xl bg-sand p-3">
          {options.length === 0 ? (
            <p className="text-[0.85rem] text-ink-mute">Δεν υπάρχει άλλη ημερομηνία αυτής της κρουαζιέρας με {persons(b.seats)} ελεύθερες θέσεις.</p>
          ) : (
            <>
              <label className="label" htmlFor={`move-${b.ref}`}>
                Νέα ημερομηνία ({persons(b.seats)})
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <select id={`move-${b.ref}`} className="field appearance-none pr-9" value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">Επιλέξτε…</option>
                    {options.map((d) => (
                      <option key={d.date} value={d.date}>
                        {fmtISO(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {d.left} ελεύθερες{d.date === b.date ? ' (ίδια ημερομηνία)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
                </div>
                <button type="button" disabled={!target || !!busy} onClick={move} className="btn btn-primary px-4 py-3">
                  {busy === 'move' && <Loader2 className="h-4 w-4 animate-spin" />} Μεταφορά
                </button>
              </div>
              <p className="mt-2 text-[0.78rem] text-ink-mute">Ο επιβάτης λαμβάνει νέο e-ticket με τη νέα ημερομηνία.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ----- Schedule and fares --------------------------------------------------------------------------------

function Schedule({ settings, onSaved, notify }: { settings: Settings; onSaved: (s: Settings) => void; notify: Notify }) {
  // the routes that call at Poros, with their saved return to Skala: a card notes when its route comes back earlier than all the others
  const porosKeys = settings.cruises.filter((c) => c.times.poros).map((c) => c.key)
  const earliestOther = (key: string) =>
    settings.cruises
      .filter((c) => c.key !== key && porosKeys.includes(c.key))
      .map((c) => c.returnSkala)
      .sort()[0]
  return (
    <div className="space-y-5">
      {/* the days, times and fares are the 2026 ones (kefalonia-cruises.gr) until the Captain confirms 2027 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-sun-light p-4 ring-1 ring-sun/40">
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[0.82rem] font-semibold text-white">
          <AlertTriangle className="h-4 w-4 shrink-0 text-sun" aria-hidden="true" /> Πρόγραμμα 2027 – προς επιβεβαίωση
        </span>
        <p className="min-w-0 flex-1 basis-64 text-[0.88rem] text-ink-soft">Μέχρι να επιβεβαιωθεί το πρόγραμμα του 2027, εμφανίζονται οι ημέρες, οι ώρες και οι τιμές του 2026.</p>
      </div>
      <SeasonCard season={settings.season} onSaved={onSaved} notify={notify} />
      <div className="grid gap-5 lg:grid-cols-2">
        {settings.cruises.map((c) => (
          <ScheduleCard key={c.key} cfg={c} maxCapacity={settings.boatCapacity} earliestOther={earliestOther(c.key)} onSaved={onSaved} notify={notify} />
        ))}
      </div>
    </div>
  )
}

function SeasonCard({ season, onSaved, notify }: { season: Settings['season']; onSaved: (s: Settings) => void; notify: Notify }) {
  const [draft, setDraft] = useState(season)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saved = `${season.start}|${season.end}`
  useEffect(() => setDraft({ start: saved.split('|')[0], end: saved.split('|')[1] }), [saved])
  const dirty = `${draft.start}|${draft.end}` !== saved
  const valid = !!fromISO(draft.start) && !!fromISO(draft.end) && draft.end > draft.start
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      onSaved(await adminApi.saveSeason(draft))
      notify('Η περίοδος αποθηκεύτηκε.')
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(false)
  }
  return (
    <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl">Περίοδος κρουαζιερών</h2>
          <p className="mt-1 text-[0.85rem] text-ink-mute">Οι επισκέπτες μπορούν να κλείσουν θέσεις μόνο μέσα σε αυτές τις ημερομηνίες.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="season-start">
              Από
            </label>
            <input id="season-start" type="date" className="field" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="season-end">
              Έως
            </label>
            <input id="season-end" type="date" className={`field ${valid ? '' : 'ring-2 ring-terra'}`} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} aria-invalid={!valid} />
          </div>
          <button type="button" disabled={!dirty || !valid || busy} onClick={save} className="btn btn-primary py-3.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Αποθήκευση
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-[0.82rem] text-terra-deep" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type Draft = Pick<CruiseSetting, 'weekdays' | 'depart' | 'returnSkala' | 'adult' | 'child' | 'capacity' | 'active'>
const draftOf = (c: CruiseSetting): Draft => ({ weekdays: [...c.weekdays].sort(), depart: c.depart, returnSkala: c.returnSkala, adult: c.adult, child: c.child, capacity: c.capacity, active: c.active })

function scheduleErrors(d: Draft, maxCapacity: number) {
  const e: Record<string, string> = {}
  if (d.active && d.weekdays.length === 0) e.weekdays = 'Επιλέξτε τουλάχιστον μία ημέρα.'
  if (!isTime(d.depart)) e.depart = 'Ώρα σε μορφή 09:00.'
  if (!isTime(d.returnSkala)) e.returnSkala = 'Ώρα σε μορφή 17:45.'
  else if (isTime(d.depart) && d.returnSkala <= d.depart) e.returnSkala = 'Η επιστροφή πρέπει να είναι μετά την αναχώρηση.'
  if (!Number.isFinite(d.adult) || d.adult < 1 || d.adult > 1000) e.adult = 'Από 1 έως 1.000 €.'
  if (!Number.isFinite(d.child) || d.child < 0 || d.child > 1000) e.child = 'Από 0 έως 1.000 €.'
  if (!Number.isFinite(d.capacity) || d.capacity < 1 || d.capacity > maxCapacity) e.capacity = `Από 1 έως ${maxCapacity} άτομα.`
  return e
}

function TimeSelect({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const options = TIMES.includes(value) || !isTime(value) ? TIMES : [...TIMES, value].sort()
  return (
    <div className="relative">
      <select id={id} className={`field appearance-none pr-9 tabular-nums ${invalid ? 'ring-2 ring-terra' : ''}`} value={isTime(value) ? value : ''} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
        {!isTime(value) && <option value="">—</option>}
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
    </div>
  )
}

function ScheduleCard({ cfg, maxCapacity, earliestOther, onSaved, notify }: { cfg: CruiseSetting; maxCapacity: number; earliestOther?: string; onSaved: (s: Settings) => void; notify: Notify }) {
  const id = cfg.key
  const saved = JSON.stringify(draftOf(cfg))
  const [draft, setDraft] = useState<Draft>(() => draftOf(cfg))
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  // reset the draft only when the saved values really change (not on every refresh)
  useEffect(() => setDraft(JSON.parse(saved) as Draft), [saved])
  const cruise = cruiseOf(id)
  const times = cruise ? pickupTimes(cruise, draft) : undefined
  // e.g. Ithaca: Vathi, back an hour before the other routes that call at Poros
  const earlier = !!times?.hasPoros && !!earliestOther && isTime(draft.returnSkala) && draft.returnSkala < earliestOther
  const dirty = JSON.stringify(draft) !== saved
  const errors = scheduleErrors(draft, maxCapacity)
  const valid = Object.keys(errors).length === 0
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${id}-${k}-err`} className="mt-1 text-[0.78rem] text-terra-deep">
        {errors[k]}
      </p>
    ) : null
  const num = (v: string) => (v === '' ? NaN : Number(v))
  const round2 = (n: number) => Math.round(n * 100) / 100

  const save = async () => {
    const before = JSON.parse(saved) as Draft
    const patch: Partial<Draft> = {}
    if (JSON.stringify(draft.weekdays) !== JSON.stringify(before.weekdays)) patch.weekdays = draft.weekdays
    if (draft.depart !== before.depart) patch.depart = draft.depart
    if (draft.returnSkala !== before.returnSkala) patch.returnSkala = draft.returnSkala
    if (draft.adult !== before.adult) patch.adult = round2(draft.adult)
    if (draft.child !== before.child) patch.child = round2(draft.child)
    if (draft.capacity !== before.capacity) patch.capacity = Math.round(draft.capacity)
    if (draft.active !== before.active) patch.active = draft.active
    setBusy(true)
    setServerError('')
    try {
      onSaved(await adminApi.saveCruise(id, patch))
      notify('Οι αλλαγές αποθηκεύτηκαν και φαίνονται ήδη στην ιστοσελίδα.')
    } catch (e) {
      setServerError(errorText(e))
    }
    setBusy(false)
  }

  return (
    <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl">{NAMES[id]}</h2>
        <label className="flex cursor-pointer items-center gap-2 text-[0.85rem] font-medium" htmlFor={`${id}-active`}>
          <input id={`${id}-active`} type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-[#0F2430]" />
          Ενεργή
        </label>
      </div>
      {!draft.active && <p className="mt-3 rounded-xl bg-sand px-3.5 py-2.5 text-[0.82rem] text-ink-soft">Ανενεργή: η ιστοσελίδα δείχνει «Δεν πραγματοποιείται αυτή την περίοδο» και ένα κουμπί για WhatsApp, χωρίς ημερολόγιο.</p>}
      <fieldset className="mt-5 min-w-0" aria-describedby={errors.weekdays ? `${id}-weekdays-err` : undefined}>
        <legend className="label">Ημέρες</legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((w) => {
            const on = draft.weekdays.includes(w)
            return (
              <button key={w} type="button" title={DAYS_LONG[w]} aria-label={DAYS_LONG[w]} aria-pressed={on} onClick={() => setDraft({ ...draft, weekdays: on ? draft.weekdays.filter((x) => x !== w) : [...draft.weekdays, w].sort() })} className={`h-10 w-12 rounded-xl text-[0.82rem] font-semibold ${on ? 'bg-sea text-white' : 'bg-sand text-ink-soft hover:bg-sand-deep'}`}>
                {DAYS[w]}
              </button>
            )
          })}
        </div>
        {err('weekdays')}
      </fieldset>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-depart`}>
            Αναχώρηση
          </label>
          <TimeSelect id={`${id}-depart`} value={draft.depart} onChange={(v) => setDraft({ ...draft, depart: v })} invalid={!!errors.depart} />
          {err('depart')}
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-return`}>
            Επιστροφή (Σκάλα)
          </label>
          <TimeSelect id={`${id}-return`} value={draft.returnSkala} onChange={(v) => setDraft({ ...draft, returnSkala: v })} invalid={!!errors.returnSkala} />
          {err('returnSkala')}
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-adult`}>
            Ενήλικας €
          </label>
          <input id={`${id}-adult`} type="number" inputMode="decimal" min={1} step="any" className={`field ${errors.adult ? 'ring-2 ring-terra' : ''}`} value={Number.isFinite(draft.adult) ? draft.adult : ''} onChange={(e) => setDraft({ ...draft, adult: num(e.target.value) })} aria-invalid={!!errors.adult} />
          {err('adult')}
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-child`}>
            Παιδί 4–11 €
          </label>
          <input id={`${id}-child`} type="number" inputMode="decimal" min={0} step="any" className={`field ${errors.child ? 'ring-2 ring-terra' : ''}`} value={Number.isFinite(draft.child) ? draft.child : ''} onChange={(e) => setDraft({ ...draft, child: num(e.target.value) })} aria-invalid={!!errors.child} />
          {err('child')}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 min-w-0">
          <label className="label" htmlFor={`${id}-capacity`}>
            Θέσεις ανά αναχώρηση
          </label>
          <input id={`${id}-capacity`} type="number" inputMode="numeric" min={1} max={maxCapacity} className={`field ${errors.capacity ? 'ring-2 ring-terra' : ''}`} value={Number.isFinite(draft.capacity) ? draft.capacity : ''} onChange={(e) => setDraft({ ...draft, capacity: num(e.target.value) })} aria-invalid={!!errors.capacity} />
          {err('capacity')}
        </div>
        <p className="col-span-2 self-end pb-2 text-[0.78rem] text-ink-mute">Τα βρέφη (κάτω των 4) ταξιδεύουν δωρεάν αλλά πιάνουν θέση.</p>
      </div>
      {earlier && times && (
        <p className="mt-4 flex gap-2 rounded-xl bg-sand px-3.5 py-2.5 text-[0.82rem] text-ink-soft">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />
          <span>
            Επιστρέφει νωρίτερα από τις άλλες διαδρομές με στάση στον Πόρο: <strong className="whitespace-nowrap font-semibold tabular-nums text-ink">Πόρος {times.poros.back}, Σκάλα {times.skala.back}</strong>.
          </span>
        </p>
      )}
      {serverError && (
        <p className="mt-4 flex gap-2 rounded-xl bg-terra-light px-3.5 py-2.5 text-[0.82rem] text-terra-deep" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {serverError}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!dirty || !valid || busy} onClick={save} className="btn btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Αποθήκευση
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setDraft(JSON.parse(saved) as Draft)
              setServerError('')
            }}
            className="text-[0.85rem] font-medium text-ink-mute hover:text-ink"
          >
            Αναίρεση αλλαγών
          </button>
        )}
      </div>
    </div>
  )
}

// ----- Bookings ------------------------------------------------------------------------------------------

type Filter = 'all' | BookingStatus | 'attention'
const FILTERS: { k: Filter; label: string }[] = [
  { k: 'all', label: 'Όλες' },
  { k: 'PAID', label: 'Πληρωμένες' },
  { k: 'REFUND_DUE', label: 'Οφείλεται επιστροφή' },
  { k: 'attention', label: 'Χρειάζονται έλεγχο' },
  { k: 'PENDING_PAYMENT', label: 'Σε αναμονή πληρωμής' },
  { k: 'REFUNDED', label: 'Επιστράφηκαν' },
  { k: 'CANCELLED', label: 'Ακυρωμένες' },
]

function SectionHead({ icon: Icon, title, count, onCsv, tone }: { icon: typeof Ship; title: string; count: number; onCsv?: () => void; tone: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-2xl">
        <Icon className={`h-5 w-5 ${tone}`} /> {title} <span className="text-[1rem] text-ink-mute">({count})</span>
      </h2>
      {onCsv && (
        <button type="button" onClick={onCsv} disabled={!count} className="btn btn-ghost bg-white py-2.5">
          <Download className="h-4 w-4" /> CSV
        </button>
      )}
    </div>
  )
}

function Bookings({ filter, setFilter, departures, today, notify, onChange }: { filter: Filter; setFilter: (f: Filter) => void; departures: AdminDeparture[]; today: string; notify: Notify; onChange: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminBooking[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const n = ++seq.current
    try {
      const r = await adminApi.bookings({ q: q.trim() || undefined, status: filter !== 'all' && filter !== 'attention' ? filter : undefined, attention: filter === 'attention' })
      if (n === seq.current) {
        setRows(r.bookings)
        setFailed(false)
      }
    } catch (e) {
      if (n === seq.current && !(e instanceof AdminApiError && e.status === 401)) setFailed(true)
    }
  }, [q, filter])
  // search as the owner types, a moment after the last key
  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, q])
  const changed = () => {
    load()
    onChange()
  }

  const list = rows ?? []
  const csv = () =>
    downloadCsv('kratiseis-krouazieron.csv', [
      ['Κωδικός', 'Κρουαζιέρα', 'Ημερομηνία', 'Κατάσταση', 'Επιβίβαση', 'Όνομα', 'E-mail', 'Τηλέφωνο', 'Ενήλικες', 'Παιδιά', 'Βρέφη', 'Θέσεις', 'Υποσύνολο €', 'Έκπτωση', 'Έκπτωση €', 'Σύνολο €', 'Πληρώθηκε', 'Κατάλυμα', 'Σημειώσεις', 'Γλώσσα', 'Καταχώριση'],
      ...list.map((b) => [
        b.ref,
        NAMES[b.cruise],
        b.date,
        BOOKING_STATUS[b.status][0],
        b.pickup === 'poros' ? 'Πόρος' : 'Σκάλα',
        b.name,
        b.email,
        b.phone,
        b.adults,
        b.children,
        b.infants,
        b.seats,
        b.subtotal,
        DISCOUNT[b.discountKind] ?? '',
        b.discount,
        b.total,
        b.paidAt ?? '',
        b.hotel,
        b.notes,
        LANG[b.lang] ?? b.lang,
        b.createdAt,
      ]),
    ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση ονόματος, κωδικού, e-mail ή τηλεφώνου" aria-label="Αναζήτηση κρατήσεων" className="field max-w-md" />
      </div>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Φίλτρο κατάστασης">
        {FILTERS.map((f) => (
          <button key={f.k} type="button" onClick={() => setFilter(f.k)} aria-pressed={filter === f.k} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.82rem] font-medium ${filter === f.k ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-ink/10 hover:bg-sand-paper'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <section>
        <SectionHead icon={Ship} title="Κρουαζιέρες" count={list.length} onCsv={csv} tone="text-sea" />
        {failed && (
          <p className="mt-3 text-terra-deep" role="alert">
            Δεν ήταν δυνατή η φόρτωση των κρατήσεων.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Δοκιμάστε ξανά
            </button>
          </p>
        )}
        {!rows && !failed ? (
          <div className="grid place-items-center py-16 text-ink-mute" role="status" aria-label="Φόρτωση">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="mt-3 text-ink-mute">{q || filter !== 'all' ? 'Καμία κράτηση δεν ταιριάζει με την αναζήτηση.' : 'Δεν υπάρχουν ακόμη ηλεκτρονικές κρατήσεις. Μόλις κλείσει κάποιος θέσεις στην ιστοσελίδα, θα εμφανιστούν εδώ.'}</p>
        ) : (
          <>
            {/* phones: stacked cards */}
            <ul className="mt-4 grid gap-3 md:hidden">
              {list.map((b) => (
                <li key={b.ref} className={`rounded-xl2 p-4 shadow-soft ring-1 ${b.status === 'REFUND_DUE' ? 'bg-terra-light/50 ring-terra/30' : 'bg-white ring-ink/5'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{b.name}</p>
                      <p className="font-mono text-[0.8rem] text-ink-mute">{b.ref}</p>
                    </div>
                    {bookingBadge(b.status)}
                  </div>
                  <p className="mt-2 text-[0.9rem]">
                    {NAMES[b.cruise]} · {fmtISO(b.date)}
                  </p>
                  <p className="text-[0.85rem] text-ink-mute">
                    {party(b)} · {b.pickup === 'poros' ? 'Πόρος' : 'Σκάλα'}
                  </p>
                  <p className="text-[0.85rem] text-ink-mute">
                    {eur(b.total)} · {paymentLine(b)}
                  </p>
                  {(b.hotel || b.notes) && <p className="mt-1 text-[0.85rem] text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ')}</p>}
                  {b.attention.map((a) => (
                    <p key={a} className="mt-1 text-[0.8rem] font-semibold text-terra-deep">
                      {ATTENTION[a] ?? a}
                    </p>
                  ))}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.88rem]">
                    <a href={telHref(b.phone)} className="inline-flex items-center gap-1.5 font-medium text-sea-deep">
                      <Phone className="h-3.5 w-3.5" /> {b.phone}
                    </a>
                    <a href={`mailto:${b.email}`} className="break-all text-ink-mute">
                      {b.email}
                    </a>
                  </p>
                  <BookingActions booking={b} departures={departures} today={today} notify={notify} onChange={changed} />
                </li>
              ))}
            </ul>
            {/* tablet and desktop: table */}
            <div className="mt-4 hidden overflow-x-auto rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 md:block">
              <table className="w-full min-w-[980px] text-left text-[0.88rem]">
                <thead className="border-b border-line text-[0.72rem] uppercase tracking-wider text-ink-mute">
                  <tr>
                    {['Κωδικός', 'Κρουαζιέρα', 'Επιβάτης', 'Άτομα', 'Επιβίβαση', 'Πληρωμή', 'Σημειώσεις', ''].map((h, i) => (
                      <th key={i} className="p-4 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <BookingRow key={b.ref} b={b} open={open === b.ref} onToggle={() => setOpen(open === b.ref ? null : b.ref)} departures={departures} today={today} notify={notify} onChange={changed} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function BookingRow({ b, open, onToggle, departures, today, notify, onChange }: { b: AdminBooking; open: boolean; onToggle: () => void; departures: AdminDeparture[]; today: string; notify: Notify; onChange: () => void }) {
  const actionable = b.status === 'PAID' || b.status === 'REFUND_DUE'
  return (
    <>
      <tr className={`border-b border-line align-top last:border-0 ${b.status === 'REFUND_DUE' ? 'bg-terra-light/40' : ''}`}>
        <td className="p-4">
          <span className="font-mono">{b.ref}</span>
          <span className="mt-1 block">{bookingBadge(b.status)}</span>
        </td>
        <td className="p-4">
          {NAMES[b.cruise]}
          <span className="block text-ink-mute">{fmtISO(b.date)}</span>
          {b.movedFrom && <span className="block text-[0.78rem] text-ink-mute">Αρχικά {fmtISO(b.movedFrom)}</span>}
        </td>
        <td className="p-4">
          {b.name}
          <a href={telHref(b.phone)} className="block text-[0.8rem] text-sea-deep hover:text-ink">
            {b.phone}
          </a>
          <a href={`mailto:${b.email}`} className="block break-all text-[0.8rem] text-ink-mute hover:text-ink">
            {b.email}
          </a>
        </td>
        <td className="p-4">
          <span className="tabular-nums">{persons(b.seats)}</span>
          <span className="block text-[0.8rem] text-ink-mute">{party(b)}</span>
        </td>
        <td className="p-4">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[0.78rem] font-semibold ${b.pickup === 'poros' ? 'bg-sun-light text-ink' : 'bg-sea-mist text-sea-deep'}`}>{b.pickup === 'poros' ? 'Πόρος' : 'Σκάλα'}</span>
        </td>
        <td className="p-4 tabular-nums">
          {eur(b.total)}
          <span className="block text-[0.8rem] text-ink-mute">{paymentLine(b)}</span>
          {b.discountKind !== 'none' && <span className="block text-[0.8rem] text-ink-mute">{DISCOUNT[b.discountKind]}</span>}
          {b.attention.map((a) => (
            <span key={a} className="mt-1 block text-[0.78rem] font-semibold text-terra-deep">
              {ATTENTION[a] ?? a}
            </span>
          ))}
        </td>
        <td className="max-w-[220px] p-4 text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ') || '—'}</td>
        <td className="p-4 text-right">
          {actionable && (
            <button type="button" onClick={onToggle} aria-expanded={open} className="btn btn-ghost whitespace-nowrap px-3.5 py-2 text-[0.82rem]">
              Ενέργειες <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </td>
      </tr>
      {open && actionable && (
        <tr className="border-b border-line bg-sand-paper">
          <td colSpan={8} className="px-4 pb-4">
            <BookingActions booking={b} departures={departures} today={today} notify={notify} onChange={onChange} />
          </td>
        </tr>
      )}
    </>
  )
}

// ----- Requests (BBQ, private, wedding) --------------------------------------------------------------------

const REQUEST_STATUS: Record<RequestStatus, [string, string]> = {
  new: ['Νέο', 'bg-terra-light text-terra-deep'],
  answered: ['Απαντήθηκε', 'bg-sea-mist text-sea-deep'],
  closed: ['Έκλεισε', 'bg-sand text-ink-mute'],
}

function Requests({ notify, onChange }: { notify: Notify; onChange: () => void }) {
  const [rows, setRows] = useState<CruiseRequestRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setRows((await adminApi.requests()).requests)
      setFailed(false)
    } catch (e) {
      if (!(e instanceof AdminApiError && e.status === 401)) setFailed(true)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const setStatus = async (r: CruiseRequestRow, status: RequestStatus) => {
    setBusy(r.ref)
    try {
      const { request } = await adminApi.setRequest(r.ref, status)
      setRows((list) => (list ?? []).map((x) => (x.ref === r.ref ? { ...x, ...request } : x)))
      notify(`Το αίτημα ${r.ref}: «${REQUEST_STATUS[status][0]}».`)
      onChange()
    } catch (e) {
      notify(errorText(e), 'error')
    }
    setBusy(null)
  }
  const list = (rows ?? []).filter((r) => filter === 'all' || r.status === filter)
  const csv = () =>
    downloadCsv('aitimata-krouazieron.csv', [
      ['Κωδικός', 'Κρουαζιέρα', 'Ημερομηνία', 'Άτομα', 'Όνομα', 'E-mail', 'Τηλέφωνο', 'Μήνυμα', 'Γλώσσα', 'Κατάσταση', 'Καταχώριση'],
      ...list.map((r) => [r.ref, NAMES[r.cruise] ?? r.cruise, r.date, r.people, r.name, r.email, r.phone, r.message, LANG[r.lang] ?? r.lang, REQUEST_STATUS[r.status]?.[0] ?? r.status, r.createdAt]),
    ])

  return (
    <div className="space-y-6">
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Φίλτρο κατάστασης">
        {(
          [
            ['all', 'Όλα'],
            ['new', 'Νέα'],
            ['answered', 'Απαντήθηκαν'],
            ['closed', 'Έκλεισαν'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.82rem] font-medium ${filter === k ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-ink/10 hover:bg-sand-paper'}`}>
            {label}
          </button>
        ))}
      </div>
      <section>
        <SectionHead icon={MessageSquare} title="Αιτήματα (μπάρμπεκιου, ιδιωτικές, γάμοι)" count={list.length} onCsv={csv} tone="text-sun" />
        {failed && (
          <p className="mt-3 text-terra-deep" role="alert">
            Δεν ήταν δυνατή η φόρτωση των αιτημάτων.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Δοκιμάστε ξανά
            </button>
          </p>
        )}
        {!rows && !failed ? (
          <div className="grid place-items-center py-16 text-ink-mute" role="status" aria-label="Φόρτωση">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="mt-3 text-ink-mute">{filter === 'all' ? 'Δεν υπάρχουν ακόμη αιτήματα από τις σελίδες μπάρμπεκιου, ιδιωτικών κρουαζιερών και γάμων.' : 'Κανένα αίτημα σε αυτή την κατάσταση.'}</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {list.map((r) => (
              <li key={r.ref} className={`rounded-xl2 p-5 shadow-soft ring-1 ${r.status === 'new' ? 'bg-white ring-terra/30' : 'bg-white ring-ink/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.85rem] text-ink-mute">{r.ref}</p>
                    <p className="font-semibold">{r.name}</p>
                  </div>
                  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-semibold ${REQUEST_STATUS[r.status]?.[1] ?? ''}`}>{REQUEST_STATUS[r.status]?.[0] ?? r.status}</span>
                </div>
                <p className="text-[0.9rem] text-ink-soft">
                  {NAMES[r.cruise] ?? r.cruise} · {r.date ? fmtISO(r.date) : 'χωρίς ημερομηνία'} · {persons(r.people)}
                </p>
                <p className="text-[0.8rem] text-ink-mute">Ελήφθη {fmtTime(r.createdAt)}</p>
                {r.message && <p className="mt-2 whitespace-pre-line text-[0.88rem] text-ink-soft">{r.message}</p>}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem]">
                  <a href={telHref(r.phone)} className="inline-flex items-center gap-1.5 font-medium text-sea-deep hover:text-ink">
                    <Phone className="h-3.5 w-3.5" /> {r.phone}
                  </a>
                  <a href={`mailto:${r.email}`} className="break-all text-ink-mute hover:text-ink">
                    {r.email}
                  </a>
                  <span className="text-ink-mute">{LANG[r.lang] ?? r.lang}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {(['new', 'answered', 'closed'] as const)
                    .filter((s) => s !== r.status)
                    .map((s) => (
                      <button key={s} type="button" disabled={busy === r.ref} onClick={() => setStatus(r, s)} className="btn btn-ghost bg-white px-3.5 py-2 text-[0.82rem]">
                        {s === 'answered' ? 'Σήμανση: απαντήθηκε' : s === 'closed' ? 'Κλείσιμο' : 'Επαναφορά σε νέο'}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
