'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  AlertTriangle, Anchor, BedDouble, CalendarDays, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, CloudRain, Download, ExternalLink, LayoutDashboard,
  ListChecks, LogOut, MessageSquare, Phone, RotateCcw, Save, Settings2, Ship, Users, Wind, X,
} from 'lucide-react'
import { LogoMark } from '@/components/layout/Logo'
import { cruises, scheduledCruises, type CruiseKey } from '@/data/cruises'
import { properties } from '@/data/properties'
import elCruises from '@/content/el/cruises.json'
import elUnits from '@/content/el/units.json'
import {
  CAPACITY, depId, departureState, isTime, pickupTimes, resetStore, sailingDates, seatsOf, seatsSold, useStore,
  type CruiseBooking, type CruiseConfig, type DepartureState, type Store,
} from '@/lib/cruiseStore'
import { fromISO, nightsBetween, SEASON_START, toISO } from '@/lib/dates'

const NAMES = Object.fromEntries(Object.entries(elCruises.list as Record<string, { name: string }>).map(([k, v]) => [k, v.name])) as Record<string, string>
const UNIT_NAMES = Object.fromEntries(Object.entries(elUnits as Record<string, { name?: string }>).map(([k, v]) => [k, v?.name ?? k]))
/** Short codes for the month grid on phones, where the full names do not fit. */
const CODES: Record<string, string> = { fiscardo: 'ΦΙΣ', ithacaVathiKioni: 'ΙΘ·Κ', ithacaVathi: 'ΙΘ·Β', zakynthos: 'ΖΑΚ' }
const ACCENT = Object.fromEntries(cruises.map((c) => [c.key, c.accent])) as Record<string, string>
const DAYS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ']
const DAYS_LONG = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
const LANG: Record<string, string> = { en: 'Αγγλικά', el: 'Ελληνικά', it: 'Ιταλικά' }
const fmt = (d: Date, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('el-GR', o).format(d)
const eur = (n: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const persons = (n: number) => plural(n, 'άτομο', 'άτομα')
const party = (b: { adults: number; children: number; infants?: number }) =>
  [plural(b.adults, 'ενήλικας', 'ενήλικες'), b.children ? plural(b.children, 'παιδί', 'παιδιά') : '', b.infants ? plural(b.infants, 'βρέφος', 'βρέφη') : ''].filter(Boolean).join(' · ')
const cruiseOf = (key: string) => cruises.find((c) => c.key === key)
const pickupOf = (store: Store, b: CruiseBooking) => {
  const c = cruiseOf(b.cruise)
  const time = c ? pickupTimes(c, store.config[b.cruise])[b.pickup].depart : ''
  return `${b.pickup === 'poros' ? 'Πόρος' : 'Σκάλα'} ${time}`.trim()
}
const stateOf = (store: Store, b: CruiseBooking) => {
  const d = fromISO(b.date)
  return d ? departureState(store, b.cruise, d) : undefined
}
/** Bookings whose departure the Captain has cancelled: these guests need a call and a refund or a new date. */
const needsContact = (store: Store) => store.bookings.filter((b) => stateOf(store, b)?.status === 'cancelled')

/** What Tab can reach inside the departure panel. */
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 24-hour times in 15-minute steps for the schedule (native time inputs show AM/PM in some browsers). */
const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => `${String(6 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

/** Guests type the names, hotels, notes and messages: a cell starting with =, +, - or @ would run as a formula in Excel, so it gets a leading apostrophe. */
const csvSafe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)

function downloadCsv(filename: string, rows: (string | number | undefined)[][]) {
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

type Tab = 'today' | 'calendar' | 'schedule' | 'bookings'
type Dep = { cruise: CruiseKey; state: DepartureState }
type SetStatus = (d: Dep, s: 'open' | 'cancelled' | 'closed', note?: string) => void

export function AdminApp() {
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const { store, update, ready } = useStore()
  const [selected, setSelected] = useState<Dep | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    try {
      setAuthed(sessionStorage.getItem('cv-admin') === '1')
    } catch {}
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(id)
  }, [toast])

  const departures = useMemo<Dep[]>(() => {
    if (!ready) return []
    return scheduledCruises
      .flatMap((c) => sailingDates(store, c.key).map((d) => ({ cruise: c.key, state: departureState(store, c.key, d) })))
      .sort((a, b) => a.state.date.getTime() - b.state.date.getTime())
  }, [store, ready])

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  const setStatus: SetStatus = (dep, status, note) => {
    const id = depId(dep.cruise, dep.state.date)
    update((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...s.overrides[id], status, note, updatedAt: new Date().toISOString() } } }))
    const affected = store.bookings.filter((b) => b.cruise === dep.cruise && b.date === toISO(dep.state.date)).length
    setToast(
      status === 'cancelled'
        ? affected
          ? `Η αναχώρηση ακυρώθηκε. Επικοινωνήστε με τους επιβάτες: ${plural(affected, 'κράτηση', 'κρατήσεις')}.`
          : 'Η αναχώρηση ακυρώθηκε και έκλεισε στην ιστοσελίδα.'
        : status === 'closed'
          ? 'Οι κρατήσεις έκλεισαν για αυτή την αναχώρηση.'
          : 'Η αναχώρηση άνοιξε ξανά.',
    )
    setSelected(null)
  }

  const nav: { k: Tab; label: string; icon: typeof Ship; badge?: number }[] = [
    { k: 'today', label: 'Επόμενες', icon: LayoutDashboard },
    { k: 'calendar', label: 'Ημερολόγιο', icon: CalendarDays },
    { k: 'schedule', label: 'Πρόγραμμα & τιμές', icon: Settings2 },
    { k: 'bookings', label: 'Κρατήσεις', icon: ListChecks, badge: ready ? needsContact(store).length : 0 },
  ]

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
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-white"
              aria-label="Αποσύνδεση"
              onClick={() => {
                try {
                  sessionStorage.removeItem('cv-admin')
                } catch {}
                setAuthed(false)
              }}
            >
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
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-sea-mist p-4 text-[0.9rem] text-sea-deep">
          <Anchor className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Ανοίξτε την ιστοσελίδα σε άλλη καρτέλα και κάντε μια αλλαγή εδώ: θα τη δείτε αμέσως στη σελίδα κράτησης. Τα στοιχεία αποθηκεύονται σε αυτό το πρόγραμμα περιήγησης.
          </p>
        </div>
        {tab === 'today' && <Upcoming departures={departures} store={store} onOpen={setSelected} onStatus={setStatus} onBookings={() => setTab('bookings')} />}
        {tab === 'calendar' && <MonthCalendar departures={departures} store={store} onOpen={setSelected} />}
        {tab === 'schedule' && (
          <Schedule
            store={store}
            onSave={(key, cfg) => {
              update((s) => ({ ...s, config: { ...s.config, [key]: cfg } }))
              setToast('Οι αλλαγές αποθηκεύτηκαν και φαίνονται ήδη στην ιστοσελίδα.')
            }}
          />
        )}
        {tab === 'bookings' && <Bookings store={store} />}

        <div className="mt-12 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Επαναφορά όλων των δεδομένων στην αρχική τους μορφή;')) {
                resetStore()
                setToast('Τα δεδομένα επανήλθαν στην αρχική τους μορφή.')
              }
            }}
            className="inline-flex items-center gap-2 text-[0.85rem] font-medium text-ink-mute hover:text-ink"
          >
            <RotateCcw className="h-4 w-4" /> Επαναφορά αρχικών δεδομένων
          </button>
        </div>
      </main>

      <AnimatePresence>
        {selected && (
          <DeparturePanel
            dep={selected}
            store={store}
            onClose={() => setSelected(null)}
            onStatus={setStatus}
            onCapacity={(cap) => {
              const id = depId(selected.cruise, selected.state.date)
              update((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...s.overrides[id], status: s.overrides[id]?.status ?? 'open', capacity: cap, updatedAt: new Date().toISOString() } } }))
              setToast('Η χωρητικότητα ενημερώθηκε.')
            }}
          />
        )}
      </AnimatePresence>

      {/* centred by a flex wrapper: framer-motion's transform would override a translate-x class on the toast itself */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-[0.9rem] text-white shadow-lift sm:rounded-full" role="status">
              <Check className="h-4 w-4 shrink-0 text-sea-light" /> {toast}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <m.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault()
          try {
            sessionStorage.setItem('cv-admin', '1')
          } catch {}
          onLogin()
        }}
        className="w-full max-w-sm rounded-xl3 bg-sand-paper p-8 shadow-lift"
      >
        <LogoMark className="h-12 w-12 text-ink" />
        <h1 className="mt-5 font-display text-3xl">Καλώς ήρθατε</h1>
        <p className="mt-2 text-[0.95rem] text-ink-soft">Διαχείριση κρουαζιερών και κρατήσεων.</p>
        <label className="label mt-6" htmlFor="pin">
          Κωδικός
        </label>
        <input id="pin" type="password" className="field" placeholder="••••" autoComplete="off" />
        <p className="mt-2 text-[0.8rem] text-ink-mute">Πατήστε «Είσοδος» για να συνεχίσετε.</p>
        <button type="submit" className="btn btn-primary mt-6 w-full py-4">
          Είσοδος
        </button>
      </m.form>
    </div>
  )
}

const STATUS: Record<DepartureState['status'], [string, string]> = {
  open: ['Ανοιχτή', 'bg-sea-mist text-sea-deep'],
  cancelled: ['Ακυρώθηκε', 'bg-terra-light text-terra-deep'],
  closed: ['Κλειστές κρατήσεις', 'bg-sand-deep text-ink-soft'],
  soldout: ['Γεμάτη', 'bg-sun-light text-ink'],
  past: ['Ολοκληρώθηκε', 'bg-sand text-ink-mute'],
}

function statusBadge(s: DepartureState['status']) {
  const [label, cls] = STATUS[s]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-semibold ${cls}`}>{label}</span>
}

