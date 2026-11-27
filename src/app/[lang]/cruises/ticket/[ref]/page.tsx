import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowRight, CalendarPlus, Check, Clock, Mail, MessageCircle, RotateCcw } from 'lucide-react'
import { site, whatsappLink } from '@/data/site'
import { fill, getDictionary, isLocale, type Dict, type Locale } from '@/lib/i18n'
import { cruiseSlug } from '@/server/cruises/catalog'
import { ticketView, type TicketView } from '@/server/cruises/bookings'
import { BOOKING_REF, checkTicketToken } from '@/server/crypto'
import { dateVars, longDate, money, passengerLine } from '@/server/email/templates'
import { qrSvg } from '@/server/email/qr'
import { PrintButton, RetryPayment, TicketAccess } from './TicketActions'

export const dynamic = 'force-dynamic'

type Props = { params: { lang: string; ref: string }; searchParams: { k?: string; p?: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isLocale(params.lang)) return {}
  const d = await getDictionary(params.lang)
  return { title: `${d.payments.ticket.metaTitle} · ${d.common.brand.name}`, robots: { index: false, follow: false }, referrer: 'no-referrer' }
}

const PRINT_CSS = '@media print{header,#site-footer,[data-dock],[data-noprint]{display:none!important}main article{padding-top:0!important;background:#fff!important}}'

