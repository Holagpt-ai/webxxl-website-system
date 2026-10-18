function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isWalletBackendEnabled(): boolean {
  return envFlag('WALLET_BACKEND_ENABLED', false)
}

export function isWalletGroupReadEnabled(): boolean {
  return envFlag('WALLET_GROUP_READ_ENABLED', false)
}

export function isWalletReservationEnabled(): boolean {
  return envFlag('WALLET_RESERVATION_ENABLED', false)
}

export function isWalletSettlementEnabled(): boolean {
  return envFlag('WALLET_SETTLEMENT_ENABLED', false)
}

export function isWalletRefundEnabled(): boolean {
  return envFlag('WALLET_REFUND_ENABLED', false)
}

export function isWalletTopUpEnabled(): boolean {
  return envFlag('WALLET_TOPUP_ENABLED', false)
}

export function isWalletProviderReconciliationEnabled(): boolean {
  return envFlag('WALLET_PROVIDER_RECONCILIATION_ENABLED', false)
}

export function isTwilioAdapterEnabled(): boolean {
  return envFlag('TWILIO_ADAPTER_ENABLED', false)
}

export function isResendTransportEnabled(): boolean {
  return envFlag('RESEND_TRANSPORT_ENABLED', false)
}

export function isWalletCommsIntegrationEnabled(): boolean {
  return envFlag('WALLET_COMMS_INTEGRATION_ENABLED', false)
}

/** Integer credit units; no fractional messaging credits in WALLET-09. */
export const WALLET_CREDIT_UNIT = 'CREDITS' as const

export const WALLET_LIST_DEFAULT_TAKE = Number(process.env.WALLET_LIST_DEFAULT_TAKE ?? '50')
export const WALLET_LIST_MAX_TAKE = Number(process.env.WALLET_LIST_MAX_TAKE ?? '200')

export const WALLET_RESERVATION_MAX_RETRIES = Number(process.env.WALLET_RESERVATION_MAX_RETRIES ?? '3')

/** Test-only synthetic TOP_UP minting (Vitest sets WALLET_SYNTHETIC_FUNDING_ENABLED=true). */
export function isWalletSyntheticFundingAllowed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.WALLET_SYNTHETIC_FUNDING_ENABLED === 'true'
}

/** Mock HTTP transports for provider adapters — never in production runtime. */
export function isWalletProviderMockTransportAllowed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.WALLET_PROVIDER_MOCK_TRANSPORT_ENABLED === 'true'
}
