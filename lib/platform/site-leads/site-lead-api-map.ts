import type { SiteLeadErrorCode } from '@/lib/platform/site-leads/types'

export function siteLeadResultHttpStatus(code: SiteLeadErrorCode): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'FORBIDDEN':
      return 403
    case 'CONFLICT':
      return 409
    case 'VALIDATION':
    case 'PAYLOAD_TOO_LARGE':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'RATE_LIMIT':
      return 429
    case 'SITE_LEAD_INTAKE_DISABLED':
    case 'CRM_DISABLED':
    case 'NOT_CONFIGURED':
    case 'POLICY_UNRESOLVED':
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return 503
    default:
      return 500
  }
}
