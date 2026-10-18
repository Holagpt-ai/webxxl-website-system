/**
 * Maps WebXXL CustomerAccount identity to Chatwoot tenant objects.
 * COMMS-06 will persist these; INFRA-02 defines isolation rules only.
 */

export type ChatwootAccountMapping = {
  customerAccountId: string
  billingGroupId: string
  chatwootAccountId: string
  /** Inbox IDs scoped to this customer account only */
  chatwootInboxIds: string[]
  isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT' | 'VALIDATED_INBOX_PARTITION'
}

export type ChatwootMappingValidation =
  | { ok: true }
  | { ok: false; code: 'SHARED_CHATWOOT_ACCOUNT'; message: string }

/** ABMED and all multi-site payers: one WebXXL account must not reuse another account's Chatwoot account ID. */
export function validateChatwootMappings(mappings: ChatwootAccountMapping[]): ChatwootMappingValidation {
  const byChatwootAccount = new Map<string, string>()
  for (const row of mappings) {
    const prior = byChatwootAccount.get(row.chatwootAccountId)
    if (prior && prior !== row.customerAccountId) {
      return {
        ok: false,
        code: 'SHARED_CHATWOOT_ACCOUNT',
        message: `Chatwoot account ${row.chatwootAccountId} cannot serve multiple WebXXL customer accounts (${prior}, ${row.customerAccountId})`,
      }
    }
    byChatwootAccount.set(row.chatwootAccountId, row.customerAccountId)
  }
  return { ok: true }
}
