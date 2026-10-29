export function crmResultHttpStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_ERROR':
      return 400
    case 'CONFLICT':
      return 409
    case 'QUOTA_EXCEEDED':
      return 429
    case 'FORBIDDEN':
    case 'CROSS_ACCOUNT_DENIED':
    case 'BILLING_GROUP_NOT_AUTHORIZATION':
      return 403
    case 'CRM_DISABLED':
    case 'POLICY_UNRESOLVED':
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
    case 'PROVIDER_UNAVAILABLE':
      return 503
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
      return 403
    default:
      return 422
  }
}
