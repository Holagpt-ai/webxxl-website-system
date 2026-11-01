function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Customer AI workforce HTTP and persistence APIs. Default off. */
export function isCustomerAiWorkforceEnabled(): boolean {
  return envFlag('CUSTOMER_AI_WORKFORCE_ENABLED', false)
}

/** LLM / agent runtime execution (no production calls when false). */
export function isCustomerAiExecutionEnabled(): boolean {
  return envFlag('CUSTOMER_AI_EXECUTION_ENABLED', false)
}

/** Outbound customer messaging from AI employees. Default off. */
export function isCustomerAiOutboundEnabled(): boolean {
  return envFlag('CUSTOMER_AI_OUTBOUND_ENABLED', false)
}

/** Future Chatwoot adapter sync/send. Does not enable COMMS-06 dispatch. */
export function isCustomerAiChatwootAdapterEnabled(): boolean {
  return envFlag('CUSTOMER_AI_CHATWOOT_ADAPTER_ENABLED', false)
}

export function customerAiDefaultEntitlementKey(): string {
  return 'future.ai-employee'
}

/** Guarded pilot task preparation workflow (Batch 36). Does not enable LLM execution. */
export function isCustomerAiPilotPrepEnabled(): boolean {
  return envFlag('CUSTOMER_AI_PILOT_PREP_ENABLED', false)
}

/**
 * HTTP routes for non-durable in-process pilot tasks. Default off — unsuitable for Vercel production.
 * Library preparation (e.g. Vitest) may use CUSTOMER_AI_PILOT_PREP_ENABLED without this flag.
 */
export function isCustomerAiPilotHttpEnabled(): boolean {
  return envFlag('CUSTOMER_AI_PILOT_HTTP_ENABLED', false)
}

/** Allows TEST_SYNTHETIC snapshots in library prep (Vitest only). Never enable in production. */
export function isCustomerAiPilotTestSyntheticEnabled(): boolean {
  return envFlag('CUSTOMER_AI_PILOT_TEST_SYNTHETIC', false)
}

export function customerAiUsagePeriodKey(at: Date = new Date()): string {
  const year = at.getUTCFullYear()
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
