'use server'

/**
 * INTEGRATION BOUNDARY — Public form submissions.
 * These server actions validate input and deliver each submission by email
 * via Resend. If RESEND_API_KEY is not configured, they fail honestly with
 * { ok: false } so the UI shows an error instead of a fake confirmation.
 *
 * Required env: RESEND_API_KEY
 * Optional env: LEADS_TO_EMAIL (default hello@webbxxl.com),
 *               LEADS_FROM_EMAIL (default onboarding@resend.dev)
 */

export type SubmitResult = { ok: true; reference: string } | { ok: false; error: 'invalid' | 'spam' | 'server' }

export type ContactPayload = {
  name: string
  email: string
  phone?: string
  company?: string
  reason?: string
  service?: string
  message: string
  locale: string
  /** Honeypot — must be empty. */
  website_url?: string
}

export type LeadPayload = { email: string; source: string; locale: string; website_url?: string }

export type ProjectIntakePayload = {
  locale: string
  intent?: string
  plan?: string
  business: { name: string; industry: string; location: string }
  currentWebsite: { hasWebsite: boolean; url?: string; notes?: string }
  projectType: string
  features: string[]
  services: string[]
  timeline: string
  budget: string
  contact: { name: string; email: string; phone?: string; notes?: string }
  website_url?: string
}

export type StrategyCallPayload = { name: string; email: string; phone?: string; preferredTime?: string; locale: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RESEND_API_KEY = process.env.RESEND_API_KEY
const LEADS_TO_EMAIL = process.env.LEADS_TO_EMAIL ?? 'hello@webbxxl.com'
const LEADS_FROM_EMAIL = process.env.LEADS_FROM_EMAIL ?? 'onboarding@resend.dev'

type Field = [label: string, value: string | undefined]

function clean(value: string | undefined): string {
  return (value ?? '').trim() || '—'
}

/**
 * Sends one lead email. Returns the Resend message id on success, null when
 * delivery is unavailable (missing key, network or API error).
 */
async function deliverLead(kind: string, subject: string, fields: Field[]): Promise<string | null> {
  if (!RESEND_API_KEY) return null
  const text = fields.map(([label, value]) => `${label}: ${clean(value)}`).join('\n')
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `WebXXL <${LEADS_FROM_EMAIL}>`,
        to: [LEADS_TO_EMAIL],
        reply_to: fields.find(([label]) => label.toLowerCase() === 'email')?.[1] || undefined,
        subject: `[WebXXL ${kind}] ${subject}`,
        text: `New ${kind} submission from the WebXXL website:\n\n${text}`,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? 'sent'
  } catch {
    return null
  }
}

function confirmation(prefix: string, id: string | null): SubmitResult {
  if (!id) return { ok: false, error: 'server' }
  return { ok: true, reference: `${prefix}-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}` }
}

export async function submitContact(payload: ContactPayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!payload.name?.trim() || !EMAIL.test(payload.email ?? '') || !payload.message?.trim()) {
    return { ok: false, error: 'invalid' }
  }
  const id = await deliverLead('Contact', `${payload.name} — ${payload.reason || payload.service || 'general'}`, [
    ['Name', payload.name],
    ['Email', payload.email],
    ['Phone', payload.phone],
    ['Company', payload.company],
    ['Reason', payload.reason],
    ['Service', payload.service],
    ['Message', payload.message],
    ['Locale', payload.locale],
  ])
  return confirmation('MSG', id)
}

export async function submitLead(payload: LeadPayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!EMAIL.test(payload.email ?? '')) return { ok: false, error: 'invalid' }
  const id = await deliverLead('Newsletter', `New signup from ${payload.source}`, [
    ['Email', payload.email],
    ['Source', payload.source],
    ['Locale', payload.locale],
  ])
  return confirmation('LEAD', id)
}

export async function submitProjectIntake(payload: ProjectIntakePayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!payload.business?.name?.trim() || !payload.contact?.name?.trim() || !EMAIL.test(payload.contact?.email ?? '')) {
    return { ok: false, error: 'invalid' }
  }
  const id = await deliverLead(
    'Project intake',
    `${payload.business.name} — ${payload.projectType || 'new project'}`,
    [
      ['Business', payload.business.name],
      ['Industry', payload.business.industry],
      ['Location', payload.business.location],
      ['Current website', payload.currentWebsite.hasWebsite ? payload.currentWebsite.url : 'none'],
      ['Website notes', payload.currentWebsite.notes],
      ['Project type', payload.projectType],
      ['Intent', payload.intent],
      ['Plan interest', payload.plan],
      ['Features', payload.features?.join(', ')],
      ['Services', payload.services?.join(', ')],
      ['Timeline', payload.timeline],
      ['Budget', payload.budget],
      ['Name', payload.contact.name],
      ['Email', payload.contact.email],
      ['Phone', payload.contact.phone],
      ['Notes', payload.contact.notes],
      ['Locale', payload.locale],
    ],
  )
  return confirmation('WX', id)
}

export async function requestStrategyCall(payload: StrategyCallPayload): Promise<SubmitResult> {
  if (!payload.name?.trim() || !EMAIL.test(payload.email ?? '')) return { ok: false, error: 'invalid' }
  const id = await deliverLead('Quote request', `${payload.name} — wants a strategy call`, [
    ['Name', payload.name],
    ['Email', payload.email],
    ['Phone', payload.phone],
    ['Preferred time', payload.preferredTime],
    ['Locale', payload.locale],
  ])
  return confirmation('CALL', id)
}
