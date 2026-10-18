/** Enables durable wallet mutations in Vitest without turning on production WALLET_BACKEND_ENABLED. */
export function enableWalletDurableTestExecution(): void {
  process.env.WALLET_TEST_EXECUTION_BYPASS = 'true'
  process.env.WALLET_RESERVATION_ENABLED = 'true'
  process.env.WALLET_SETTLEMENT_ENABLED = 'true'
  process.env.WALLET_REFUND_ENABLED = 'true'
  process.env.WALLET_PROVIDER_RECONCILIATION_ENABLED = 'true'
}
