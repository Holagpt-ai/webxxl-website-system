export type AbmedCampaignDraftAction = 'create_campaign_draft' | 'update_campaign_draft'

export type AbmedCampaignDraftFields = {
  slug?: string
  name?: string
  type?: 'lead_capture' | 'booking_cta'
  placement?: 'homepage_popup'
  headline?: string
  body?: string
  imageUrl?: string | null
  ctaText?: string
  ctaDestination?: string
  startAt?: string | null
  endAt?: string | null
  delayMs?: number
  frequencyDays?: number
  deviceTargeting?: 'all' | 'desktop' | 'mobile'
}

export type AbmedCampaignStructuredPayload = {
  action: AbmedCampaignDraftAction
  remoteCampaignId?: string
  expectedVersion?: number
  fields: AbmedCampaignDraftFields
}

const FIELD_KEYS = new Set([
  'slug',
  'name',
  'type',
  'placement',
  'headline',
  'body',
  'imageUrl',
  'ctaText',
  'ctaDestination',
  'startAt',
  'endAt',
  'delayMs',
  'frequencyDays',
  'deviceTargeting',
])

export function parseAbmedCampaignStructuredPayload(value: unknown): AbmedCampaignStructuredPayload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.action !== 'create_campaign_draft' && record.action !== 'update_campaign_draft') return null
  if (!record.fields || typeof record.fields !== 'object') return null
  const fields: AbmedCampaignDraftFields = {}
  for (const [key, fieldValue] of Object.entries(record.fields as Record<string, unknown>)) {
    if (!FIELD_KEYS.has(key)) continue
    if (key === 'delayMs' || key === 'frequencyDays') {
      if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
        fields[key] = fieldValue
      }
      continue
    }
    if (typeof fieldValue === 'string' || fieldValue === null) {
      ;(fields as Record<string, unknown>)[key] = fieldValue
    }
  }
  if (record.action === 'update_campaign_draft') {
    if (typeof record.remoteCampaignId !== 'string' || !record.remoteCampaignId.trim()) return null
    if (typeof record.expectedVersion !== 'number' || !Number.isInteger(record.expectedVersion)) return null
  }
  if (record.action === 'create_campaign_draft') {
    if (!fields.slug || !fields.name || !fields.headline || !fields.body || !fields.ctaText || !fields.ctaDestination) {
      return null
    }
  }
  return {
    action: record.action,
    remoteCampaignId: typeof record.remoteCampaignId === 'string' ? record.remoteCampaignId : undefined,
    expectedVersion: typeof record.expectedVersion === 'number' ? record.expectedVersion : undefined,
    fields,
  }
}
