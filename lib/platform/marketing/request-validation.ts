import type { MarketingRequestCategory } from '@/lib/platform/marketing/types'

export const MARKETING_REQUEST_CATEGORIES: MarketingRequestCategory[] = [
  'LANDING_PAGE',
  'SEO_CONTENT_FIX',
  'AD_CREATIVE',
  'SOCIAL_CONTENT_PLAN',
  'CAMPAIGN_PREPARATION',
  'CRM_LEAD_FOLLOW_UP',
]

export const MKT_MAX_GOAL_LENGTH = 2000
export const MKT_MAX_BRIEF_LENGTH = 20_000
export const MKT_MAX_AUDIENCE_LENGTH = 2000
export const MKT_MAX_SOURCE_REFS = 50
export const MKT_MAX_SOURCE_REF_LENGTH = 500
export const MKT_MAX_IDEMPOTENCY_KEY_LENGTH = 128
export const MKT_FOLLOW_UP_EVAL_MAX_LIMIT = 100

export function validateMarketingRequestPayload(input: {
  category: string
  goal: string
  brief: string
  locale: string
  audience?: string
  sourceRefs?: string[]
  idempotencyKey: string
}): { ok: true; category: MarketingRequestCategory; locale: 'en' | 'es' } | { ok: false; message: string } {
  if (!MARKETING_REQUEST_CATEGORIES.includes(input.category as MarketingRequestCategory)) {
    return { ok: false, message: 'Invalid request category' }
  }
  if (input.locale !== 'en' && input.locale !== 'es') {
    return { ok: false, message: 'Locale must be en or es' }
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > MKT_MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false, message: 'Invalid idempotency key' }
  }
  if (!input.goal.trim() || input.goal.length > MKT_MAX_GOAL_LENGTH) {
    return { ok: false, message: 'Invalid goal' }
  }
  if (!input.brief.trim() || input.brief.length > MKT_MAX_BRIEF_LENGTH) {
    return { ok: false, message: 'Invalid brief' }
  }
  if (input.audience && input.audience.length > MKT_MAX_AUDIENCE_LENGTH) {
    return { ok: false, message: 'Invalid audience' }
  }
  const refs = input.sourceRefs ?? []
  if (refs.length > MKT_MAX_SOURCE_REFS || refs.some((r) => r.length > MKT_MAX_SOURCE_REF_LENGTH)) {
    return { ok: false, message: 'Invalid source references' }
  }
  return { ok: true, category: input.category as MarketingRequestCategory, locale: input.locale }
}

export function clampFollowUpEvalLimit(limit?: number): number {
  const raw = limit ?? 50
  return Math.min(Math.max(Math.floor(raw), 1), MKT_FOLLOW_UP_EVAL_MAX_LIMIT)
}
