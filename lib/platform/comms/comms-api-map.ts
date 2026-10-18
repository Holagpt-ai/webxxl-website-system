import type { CommsErrorCode } from '@/lib/platform/comms/types'

export function commsResultHttpStatus(code: CommsErrorCode): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'FORBIDDEN':
    case 'UNAUTHORIZED':
      return 403
    case 'CONFLICT':
      return 409
    case 'VALIDATION':
      return 400
    case 'NOT_CONFIGURED':
    case 'POLICY_UNRESOLVED':
    case 'COMMS_DISABLED':
      return 503
    case 'QUARANTINED':
      return 422
    default:
      return 500
  }
}
