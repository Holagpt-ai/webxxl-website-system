import type { AutomationDeliveryChannel } from '@prisma/client'

/** Outcome classes for notification delivery jobs (string column on AutomationDeliveryJob). */
export const DELIVERY_OUTCOME_UNKNOWN_EXTERNAL = 'unknown_external_outcome'
export const DELIVERY_OUTCOME_PROVIDER_UNCERTAIN = 'provider_uncertain'
export const DELIVERY_OUTCOME_LEASE_EXPIRED = 'lease_expired'

export function isExternalDeliveryChannel(channel: AutomationDeliveryChannel): boolean {
  return channel === 'EMAIL' || channel === 'SMS' || channel === 'WHATSAPP'
}

export function isQuarantinedDeliveryOutcome(lastErrorClass: string | null | undefined): boolean {
  return (
    lastErrorClass === DELIVERY_OUTCOME_UNKNOWN_EXTERNAL ||
    lastErrorClass === DELIVERY_OUTCOME_PROVIDER_UNCERTAIN
  )
}

/** Crash during external send may have succeeded at provider — never auto-resend. */
export function classifyExpiredExternalDelivery(input: {
  channel: AutomationDeliveryChannel
  providerRef: string | null
  hadDeliveryError: boolean
}): 'quarantine' | 'safe_retry' {
  if (!isExternalDeliveryChannel(input.channel)) return 'safe_retry'
  if (input.providerRef) return 'safe_retry'
  return 'quarantine'
}
