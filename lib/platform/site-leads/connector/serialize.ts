import type { SiteLeadConnectorPayload } from '@/lib/platform/site-leads/connector/types'

const FORBIDDEN_KEYS = new Set(['customerAccountId', 'managedSiteId', 'marketingConsent', 'consent'])

/** Deterministic JSON for signing — stable key order, omits undefined. */
export function serializeSiteLeadIntakeBody(payload: SiteLeadConnectorPayload): string {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Field "${key}" must not be sent by the website connector`)
    }
  }
  const body: Record<string, unknown> = {
    contactEmail: payload.contactEmail,
  }
  if (payload.contactName !== undefined) body.contactName = payload.contactName
  if (payload.contactPhone !== undefined) body.contactPhone = payload.contactPhone
  if (payload.message !== undefined) body.message = payload.message
  if (payload.formReference !== undefined) body.formReference = payload.formReference
  if (payload.locale !== undefined) body.locale = payload.locale
  if (payload.submittedAt !== undefined) body.submittedAt = payload.submittedAt
  if (payload.fields !== undefined) body.fields = payload.fields
  if (payload.analyticsProvenance !== undefined) body.analyticsProvenance = payload.analyticsProvenance
  return JSON.stringify(body)
}
