export class WalletApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'WalletApiError'
  }
}

export function walletRouteError(error: unknown): Response {
  if (error instanceof WalletApiError) {
    return Response.json({ code: error.code, message: error.message }, { status: error.status })
  }
  return Response.json({ code: 'INTERNAL', message: 'Unexpected wallet API error' }, { status: 500 })
}
