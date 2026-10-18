import { validateChatwootMappings, type ChatwootAccountMapping } from '@/lib/platform/integrations/chatwoot-account-mapping'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CrmChatwootContactRef = {
  customerAccountId: string
  crmContactId: string
  chatwootAccountId: string
  chatwootContactId: string
  chatwootInboxId?: string
  lastSyncedEventId?: string
  coverageStatus: 'NOT_CONNECTED' | 'PARTIAL' | 'CONNECTED'
}

export function assertChatwootTenantIsolation(mappings: ChatwootAccountMapping[]): CrmResult<true> {
  const result = validateChatwootMappings(mappings)
  if (!result.ok) return { ok: false, code: 'FORBIDDEN', message: result.message }
  return { ok: true, value: true }
}
