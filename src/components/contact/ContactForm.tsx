'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Mail, Send } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/icons'
import { site } from '@/data/site'
import { isEmail } from '@/lib/cruiseStore'
import { whatsappHref } from '@/lib/whatsapp'
import type { Dict } from '@/lib/i18n'

const FIELDS = [
  ['name', 'text', 'name', true],
  ['email', 'email', 'email', true],
  ['phone', 'tel', 'tel', false],
  ['dates', 'text', 'off', false],
] as const
// the order in which errors are checked, so focus goes to the first one on the page
const ORDER = ['name', 'email', 'message'] as const

type Sent = { name: string; email: string; phone: string; dates: string; message: string }

export function ContactForm({ t, common }: { t: Dict; common: Dict }) {
  const [sent, setSent] = useState<Sent | null>(null)
  const [topic, setTopic] = useState('stay')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // on success, focus moves to the confirmation as soon as it appears (after the form has faded out),
  // so screen readers read it straight away
  const done = useCallback((el: HTMLParagraphElement | null) => {
    if (el) requestAnimationFrame(() => el.focus())
  }, [])

  const errId = (k: string) => `cf-${k}-err`
  const describe = (k: string) => (errors[k] ? { 'aria-describedby': errId(k) } : {})

  // The page has no mail server, so the confirmation hands the message to WhatsApp or the guest's e-mail app,
  // already written, and it actually reaches the family.
  const topicLabel = (t.topics as Record<string, string>)[topic] ?? ''
  const text = sent ? `${topicLabel}${sent.dates ? ` (${sent.dates})` : ''}: ${sent.message} — ${sent.name}${sent.phone ? `, ${sent.phone}` : ''}` : ''
  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(topicLabel)}&body=${encodeURIComponent(text)}`

  return (
    <div className="rounded-xl3 bg-white p-6 shadow-soft ring-1 ring-ink/5 md:p-9">
      <AnimatePresence mode="wait">
        {sent ? (
          <m.div key="sent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-12 text-center">
            <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sea text-white">
              <Check className="h-8 w-8" aria-hidden="true" />
            </m.span>
            <p ref={done} tabIndex={-1} role="status" className="mx-auto mt-6 max-w-sm rounded-md text-[1.05rem] text-ink-soft">
              {t.sent}
            </p>
            {t.sendVia && <p className="mx-auto mt-3 max-w-sm text-[0.92rem] text-ink-mute">{t.sendVia}</p>}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href={whatsappHref(text)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <WhatsAppIcon className="h-5 w-5" /> {common.cta.whatsapp}
                <span className="sr-only"> {common.a11y.external}</span>
              </a>
              <a href={mailto} className="btn btn-ghost">
                <Mail className="h-4 w-4" aria-hidden="true" /> {common.cta.email}
              </a>
            </div>
          </m.div>
        ) : (
          <m.form
            key="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              const v = (k: string) => String(f.get(k) ?? '').trim()
              const errs: Record<string, string> = {}
              if (!v('name')) errs.name = common.errors.required
              // the same e-mail rule as the booking pages
              if (!isEmail(v('email'))) errs.email = common.errors.email
              if (!v('message')) errs.message = common.errors.required
              setErrors(errs)
              const first = ORDER.find((k) => errs[k])
              if (first) {
                requestAnimationFrame(() => document.getElementById(`cf-${first}`)?.focus())
                return
              }
              setSent({ name: v('name'), email: v('email'), phone: v('phone'), dates: v('dates'), message: v('message') })
            }}
            className="space-y-5"
          >
            <h2 className="font-display text-display-sm">{t.title}</h2>
            <fieldset className="min-w-0">
              <legend className="label">{t.topic}</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(t.topics as Record<string, string>).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setTopic(k)} aria-pressed={topic === k} className={`rounded-full px-4 py-2 text-[0.88rem] font-medium transition ${topic === k ? 'bg-ink text-white' : 'bg-sand hover:bg-sand-deep'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              {FIELDS.map(([k, type, ac, required]) => (
                <div key={k}>
                  <label htmlFor={`cf-${k}`} className="label">
                    {t[k]}
                  </label>
                  <input
                    id={`cf-${k}`}
                    name={k}
                    type={type}
                    autoComplete={ac}
                    className={`field ${errors[k] ? 'ring-2 ring-terra' : ''}`}
                    aria-invalid={!!errors[k]}
                    aria-required={required || undefined}
                    {...describe(k)}
                  />
                  {errors[k] && (
                    <p id={errId(k)} className="mt-1 text-[0.8rem] text-terra-deep">
                      {errors[k]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label htmlFor="cf-message" className="label">
                {t.message}
              </label>
              <textarea id="cf-message" name="message" rows={5} className={`field resize-none ${errors.message ? 'ring-2 ring-terra' : ''}`} aria-invalid={!!errors.message} aria-required {...describe('message')} />
              {errors.message && (
                <p id={errId('message')} className="mt-1 text-[0.8rem] text-terra-deep">
                  {errors.message}
                </p>
              )}
            </div>
            <p className="text-[0.82rem] text-ink-mute">{t.privacy}</p>
            <button type="submit" className="btn btn-primary py-4">
              <Send className="h-4 w-4" aria-hidden="true" /> {t.send}
            </button>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  )
}
