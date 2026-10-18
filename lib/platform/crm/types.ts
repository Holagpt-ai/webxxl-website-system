export type CrmResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export type CrmDomainErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'POLICY_UNRESOLVED'
  | 'PROVIDER_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'CROSS_ACCOUNT_DENIED'
  | 'BILLING_GROUP_NOT_AUTHORIZATION'
  | 'CRM_DISABLED'