export default async function TicketPage({ params, searchParams }: Props) {
  if (!isLocale(params.lang)) notFound()
  const locale = params.lang as Locale
  const ref = params.ref.toUpperCase()
  if (!BOOKING_REF.test(ref)) notFound()
  const d = await getDictionary(locale)
  const p = d.payments
  const t = p.ticket

  const shell = (children: React.ReactNode) => (
    <article className="bg-sand-paper pb-24 pt-[calc(var(--header-h)+var(--banner-h,0px)+3.5rem)]">
      <style>{PRINT_CSS}</style>
      <div className="container max-w-2xl">{children}</div>
    </article>
  )

  const token = typeof searchParams.k === 'string' ? searchParams.k : ''
  if (!checkTicketToken(ref, token)) {
    return shell(
      <>
        <p className="kicker">{t.kicker}</p>
        <h1 className="mt-4 font-display text-display-md font-light">{t.access.title}</h1>
        <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-soft">{fill(t.access.body, { ref })}</p>
        <TicketAccess bookingRef={ref} t={t.access} errors={p.errors} />
      </>,
    )
  }

  const v = await ticketView(ref)
  if (!v) notFound()
  const cruiseName: string = d.cruises.list[v.cruise]?.name ?? v.cruise
  const cruiseHref = `/${locale}/cruises/${cruiseSlug(v.cruise)}`
  const place = v.pickup === 'poros' ? p.places.poros : p.places.skala

  const contact = (
    <div className="mt-6 grid gap-2 sm:grid-cols-2" data-noprint>
      <a href={whatsappLink(ref)} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t.whatsapp}
      </a>
      <a href={`mailto:${site.email}?subject=${encodeURIComponent(ref)}`} className="btn btn-ghost w-full">
        <Mail className="h-4 w-4" aria-hidden="true" /> {t.email}
      </a>
    </div>
  )

  const summary = (
    <dl className="space-y-2 text-[0.92rem]">
      <Row label={p.labels.cruise} value={cruiseName} />
      <Row label={p.labels.date} value={longDate(locale, v.date)} />
      {v.boarding && <Row label={p.labels.boarding} value={`${place}, ${v.boarding.depart}`} />}
      <Row label={p.labels.passengers} value={passengerLine(locale, v)} />
      <Row label={p.labels.total} value={money(locale, Math.round(v.total * 100))} strong />
      <Row label={p.labels.reference} value={v.ref} mono />
    </dl>
  )

  // ----- paid: the e-ticket ----------------------------------------------------------------------------
  if (v.status === 'PAID') {
    const svg = await qrSvg(v.ref)
    return shell(
      <>
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sea text-white" aria-hidden="true">
            <Check className="h-6 w-6" />
          </span>
          <div>
            <p className="kicker">{t.kicker}</p>
            <h1 className="mt-1 font-display text-display-sm font-light">{t.paid.title}</h1>
          </div>
        </div>
        <p className="mt-5 text-[1.02rem] leading-relaxed text-ink-soft">{t.paid.body}</p>
        <EticketCard v={v} d={d} locale={locale} cruiseName={cruiseName} svg={svg} />
        <ul className="mt-6 space-y-3 text-[0.95rem] leading-relaxed text-ink-soft">
          <li className="flex gap-3">
            <Clock className="mt-1 h-4 w-4 shrink-0 text-sea" aria-hidden="true" />
            <span>{v.pickup === 'poros' && v.boarding ? fill(t.showPoros, { time: v.boarding.depart }) : t.show}</span>
          </li>
          {v.discountKind === 'guest20' && (
            <li className="flex gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-sea" aria-hidden="true" />
              <span>{t.guestCheck}</span>
            </li>
          )}
        </ul>
        <div className="mt-8 grid gap-2 sm:grid-cols-2" data-noprint>
          <a href={`/api/cruises/bookings/${v.ref}/ics?k=${encodeURIComponent(token)}`} className="btn btn-ghost w-full">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {t.addToCalendar}
          </a>
          <PrintButton label={t.print} />
          <Link href={`/${locale}/cruises`} className="btn btn-primary w-full sm:col-span-2">
            {t.another} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </>,
    )
  }

  // ----- cancelled by the Captain: refund due or made ---------------------------------------------------
  if (v.status === 'REFUND_DUE' || v.status === 'REFUNDED') {
    // {date}, and {onDate} for the Greek copy ("για την 1η Ιουνίου")
    const why = fill(v.cancelReason === 'technical' ? t.refundDue.technical : v.cancelReason === 'weather' ? t.refundDue.weather : t.refundDue.other, dateVars(locale, v.date))
    const amount = money(locale, Math.round(v.total * 100))
    return shell(
      <>
        <p className="kicker">{t.kicker}</p>
        <h1 className="mt-4 font-display text-display-md font-light">{v.status === 'REFUNDED' ? t.refunded.title : t.refundDue.title}</h1>
        <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-soft">{why}</p>
        <div className="mt-6 rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">
          {v.status === 'REFUNDED' ? (
            <p className="text-[0.98rem] text-ink-soft">{fill(t.refunded.body, { amount, ...(v.refundedAt ? dateVars(locale, v.refundedAt.slice(0, 10)) : { date: '', onDate: '' }) })}</p>
          ) : (
            <>
              <p className="flex gap-3 rounded-xl bg-terra-light px-4 py-3 text-[0.95rem] font-medium text-terra-deep">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {fill(t.refundDue.refund, { amount })}
              </p>
              <p className="mt-4 text-[0.95rem] text-ink-soft">{t.refundDue.rebook}</p>
            </>
          )}
          <div className="mt-5 border-t border-line pt-5">{summary}</div>
        </div>
        {v.status === 'REFUND_DUE' && contact}
      </>,
    )
  }

  // ----- not paid, and the Captain cancelled the departure meanwhile: nothing was charged -----------------
  if (v.status === 'CANCELLED' && v.cancelReason !== 'hold_expired') {
    return shell(
      <>
        <p className="kicker">{t.kicker}</p>
        <h1 className="mt-4 font-display text-display-md font-light">{t.refundDue.title}</h1>
        <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-soft">{fill(t.refundDue.other, dateVars(locale, v.date))}</p>
        <div className="mt-6 rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">{summary}</div>
        <Link href={cruiseHref} className="btn btn-primary mt-6 w-full py-4 sm:w-auto">
          {t.expired.choose} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </>,
    )
  }

  // ----- not paid: retry while possible -----------------------------------------------------------------
  const expired = !v.holdActive
  const minutes = v.holdExpiresAt ? Math.max(1, Math.ceil((Date.parse(v.holdExpiresAt) - Date.now()) / 60000)) : 0
  const lastFailed = v.lastPayment?.status === 'failed' || v.lastPayment?.status === 'cancelled' || searchParams.p === 'failed'
  const payable = v.status === 'PENDING_PAYMENT' || (v.status === 'CANCELLED' && v.cancelReason === 'hold_expired')
  return shell(
    <>
      <p className="kicker">{t.kicker}</p>
      <h1 className="mt-4 font-display text-display-md font-light">{expired ? t.expired.title : t.pending.title}</h1>
      {expired ? (
        <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-soft">{t.expired.body}</p>
      ) : (
        <div className="mt-4 space-y-2 text-[1.02rem] leading-relaxed text-ink-soft">
          <p className="flex gap-2 font-medium text-terra-deep">
            <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> {lastFailed ? t.pending.failed : t.pending.waiting}
          </p>
          <p>{minutes === 1 ? t.pending.heldOne : fill(t.pending.heldMany, { count: minutes })}</p>
        </div>
      )}
      <div className="mt-6 rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5">{summary}</div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
        {payable && <RetryPayment bookingRef={v.ref} token={token} label={expired ? t.expired.retry : t.pending.retry} errors={p.errors} />}
        <Link href={cruiseHref} className="btn btn-ghost w-full py-4 sm:w-auto">
          {t.expired.choose}
        </Link>
      </div>
    </>,
  )
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-mute">{label}</dt>
      <dd className={`text-right ${strong ? 'font-display text-lg' : ''} ${mono ? 'font-mono font-semibold tracking-wider' : ''}`}>{value}</dd>
    </div>
  )
}

