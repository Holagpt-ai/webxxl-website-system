import type { MktErrorCode } from '@/lib/platform/marketing/types'

export function mktResultHttpStatus(code: MktErrorCode): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'FORBIDDEN':
      return 403
    case 'CONFLICT':
      return 409
    case 'VALIDATION':
    case 'PHI_DENIED':
    case 'AD_SPEND_DENIED':
      return 400
    case 'NOT_CONFIGURED':
    case 'MKT_DISABLED':
    case 'POLICY_UNRESOLVED':
      return 503
    case 'BLOCKED':
      return 422
    default:
      return 500
  }
}
