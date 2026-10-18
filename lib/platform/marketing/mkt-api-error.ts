import type { MktErrorCode } from '@/lib/platform/marketing/types'

export class MktApiError extends Error {
  readonly status: number
  readonly code: MktErrorCode

  constructor(status: number, message: string, code: MktErrorCode) {
    super(message)
    this.status = status
    this.code = code
  }
}