function EticketCard({ v, d, locale, cruiseName, svg }: { v: TicketView; d: Dict; locale: Locale; cruiseName: string; svg: string }) {
  const p = d.payments
  const place = v.pickup === 'poros' ? p.places.poros : p.places.skala
  return (
    <section aria-label={p.ticket.title} className="relative mt-8 overflow-hidden rounded-xl3 bg-white shadow-lift ring-1 ring-ink/5">
      <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
        <div role="img" aria-label={fill(p.ticket.qrLabel, { ref: v.ref })} className="h-40 w-40 shrink-0 rounded-xl bg-white p-1 ring-1 ring-ink/10 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-mute">{p.ticket.title}</p>
          <p className="mt-1 font-display text-2xl leading-tight">{cruiseName}</p>
          <p className="mt-1 text-[0.95rem] text-ink-soft">{longDate(locale, v.date)}</p>
          <p className="mt-2 font-mono text-[1.05rem] font-semibold tracking-wider">{v.ref}</p>
          <p className="mt-1 text-[0.9rem] text-ink-mute">{v.name}</p>
        </div>
      </div>
      <div className="relative border-t border-dashed border-ink/15 px-6 py-5 sm:px-7">
        <span aria-hidden="true" className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-sand-paper" />
        <span aria-hidden="true" className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-sand-paper" />
        <dl className="space-y-2 text-[0.92rem]">
          {v.boarding && (
            <Row label={p.labels.boarding} value={`${place}, ${v.boarding.depart}${v.pickup === 'poros' ? ` (${p.labels.onRequest})` : ''}`} />
          )}
          {v.boarding && <Row label={p.labels.return} value={fill(p.labels.returnAround, { place, time: v.boarding.back })} />}
          <Row label={p.labels.passengers} value={passengerLine(locale, v)} />
          {v.discountKind !== 'none' && <Row label={p.labels.discount[v.discountKind]} value={`−${money(locale, Math.round(v.discount * 100))}`} />}
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold">{p.labels.paid}</dt>
            <dd className="font-display text-xl tabular-nums">{money(locale, Math.round(v.total * 100))}</dd>
          </div>
        </dl>
        {v.movedFrom && v.movedFrom !== v.date && <p className="mt-3 text-[0.82rem] text-ink-mute">{fill(p.ticket.moved, { date: longDate(locale, v.movedFrom) })}</p>}
      </div>
    </section>
  )
}
