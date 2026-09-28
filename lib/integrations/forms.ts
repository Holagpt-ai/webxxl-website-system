'use server'

/**
 * INTEGRATION BOUNDARY — Public form submissions (owned by Cursor).
 * These server actions validate input and return a result, but DO NOT persist anything.
 * Replace each TODO with a call to the WebXXL backend / CRM API. Keep the signatures stable
 * so the UI does not need to change.
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

function reference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

export async function submitContact(payload: ContactPayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!payload.name?.trim() || !EMAIL.test(payload.email ?? '') || !payload.message?.trim()) {
    return { ok: false, error: 'invalid' }
  }
  // TODO(cursor): POST to backend contact endpoint / create CRM lead.
  return { ok: true, reference: reference('MSG') }
}

export async function submitLead(payload: LeadPayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!EMAIL.test(payload.email ?? '')) return { ok: false, error: 'invalid' }
  // TODO(cursor): subscribe to newsletter / create CRM lead with payload.source.
  return { ok: true, reference: reference('LEAD') }
}

export async function submitProjectIntake(payload: ProjectIntakePayload): Promise<SubmitResult> {
  if (payload.website_url) return { ok: false, error: 'spam' }
  if (!payload.business?.name?.trim() || !payload.contact?.name?.trim() || !EMAIL.test(payload.contact?.email ?? '')) {
    return { ok: false, error: 'invalid' }
  }
  // TODO(cursor): create project intake record + CRM lead, notify sales.
  return { ok: true, reference: reference('WX') }
}

export async function requestStrategyCall(payload: StrategyCallPayload): Promise<SubmitResult> {
  if (!payload.name?.trim() || !EMAIL.test(payload.email ?? '')) return { ok: false, error: 'invalid' }
  // TODO(cursor): create booking request / scheduling integration.
  return { ok: true, reference: reference('CALL') }
}
