import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { validateChatwootMappings, type ChatwootAccountMapping } from '@/lib/platform/integrations/chatwoot-account-mapping'

export const UNRELATED_BUSINESS_ACCOUNT_ID = 'acct_unrelated_demo'
export const CHATWOOT_PROVIDER_INSTANCE_ID = 'chatwoot_staging_infra02'

export function buildSyntheticAbmedChatwootMappings(): ChatwootAccountMapping[] {
  return [
    {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      chatwootAccountId: 'cw_acct_aesthetics',
      chatwootInboxIds: ['cw_inbox_aesthetics_web'],
      isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
    },
    {
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      chatwootAccountId: 'cw_acct_physicians',
      chatwootInboxIds: ['cw_inbox_physicians_web'],
      isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
    },
    {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      chatwootAccountId: 'cw_acct_clinical',
      chatwootInboxIds: ['cw_inbox_clinical_web'],
      isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
    },
    {
      customerAccountId: UNRELATED_BUSINESS_ACCOUNT_ID,
      billingGroupId: 'group_unrelated',
      chatwootAccountId: 'cw_acct_unrelated',
      chatwootInboxIds: ['cw_inbox_unrelated'],
      isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
    },
  ]
}

export function assertAbmedChatwootIsolation(): { ok: true } | { ok: false; message: string } {
  const mappings = buildSyntheticAbmedChatwootMappings()
  const result = validateChatwootMappings(mappings)
  if (!result.ok) return { ok: false, message: result.message }
  const aesthetics = mappings.find((m) => m.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!
  const physicians = mappings.find((m) => m.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID)!
  if (aesthetics.chatwootAccountId === physicians.chatwootAccountId) {
    return { ok: false, message: 'ABMED siblings must not share Chatwoot accounts' }
  }
  return { ok: true }
}
