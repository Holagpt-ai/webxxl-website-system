import type { MarketingRequestStatus, MarketingRequestType } from '@prisma/client'

export type MktResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: MktErrorCode; message: string }

export type MktErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NOT_CONFIGURED'
  | 'POLICY_UNRESOLVED'
  | 'FREE_SOFTWARE_NOT_ELIGIBLE'
  | 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE'
  | 'LEGACY_EVIDENCE_AMBIGUOUS'
  | 'MKT_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'BLOCKED'
  | 'PHI_DENIED'
  | 'AD_SPEND_DENIED'

export type MarketingRequestCategory =
  | 'LANDING_PAGE'
  | 'SEO_CONTENT_FIX'
  | 'AD_CREATIVE'
  | 'SOCIAL_CONTENT_PLAN'
  | 'CAMPAIGN_PREPARATION'
  | 'CRM_LEAD_FOLLOW_UP'

export function mapCategoryToRequestType(category: MarketingRequestCategory): MarketingRequestType {
  switch (category) {
    case 'LANDING_PAGE':
      return 'LANDING_PAGE'
    case 'SEO_CONTENT_FIX':
      return 'SEO_FIX'
    case 'AD_CREATIVE':
      return 'AD_CREATIVE'
    case 'SOCIAL_CONTENT_PLAN':
      return 'SOCIAL_CAMPAIGN'
    case 'CAMPAIGN_PREPARATION':
      return 'CAMPAIGN_PLAN'
    case 'CRM_LEAD_FOLLOW_UP':
      return 'CAMPAIGN_PLAN'
    default:
      return 'LANDING_PAGE'
  }
}

export const MARKETING_TERMINAL_STATUSES: MarketingRequestStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']
