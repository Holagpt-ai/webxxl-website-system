export function socialResultHttpStatus(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
    case 'CHANNEL_NOT_FOUND':
      return 404
    case 'INVALID_BODY':
    case 'INVALID_PLATFORM':
    case 'INVALID_QUOTA_CONFIG':
    case 'SCHEDULE_TIME_MISMATCH':
    case 'CHANNEL_NOT_IN_SCOPE':
    case 'NO_REVISION':
    case 'NO_APPROVED_REVISION':
    case 'APPROVAL_NOT_FOUND':
    case 'APPROVAL_CLOSED':
    case 'APPROVAL_ARTIFACT_MISMATCH':
    case 'APPROVAL_EXPIRED':
    case 'INVALID_STATE':
    case 'INVALID_TRANSITION':
      return 400
    case 'QUOTA_EXCEEDED':
      return 429
    case 'IDEMPOTENCY_CONFLICT':
    case 'CONFLICT':
      return 409
    case 'CROSS_ACCOUNT_DENIED':
    case 'INTEGRATION_NOT_AUTHORIZED':
    case 'BILLING_GROUP_NOT_AUTHORIZATION':
    case 'UNAUTHORIZED':
    case 'UNAUTHORIZED_APPROVER':
    case 'AGENT_IMPERSONATION_DENIED':
    case 'ENTITLEMENT_DISABLED':
    case 'FORGED_APPROVAL':
    case 'APPROVAL_INVALID':
    case 'APPROVAL_EXHAUSTED':
      return 403
    case 'SOCIAL_MARKETING_DISABLED':
    case 'ENTITLEMENT_MISSING':
    case 'WORKSPACE_ISOLATION_REQUIRED':
      return 503
    default:
      return 422
  }
}
