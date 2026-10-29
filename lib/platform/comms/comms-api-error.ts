export class CommsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'FORBIDDEN',
  ) {
    super(message)
    this.name = 'CommsApiError'
  }
}
