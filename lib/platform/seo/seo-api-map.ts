import type { SeoErrorCode } from '@/lib/platform/seo/types'

export function seoResultHttpStatus(code: SeoErrorCode): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'FORBIDDEN':
      return 403
    case 'CONFLICT':
      return 409
    case 'VALIDATION':
      return 400
    case 'NOT_CONFIGURED':
    case 'SEO_DISABLED':
    case 'POLICY_UNRESOLVED':
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return 503
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
      return 403
    case 'CRAWL_BLOCKED':
      return 422
    default:
      return 500
  }
}
