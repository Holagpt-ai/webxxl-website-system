import { SITE_LEAD_INTAKE_MAX_BODY_BYTES } from '@/config/site-lead-intake'
import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'

export type SiteLeadIntakeBody = {
  formReference?: string
  locale?: string
  submittedAt?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  message?: string
  fields?: Record<string, unknown>
  /** Analytics provenance only — not marketing consent. */
  analyticsProvenance?: { eventId?: string; captureSessionId?: string }
  customerAccountId?: unknown
  managedSiteId?: unknown
}

export type ValidatedSiteLeadIntake = {
  formReference: string | null
  locale: string
  submittedAt: Date
  contactName: string | null
  contactEmail: string
  contactPhone: string | null
  normalizedEmail: string
  normalizedPhone: string | null
  message: string | null
  payload: Record<string, unknown>
  analyticsEventRef: string | null
  sourceAttribution: Record<string, unknown> | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateSiteLeadIntakePayload(input: {
  rawBody: string
  parsed: SiteLeadIntakeBody
}):
  | { ok: true; value: ValidatedSiteLeadIntake }
  | { ok: false; code: 'VALIDATION' | 'PAYLOAD_TOO_LARGE'; message: string } {
  if (Buffer.byteLength(input.rawBody, 'utf8') > SITE_LEAD_INTAKE_MAX_BODY_BYTES) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds lead intake limit' }
  }
  if (input.parsed.customerAccountId !== undefined || input.parsed.managedSiteId !== undefined) {
    return { ok: false, code: 'VALIDATION', message: 'Account and site must not be supplied by the client' }
  }
  const emailRaw = input.parsed.contactEmail
  if (typeof emailRaw !== 'string' || !emailRaw.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'contactEmail is required' }
  }
  let normalizedEmail: string
  try {
    normalizedEmail = normalizeEmail(emailRaw)
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'contactEmail is invalid' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, code: 'VALIDATION', message: 'contactEmail is invalid' }
  }
  const phoneRaw = input.parsed.contactPhone
  let contactPhone: string | null = null
  let normalizedPhone: string | null = null
  if (phoneRaw !== undefined && phoneRaw !== null && String(phoneRaw).trim()) {
    contactPhone = String(phoneRaw).trim().slice(0, 40)
    normalizedPhone = normalizePhone(contactPhone)
  }
  const nameRaw = input.parsed.contactName
  const contactName =
    typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim().slice(0, 200) : null
  const messageRaw = input.parsed.message
  const message =
    typeof messageRaw === 'string' && messageRaw.trim() ? messageRaw.trim().slice(0, 4000) : null
  const locale =
    typeof input.parsed.locale === 'string' && input.parsed.locale.trim()
      ? input.parsed.locale.trim().slice(0, 16)
      : 'en'
  const formReference =
    typeof input.parsed.formReference === 'string' && input.parsed.formReference.trim()
      ? input.parsed.formReference.trim().slice(0, 120)
      : null
  let submittedAt = new Date()
  if (typeof input.parsed.submittedAt === 'string' && input.parsed.submittedAt.trim()) {
    const parsed = new Date(input.parsed.submittedAt)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, code: 'VALIDATION', message: 'submittedAt is invalid' }
    }
    submittedAt = parsed
  }
  const fields = isPlainObject(input.parsed.fields) ? input.parsed.fields : {}
  const payload: Record<string, unknown> = { fields }
  let analyticsEventRef: string | null = null
  let sourceAttribution: Record<string, unknown> | null = null
  if (input.parsed.analyticsProvenance !== undefined) {
    if (!isPlainObject(input.parsed.analyticsProvenance)) {
      return { ok: false, code: 'VALIDATION', message: 'analyticsProvenance must be an object' }
    }
    sourceAttribution = { analyticsProvenance: input.parsed.analyticsProvenance }
    const eventId = input.parsed.analyticsProvenance.eventId
    if (typeof eventId === 'string' && eventId.trim()) {
      analyticsEventRef = eventId.trim().slice(0, 128)
    }
  }
  return {
    ok: true,
    value: {
      formReference,
      locale,
      submittedAt,
      contactName,
      contactEmail: emailRaw.trim().slice(0, 320),
      contactPhone,
      normalizedEmail,
      normalizedPhone,
      message,
      payload,
      analyticsEventRef,
      sourceAttribution,
    },
  }
}
