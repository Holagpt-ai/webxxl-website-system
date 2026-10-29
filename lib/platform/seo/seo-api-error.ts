export class SeoApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code = 'FORBIDDEN') {
    super(message)
    this.status = status
    this.code = code
  }
}