const fillColour = (pct: number) => (pct > 90 ? 'bg-terra' : pct > 60 ? 'bg-sun' : 'bg-sea')

function Fill({ sold, cap }: { sold: number; cap: number }) {
  const pct = Math.min(100, Math.round((sold / Math.max(1, cap)) * 100))
  return (
    <div>
      <div className="flex justify-between text-[0.8rem] text-ink-mute">
        <span>
          <strong className="text-ink tabular-nums">{sold}</strong> / {cap} θέσεις
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand">
        <m.div className={`h-full rounded-full ${fillColour(pct)}`} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
    </div>
  )
}

function ContactAlert({ store, onBookings }: { store: Store; onBookings?: () => void }) {
  const list = needsContact(store)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-terra-light p-4 text-[0.92rem] text-terra-deep" role="alert">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {plural(list.length, 'κράτηση είναι', 'κρατήσεις είναι')} σε ακυρωμένες αναχωρήσεις: χρειάζεται επικοινωνία με τους επιβάτες και επιστροφή χρημάτων ή νέα ημερομηνία.
      </p>
      {onBookings && (
        <button type="button" onClick={onBookings} className="btn btn-ghost bg-white py-2.5">
          Δείτε τις κρατήσεις
        </button>
      )}
    </div>
  )
}

