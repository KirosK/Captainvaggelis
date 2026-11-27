// E-mail adapters. EMAIL_PROVIDER=file|smtp|resend forces one; otherwise Resend when RESEND_API_KEY is set,
// SMTP when SMTP_HOST is set, and in development the file adapter, which writes each e-mail as an HTML file
// into .data/outbox (and logs the path) instead of sending it. Production with none configured keeps the
// e-mails queued in the outbox until a provider is set.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dataDir, isProduction } from '../env'
import { log } from '../log'

export type EmailAttachment = { filename: string; content: Buffer; contentType: string }
export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  attachments?: EmailAttachment[]
  /** kind and reference, for logs and file names only */
  tag: { kind: string; ref: string }
}

export interface EmailProvider {
  id: 'file' | 'smtp' | 'resend'
  send(msg: EmailMessage): Promise<void>
}

const from = () => process.env.EMAIL_FROM || 'Captain Vangelis <bookings@kefalonia-cruises.gr>'
export const replyTo = () => process.env.EMAIL_REPLY_TO || 'info@kefalonia-cruises.gr'

const fileProvider: EmailProvider = {
  id: 'file',
  async send(msg) {
    const dir = path.join(dataDir(), 'outbox')
    await mkdir(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `${stamp}-${msg.tag.kind}-${msg.tag.ref}`
    const esc = (s: string) => s.replace(/--/g, '- -')
    const head = `<!--\nFrom: ${esc(from())}\nTo: ${esc(msg.to)}\nReply-To: ${esc(msg.replyTo ?? '')}\nSubject: ${esc(msg.subject)}\nAttachments: ${(msg.attachments ?? []).map((a) => `${base}--${a.filename}`).join(', ')}\n-->\n`
    const file = path.join(dir, `${base}.html`)
    await writeFile(file, head + msg.html, 'utf8')
    await writeFile(path.join(dir, `${base}.txt`), `Subject: ${msg.subject}\n\n${msg.text}`, 'utf8')
    for (const a of msg.attachments ?? []) await writeFile(path.join(dir, `${base}--${a.filename}`), a.content)
    log.info('email.written', { kind: msg.tag.kind, ref: msg.tag.ref, file: path.relative(process.cwd(), file) })
  },
}

const resendProvider = (key: string): EmailProvider => ({
  id: 'resend',
  async send(msg) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo,
        attachments: (msg.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content.toString('base64'), content_type: a.contentType })),
        tags: [{ name: 'kind', value: msg.tag.kind }],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Resend answered ${res.status}`)
  },
})

const smtpProvider = (): EmailProvider => ({
  id: 'smtp',
  async send(msg) {
    const nodemailer = await import('nodemailer')
    const port = Number(process.env.SMTP_PORT || 587)
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' } : undefined,
      connectionTimeout: 15_000,
    })
    await transport.sendMail({
      from: from(),
      to: msg.to,
      replyTo: msg.replyTo,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: (msg.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    })
  },
})

export function getEmailProvider(): EmailProvider | null {
  const forced = process.env.EMAIL_PROVIDER
  const resendKey = process.env.RESEND_API_KEY
  if (forced === 'resend' || (!forced && resendKey)) return resendKey ? resendProvider(resendKey) : null
  if (forced === 'smtp' || (!forced && process.env.SMTP_HOST)) return process.env.SMTP_HOST ? smtpProvider() : null
  if (forced === 'file' || !isProduction()) return fileProvider
  return null
}
