export class CrmApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'FORBIDDEN',
  ) {
    super(message)
    this.name = 'CrmApiError'
  }
}