function Upcoming({ departures, store, onOpen, onStatus, onBookings }: { departures: Dep[]; store: Store; onOpen: (d: Dep) => void; onStatus: SetStatus; onBookings: () => void }) {
  const next = departures.filter((d) => d.state.status !== 'past').slice(0, 9)
  // the hero shows the next departure that actually sails; cancelled ones stay in the list with their badge
  const first = next.find((d) => d.state.status === 'open' || d.state.status === 'soldout') ?? next[0]
  const rest = next.filter((d) => d !== first)
  const firstCruise = first ? cruiseOf(first.cruise) : undefined
  const times = firstCruise ? pickupTimes(firstCruise, store.config[first!.cruise]) : undefined
  return (
    <div className="space-y-6">
      <ContactAlert store={store} onBookings={onBookings} />
      <div className="grid gap-6 lg:grid-cols-3">
        {first && times && (
          <div className="rounded-xl3 bg-ink p-6 text-white shadow-lift sm:p-7 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-white/60">Επόμενη αναχώρηση</p>
              {first.state.status !== 'open' && statusBadge(first.state.status)}
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <p className="font-display text-3xl">{NAMES[first.cruise]}</p>
                <p className="mt-1 text-white/70">
                  {fmt(first.state.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {times.skala.depart} από τη Σκάλα
                  {times.hasPoros && ` · ${times.poros.depart} από τον Πόρο`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpen(first)} className="btn bg-white text-ink hover:bg-sand">
                  Λεπτομέρειες
                </button>
                {first.state.status === 'cancelled' ? (
                  <button type="button" onClick={() => onStatus(first, 'open')} className="btn btn-ghost-light">
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
              <Fill sold={seatsSold(store, first.cruise, first.state.date)} cap={first.state.capacity} />
            </div>
          </div>
        )}
        {rest.map((d) => (
          <button
            key={depId(d.cruise, d.state.date)}
            type="button"
            onClick={() => onOpen(d)}
            className={`rounded-xl2 p-5 text-left shadow-soft ring-1 transition hover:-translate-y-0.5 hover:shadow-lift ${d.state.status === 'cancelled' ? 'bg-terra-light/40 ring-terra/30' : 'bg-white ring-ink/5'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.85rem] font-semibold text-ink-mute">{fmt(d.state.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              {statusBadge(d.state.status)}
            </div>
            <p className="mt-2 font-display text-xl">{NAMES[d.cruise]}</p>
            <div className="mt-4">
              <Fill sold={seatsSold(store, d.cruise, d.state.date)} cap={d.state.capacity} />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function MonthCalendar({ departures, store, onOpen }: { departures: Dep[]; store: Store; onOpen: (d: Dep) => void }) {
  const [month, setMonth] = useState(new Date(SEASON_START.getFullYear(), SEASON_START.getMonth(), 1))
  const byDay = useMemo(() => {
    const m = new Map<string, Dep[]>()
    for (const d of departures) {
      const k = toISO(d.state.date)
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return m
  }, [departures])
  const first = new Date(month)
  const offset = (first.getDay() + 6) % 7
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
            <div key={i} className="min-h-[64px] min-w-0 rounded-lg bg-sand/50 p-1 md:min-h-[92px] md:rounded-xl md:p-1.5">
              <p className="px-0.5 text-[0.72rem] font-semibold tabular-nums text-ink-mute md:px-1 md:text-[0.78rem]">{c.getDate()}</p>
              {(byDay.get(toISO(c)) ?? []).map((d) => {
                const sold = seatsSold(store, d.cruise, d.state.date)
                const pct = Math.min(100, Math.round((sold / Math.max(1, d.state.capacity)) * 100))
                const cancelled = d.state.status === 'cancelled'
                const tint = cancelled ? 'bg-terra-light text-terra-deep' : d.state.status === 'closed' ? 'bg-sand-deep text-ink-soft' : pct > 90 ? 'bg-terra-light/60 text-ink' : pct > 60 ? 'bg-sun-light/70 text-ink' : 'bg-white text-ink'
                return (
                  <button
                    key={d.cruise}
                    type="button"
                    onClick={() => onOpen(d)}
                    title={`${NAMES[d.cruise]} · ${sold}/${d.state.capacity}`}
                    aria-label={`${NAMES[d.cruise]}, ${fmt(d.state.date, { day: 'numeric', month: 'long' })}, ${cancelled ? 'ακυρώθηκε' : `${pct}% πληρότητα`}`}
                    style={{ borderLeftColor: ACCENT[d.cruise] }}
                    className={`relative mt-1 w-full overflow-hidden rounded-md border-l-2 px-1 pb-1.5 pt-1 text-left text-[0.62rem] font-semibold leading-tight shadow-sm transition hover:ring-2 hover:ring-ink md:rounded-lg md:border-l-0 md:px-1.5 md:text-[0.7rem] ${tint}`}
                  >
                    <span className={`flex items-center gap-1 ${cancelled ? 'line-through' : ''}`}>
                      <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full md:block" style={{ background: ACCENT[d.cruise] }} aria-hidden="true" />
                      <span className="whitespace-nowrap md:hidden">{CODES[d.cruise] ?? NAMES[d.cruise]}</span>
                      <span className="hidden md:line-clamp-2">{NAMES[d.cruise]}</span>
                    </span>
                    {!cancelled && <span className="mt-0.5 block font-normal tabular-nums text-ink-mute">{pct}%</span>}
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
    </div>
  )
}

function DeparturePanel({ dep, store, onClose, onStatus, onCapacity }: { dep: Dep; store: Store; onClose: () => void; onStatus: SetStatus; onCapacity: (n: number) => void }) {
  // read the departure live from the store, so a new capacity or status shows straight away
  const state = departureState(store, dep.cruise, dep.state.date)
  const live: Dep = { cruise: dep.cruise, state }
  const [reason, setReason] = useState('Δυνατός άνεμος')
  const [cap, setCap] = useState(state.capacity)
  const passengers = store.bookings.filter((b) => b.cruise === dep.cruise && b.date === toISO(dep.state.date))
  const sold = seatsSold(store, dep.cruise, dep.state.date)
  const c = cruiseOf(dep.cruise)
  const times = c ? pickupTimes(c, store.config[dep.cruise]) : undefined
  const fromPoros = passengers.filter((b) => b.pickup === 'poros').reduce((n, b) => n + seatsOf(b), 0)
  const capValid = Number.isFinite(cap) && cap >= 1 && cap <= CAPACITY

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
            <p className="text-[0.8rem] font-semibold text-ink-mute">{fmt(state.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h2 id="dep-title" className="mt-1 font-display text-2xl">
              {NAMES[dep.cruise]}
            </h2>
            {times && (
              <p className="mt-1 text-[0.85rem] text-ink-mute">
                Σκάλα {times.skala.depart}
                {times.hasPoros && ` · Πόρος ${times.poros.depart} (κατόπιν αιτήματος)`} · επιστροφή {times.skala.back}
              </p>
            )}
            <div className="mt-2">{statusBadge(state.status)}</div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Κλείσιμο" className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-ink/10 hover:bg-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
          <Fill sold={sold} cap={state.capacity} />
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="cap">
                Χωρητικότητα (άτομα, μαζί με βρέφη)
              </label>
              <input id="cap" type="number" inputMode="numeric" min={1} max={CAPACITY} value={Number.isFinite(cap) ? cap : ''} onChange={(e) => setCap(e.target.valueAsNumber)} className={`field ${capValid ? '' : 'ring-2 ring-terra'}`} aria-invalid={!capValid} />
            </div>
            <button type="button" disabled={!capValid || cap === state.capacity} onClick={() => onCapacity(Math.round(cap))} className="btn btn-primary py-3.5">
              <Save className="h-4 w-4" /> Αποθήκευση
            </button>
          </div>
          {!capValid && <p className="mt-1 text-[0.8rem] text-terra-deep">Από 1 έως {CAPACITY} άτομα (άδεια σκάφους).</p>}
        </div>

        {state.status === 'cancelled' ? (
          <div className="mt-5 rounded-2xl bg-terra-light p-5">
            <p className="flex items-center gap-2 font-semibold text-terra-deep">
              <AlertTriangle className="h-4 w-4" /> Ακυρωμένη: {state.note ?? '—'}
            </p>
            {passengers.length > 0 && <p className="mt-2 text-[0.88rem] text-terra-deep">Επικοινωνήστε με τους επιβάτες παρακάτω για επιστροφή χρημάτων ή αλλαγή ημερομηνίας.</p>}
            <button type="button" onClick={() => onStatus(live, 'open')} className="btn btn-primary mt-4 w-full">
              Άνοιγμα ξανά
            </button>
          </div>
        ) : state.status === 'past' ? null : (
          <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
            <p className="flex items-center gap-2 font-semibold">
              <Wind className="h-4 w-4 text-terra" /> Λόγος ακύρωσης
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Δυνατός άνεμος', 'Υψηλό κύμα', 'Βλάβη / συντήρηση', 'Άλλος λόγος'].map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={`rounded-full px-3 py-1.5 text-[0.82rem] font-medium ${reason === r ? 'bg-ink text-white' : 'bg-sand hover:bg-sand-deep'}`}>
                  {r}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onStatus(live, 'cancelled', reason)} className="btn mt-4 w-full bg-terra text-white hover:bg-terra-deep">
              <CloudRain className="h-4 w-4" /> Ακύρωση αναχώρησης
            </button>
            <button type="button" onClick={() => onStatus(live, state.status === 'closed' ? 'open' : 'closed')} className="btn btn-ghost mt-2 w-full">
              {state.status === 'closed' ? 'Άνοιγμα κρατήσεων' : 'Κλείσιμο κρατήσεων (χωρίς ακύρωση)'}
            </button>
            <p className="mt-3 text-[0.8rem] text-ink-mute">Με την ακύρωση, η ημερομηνία κλείνει αμέσως στην ιστοσελίδα. Ενημερώστε τους επιβάτες από τη λίστα κρατήσεων.</p>
          </div>
        )}

        <div className="mt-5">
          <p className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            <Users className="h-4 w-4" /> Κρατήσεις από την ιστοσελίδα ({passengers.length})
          </p>
          {fromPoros > 0 && <p className="mt-2 rounded-xl bg-sun-light/70 px-3 py-2 text-[0.85rem] font-medium">Επιβίβαση στον Πόρο: {persons(fromPoros)}</p>}
          {passengers.length === 0 ? (
            <p className="mt-3 text-[0.9rem] text-ink-mute">Καμία ηλεκτρονική κράτηση ακόμη για αυτή την ημερομηνία.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {passengers.map((b) => (
                <li key={b.ref} className="rounded-xl bg-white p-3 text-[0.88rem] ring-1 ring-ink/5">
                  <p className="font-semibold">
                    {b.name} <span className="font-mono text-[0.8rem] text-ink-mute">{b.ref}</span>
                  </p>
                  <p className="text-ink-mute">
                    {party(b)} · {pickupOf(store, b)}
                  </p>
                  <p className="text-ink-mute">{b.paid ? `${eur(b.total)} πληρωμένο με κάρτα` : `${eur(b.total)} πληρωτέο στο εκδοτήριο`}</p>
                  {(b.hotel || b.notes) && <p className="mt-1 text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ')}</p>}
                  <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-flex items-center gap-1.5 font-medium text-sea-deep hover:text-ink">
                    <Phone className="h-3.5 w-3.5" /> {b.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </m.aside>
    </>
  )
}

function Schedule({ store, onSave }: { store: Store; onSave: (key: string, cfg: CruiseConfig) => void }) {
  // the routes that call at Poros, with their saved return to Skala: a card notes when its route comes back earlier than all the others
  const porosRoutes = scheduledCruises.filter((c) => pickupTimes(c).hasPoros)
  const earliestOther = (key: string) =>
    porosRoutes
      .filter((c) => c.key !== key)
      .map((c) => pickupTimes(c, store.config[c.key]).skala.back)
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
      <div className="grid gap-5 lg:grid-cols-2">
        {scheduledCruises.map((c) => (
          <ScheduleCard key={c.key} id={c.key} name={NAMES[c.key]} cfg={store.config[c.key]} earliestOther={earliestOther(c.key)} onSave={(cfg) => onSave(c.key, cfg)} />
        ))}
      </div>
    </div>
  )
}

function scheduleErrors(d: CruiseConfig) {
  const e: Record<string, string> = {}
  if (d.active && d.weekdays.length === 0) e.weekdays = 'Επιλέξτε τουλάχιστον μία ημέρα.'
  if (!isTime(d.depart)) e.depart = 'Ώρα σε μορφή 09:00.'
  if (!isTime(d.returnSkala)) e.returnSkala = 'Ώρα σε μορφή 17:45.'
  else if (isTime(d.depart) && d.returnSkala <= d.depart) e.returnSkala = 'Η επιστροφή πρέπει να είναι μετά την αναχώρηση.'
  if (!Number.isFinite(d.adult) || d.adult < 1) e.adult = 'Τουλάχιστον 1 €.'
  if (!Number.isFinite(d.child) || d.child < 1) e.child = 'Τουλάχιστον 1 €.'
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

function ScheduleCard({ id, name, cfg, earliestOther, onSave }: { id: string; name: string; cfg: CruiseConfig; earliestOther?: string; onSave: (c: CruiseConfig) => void }) {
  const [draft, setDraft] = useState(cfg)
  const cruise = cruiseOf(id)
  const times = cruise ? pickupTimes(cruise, draft) : undefined
  // e.g. Ithaca: Vathi, back an hour before the other routes that call at Poros
  const earlier = !!times?.hasPoros && !!earliestOther && isTime(draft.returnSkala) && draft.returnSkala < earliestOther
  // reset the draft only when the saved values really change (not on every store refresh from another tab)
  const saved = JSON.stringify(cfg)
  useEffect(() => setDraft(JSON.parse(saved) as CruiseConfig), [saved])
  const dirty = JSON.stringify(draft) !== saved
  const errors = scheduleErrors(draft)
  const valid = Object.keys(errors).length === 0
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${id}-${k}-err`} className="mt-1 text-[0.78rem] text-terra-deep">
        {errors[k]}
      </p>
    ) : null
  const num = (v: string) => (v === '' ? NaN : Number(v))
  return (
    <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl">{name}</h2>
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
          <input id={`${id}-adult`} type="number" inputMode="numeric" min={1} className={`field ${errors.adult ? 'ring-2 ring-terra' : ''}`} value={Number.isFinite(draft.adult) ? draft.adult : ''} onChange={(e) => setDraft({ ...draft, adult: num(e.target.value) })} aria-invalid={!!errors.adult} />
          {err('adult')}
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${id}-child`}>
            Παιδί €
          </label>
          <input id={`${id}-child`} type="number" inputMode="numeric" min={1} className={`field ${errors.child ? 'ring-2 ring-terra' : ''}`} value={Number.isFinite(draft.child) ? draft.child : ''} onChange={(e) => setDraft({ ...draft, child: num(e.target.value) })} aria-invalid={!!errors.child} />
          {err('child')}
        </div>
      </div>
      {earlier && times && (
        <p className="mt-4 flex gap-2 rounded-xl bg-sand px-3.5 py-2.5 text-[0.82rem] text-ink-soft">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />
          <span>
            Επιστρέφει νωρίτερα από τις άλλες διαδρομές με στάση στον Πόρο: <strong className="whitespace-nowrap font-semibold tabular-nums text-ink">Πόρος {times.poros.back}, Σκάλα {times.skala.back}</strong>.
          </span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!dirty || !valid} onClick={() => onSave({ ...draft, adult: Math.round(draft.adult), child: Math.round(draft.child) })} className="btn btn-primary">
          <Save className="h-4 w-4" /> Αποθήκευση
        </button>
        {dirty && (
          <button type="button" onClick={() => setDraft(JSON.parse(saved) as CruiseConfig)} className="text-[0.85rem] font-medium text-ink-mute hover:text-ink">
            Αναίρεση αλλαγών
          </button>
        )}
      </div>
    </div>
  )
}

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

function Bookings({ store }: { store: Store }) {
  const [q, setQ] = useState('')
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase())
  const cruiseRows = store.bookings.filter((b) => match(`${b.name} ${b.ref} ${b.email} ${b.phone}`))
  const stayRows = store.stays.filter((b) => match(`${b.name} ${b.ref} ${b.email} ${b.phone}`))
  const requestRows = (store.requests ?? []).filter((b) => match(`${b.name} ${b.ref} ${b.email} ${b.phone}`))

  const cruiseCsv = () =>
    downloadCsv('kratiseis-krouazieron.csv', [
      ['Κωδικός', 'Κρουαζιέρα', 'Ημερομηνία', 'Κατάσταση αναχώρησης', 'Επιβίβαση', 'Όνομα', 'E-mail', 'Τηλέφωνο', 'Ενήλικες', 'Παιδιά', 'Βρέφη', 'Σύνολο €', 'Πληρωμή', 'Πληρώθηκε €', 'Στο εκδοτήριο €', 'Φιλοξενούμενος', 'Κατάλυμα', 'Σημειώσεις', 'Γλώσσα', 'Καταχώριση'],
      ...store.bookings.map((b) => {
        const st = stateOf(store, b)
        return [b.ref, NAMES[b.cruise], b.date, st ? STATUS[st.status][0] : '', pickupOf(store, b), b.name, b.email, b.phone, b.adults, b.children, b.infants ?? 0, b.total, b.paid ? 'Κάρτα' : 'Στο εκδοτήριο', b.paid ? b.total : 0, b.paid ? 0 : b.total, b.guest ? 'Ναι' : 'Όχι', b.hotel, b.notes, LANG[b.lang ?? ''] ?? b.lang, b.createdAt]
      }),
    ])
  const stayCsv = () =>
    downloadCsv('kratiseis-diamonis.csv', [
      ['Κωδικός', 'Κατάλυμα', 'Δωμάτιο', 'Άφιξη', 'Αναχώρηση', 'Νύχτες', 'Ενήλικες', 'Παιδιά', 'Όνομα', 'E-mail', 'Τηλέφωνο', 'Χώρα', 'Ώρα άφιξης', 'Ταξί', 'Αιτήματα', 'Σύνολο €', 'Πληρωμή', 'Πληρώθηκε €', 'Στην άφιξη €', 'Γλώσσα', 'Καταχώριση'],
      ...store.stays.map((s) => {
        const paid = s.paidNow ?? 0
        return [s.ref, properties[s.property as 'aegealis' | 'theodora']?.shortName ?? s.property, UNIT_NAMES[s.unit] ?? s.unit, s.from, s.to, nightsOf(s), s.adults, s.children, s.name, s.email, s.phone, s.country, s.arrival, s.taxi ? 'Ναι' : 'Όχι', s.requests, s.total, s.payPlan === 'full' ? 'Ολόκληρο' : s.payPlan === 'deposit' ? 'Προκαταβολή 30%' : '', paid, s.total - paid, LANG[s.lang ?? ''] ?? s.lang, s.createdAt]
      }),
    ])
  const requestCsv = () =>
    downloadCsv('aitimata-krouazieron.csv', [
      ['Κωδικός', 'Κρουαζιέρα', 'Ημερομηνία', 'Άτομα', 'Όνομα', 'E-mail', 'Τηλέφωνο', 'Μήνυμα', 'Γλώσσα', 'Καταχώριση'],
      ...(store.requests ?? []).map((r) => [r.ref, NAMES[r.cruise], r.date, r.people, r.name, r.email, r.phone, r.message, LANG[r.lang ?? ''] ?? r.lang, r.createdAt]),
    ])

  return (
    <div className="space-y-10">
      <ContactAlert store={store} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση ονόματος, κωδικού, e-mail ή τηλεφώνου" aria-label="Αναζήτηση κρατήσεων" className="field max-w-md" />

      <section>
        <SectionHead icon={Ship} title="Κρουαζιέρες" count={cruiseRows.length} onCsv={cruiseCsv} tone="text-sea" />
        {cruiseRows.length === 0 ? (
          <p className="mt-3 text-ink-mute">Δεν υπάρχουν ακόμη ηλεκτρονικές κρατήσεις. Μόλις κλείσει κάποιος θέσεις στην ιστοσελίδα, θα εμφανιστούν εδώ.</p>
        ) : (
          <>
            {/* phones: stacked cards */}
            <ul className="mt-4 grid gap-3 md:hidden">
              {cruiseRows.map((b) => {
                const st = stateOf(store, b)
                const cancelled = st?.status === 'cancelled'
                return (
                  <li key={b.ref} className={`rounded-xl2 p-4 shadow-soft ring-1 ${cancelled ? 'bg-terra-light/50 ring-terra/30' : 'bg-white ring-ink/5'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{b.name}</p>
                        <p className="font-mono text-[0.8rem] text-ink-mute">{b.ref}</p>
                      </div>
                      {st && statusBadge(st.status)}
                    </div>
                    <p className="mt-2 text-[0.9rem]">
                      {NAMES[b.cruise]} · {fmt(fromISO(b.date)!)}
                    </p>
                    <p className="text-[0.85rem] text-ink-mute">
                      {party(b)} · {pickupOf(store, b)}
                    </p>
                    <p className="text-[0.85rem] text-ink-mute">{b.paid ? `Κάρτα · ${eur(b.total)}` : `Στο εκδοτήριο · ${eur(b.total)}`}</p>
                    {(b.hotel || b.notes) && <p className="mt-1 text-[0.85rem] text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ')}</p>}
                    {cancelled && <p className="mt-2 text-[0.82rem] font-semibold text-terra-deep">Χρειάζεται επικοινωνία / επιστροφή χρημάτων</p>}
                    <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="mt-2 inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-sea-deep">
                      <Phone className="h-3.5 w-3.5" /> {b.phone}
                    </a>
                  </li>
                )
              })}
            </ul>
            {/* tablet and desktop: table */}
            <div className="mt-4 hidden overflow-x-auto rounded-xl3 bg-white shadow-soft ring-1 ring-ink/5 md:block">
              <table className="w-full min-w-[980px] text-left text-[0.88rem]">
                <thead className="border-b border-line text-[0.72rem] uppercase tracking-wider text-ink-mute">
                  <tr>
                    {['Κωδικός', 'Κρουαζιέρα', 'Επιβάτης', 'Άτομα', 'Επιβίβαση', 'Πληρωμή', 'Σημειώσεις'].map((h) => (
                      <th key={h} className="p-4 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cruiseRows.map((b) => {
                    const st = stateOf(store, b)
                    const cancelled = st?.status === 'cancelled'
                    return (
                      <tr key={b.ref} className={`border-b border-line align-top last:border-0 ${cancelled ? 'bg-terra-light/40' : ''}`}>
                        <td className="p-4 font-mono">{b.ref}</td>
                        <td className="p-4">
                          {NAMES[b.cruise]}
                          <span className="block text-ink-mute">{fmt(fromISO(b.date)!)}</span>
                          {st && st.status !== 'open' && <span className="mt-1 block">{statusBadge(st.status)}</span>}
                          {cancelled && <span className="mt-1 block text-[0.78rem] font-semibold text-terra-deep">Χρειάζεται επικοινωνία / επιστροφή</span>}
                        </td>
                        <td className="p-4">
                          {b.name}
                          <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="block text-[0.8rem] text-sea-deep hover:text-ink">
                            {b.phone}
                          </a>
                          <span className="block text-[0.8rem] text-ink-mute">{b.email}</span>
                        </td>
                        <td className="p-4">
                          <span className="tabular-nums">{persons(seatsOf(b))}</span>
                          <span className="block text-[0.8rem] text-ink-mute">{party(b)}</span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[0.78rem] font-semibold ${b.pickup === 'poros' ? 'bg-sun-light text-ink' : 'bg-sea-mist text-sea-deep'}`}>{pickupOf(store, b)}</span>
                        </td>
                        <td className="p-4 tabular-nums">
                          {eur(b.total)}
                          <span className="block text-[0.8rem] text-ink-mute">{b.paid ? 'Πληρώθηκε με κάρτα' : 'Πληρωτέο στο εκδοτήριο'}</span>
                          {b.guest && <span className="block text-[0.8rem] text-ink-mute">Φιλοξενούμενος −20%</span>}
                        </td>
                        <td className="max-w-[220px] p-4 text-ink-soft">{[b.hotel, b.notes].filter(Boolean).join(' · ') || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section>
        <SectionHead icon={BedDouble} title="Διαμονές" count={stayRows.length} onCsv={stayCsv} tone="text-terra" />
        {stayRows.length === 0 ? (
          <p className="mt-3 text-ink-mute">Δεν υπάρχουν ακόμη κρατήσεις δωματίων από την ιστοσελίδα.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {stayRows.map((s) => {
              const paid = s.paidNow ?? 0
              return (
                <li key={s.ref} className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-ink/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[0.85rem] text-ink-mute">{s.ref}</p>
                      <p className="font-semibold">{s.name}</p>
                    </div>
                    {s.taxi && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-light px-2.5 py-1 text-[0.75rem] font-semibold">
                        <Car className="h-3.5 w-3.5" /> Ταξί από αεροδρόμιο
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[0.9rem] text-ink-soft">
                    {properties[s.property as 'aegealis' | 'theodora']?.shortName} · {UNIT_NAMES[s.unit] ?? s.unit}
                  </p>
                  <p className="text-[0.9rem] text-ink-mute">
                    {fmt(fromISO(s.from)!)} – {fmt(fromISO(s.to)!)} · {plural(nightsOf(s), 'νύχτα', 'νύχτες')} · {persons(s.adults + s.children)}
                    {s.children ? ` (${party({ adults: s.adults, children: s.children })})` : ''}
                  </p>
                  <p className="mt-2 text-[0.9rem]">
                    <strong className="tabular-nums">{eur(s.total)}</strong>
                    {s.payPlan && (
                      <span className="text-ink-mute">
                        {' '}
                        · {s.payPlan === 'full' ? `εξοφλήθηκε (${eur(paid)})` : `προκαταβολή ${eur(paid)} · ${eur(s.total - paid)} στην άφιξη`}
                      </span>
                    )}
                  </p>
                  <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[0.85rem]">
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-ink-mute">Τηλέφωνο</dt>
                      <dd className="min-w-0">
                        <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="text-sea-deep hover:text-ink">
                          {s.phone}
                        </a>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-ink-mute">E-mail</dt>
                      <dd className="min-w-0 break-words">{s.email}</dd>
                    </div>
                    {s.country && (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-mute">Χώρα</dt>
                        <dd>{s.country}</dd>
                      </div>
                    )}
                    {s.arrival && (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-mute">Ώρα άφιξης</dt>
                        <dd className="tabular-nums">{s.arrival}</dd>
                      </div>
                    )}
                    {s.lang && (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-mute">Γλώσσα</dt>
                        <dd>{LANG[s.lang] ?? s.lang}</dd>
                      </div>
                    )}
                    {s.requests && (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-mute">Αιτήματα</dt>
                        <dd className="min-w-0 whitespace-pre-line text-ink-soft">{s.requests}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHead icon={MessageSquare} title="Αιτήματα (μπάρμπεκιου, ιδιωτικές, γάμοι)" count={requestRows.length} onCsv={requestCsv} tone="text-sun" />
        {requestRows.length === 0 ? (
          <p className="mt-3 text-ink-mute">Δεν υπάρχουν ακόμη αιτήματα από τις σελίδες μπάρμπεκιου, ιδιωτικών κρουαζιερών και γάμων.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {requestRows.map((r) => (
              <li key={r.ref} className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-ink/5">
                <p className="font-mono text-[0.85rem] text-ink-mute">{r.ref}</p>
                <p className="font-semibold">{r.name}</p>
                <p className="text-[0.9rem] text-ink-soft">
                  {NAMES[r.cruise] ?? r.cruise} · {r.date ? fmt(fromISO(r.date)!) : 'χωρίς ημερομηνία'} · {persons(r.people)}
                </p>
                {r.message && <p className="mt-2 whitespace-pre-line text-[0.88rem] text-ink-soft">{r.message}</p>}
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem]">
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 font-medium text-sea-deep hover:text-ink">
                    <Phone className="h-3.5 w-3.5" /> {r.phone}
                  </a>
                  <span className="break-all text-ink-mute">{r.email}</span>
                  {r.lang && <span className="text-ink-mute">{LANG[r.lang] ?? r.lang}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function nightsOf(s: { from: string; to: string }) {
  const a = fromISO(s.from)
  const b = fromISO(s.to)
  return a && b ? nightsBetween(a, b) : 0
}
