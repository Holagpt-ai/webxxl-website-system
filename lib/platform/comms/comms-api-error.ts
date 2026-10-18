import type { CommsErrorCode } from '@/lib/platform/comms/types'

export class CommsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: CommsErrorCode,
  ) {
    super(message)
    this.name = 'CommsApiError'
  }
}
