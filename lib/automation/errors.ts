export type SanitizedDeliveryError =
  | 'not_configured'
  | 'invalid_recipient'
  | 'preference_opt_out'
  | 'provider_rejected'
  | 'provider_timeout'
  | 'unknown'

export function classifyDeliveryError(error: unknown): SanitizedDeliveryError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('not_configured')) return 'not_configured'
    if (msg.includes('opt_out') || msg.includes('preference')) return 'preference_opt_out'
    if (msg.includes('recipient')) return 'invalid_recipient'
    if (msg.includes('timeout')) return 'provider_timeout'
    if (msg.includes('rejected') || msg.includes('failed')) return 'provider_rejected'
  }
  return 'unknown'
}

export function computeBackoffSeconds(attempts: number): number {
  const base = 60
  const capped = Math.min(base * 2 ** Math.max(0, attempts - 1), 3600)
  return capped
}
