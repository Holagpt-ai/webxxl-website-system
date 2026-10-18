import type { SeoErrorCode } from '@/lib/platform/seo/types'

export class SeoApiError extends Error {
  readonly status: number
  readonly code: SeoErrorCode

  constructor(status: number, message: string, code: SeoErrorCode) {
    super(message)
    this.status = status
    this.code = code
  }
}
