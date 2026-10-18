import type { AiToolGrant } from '@/lib/platform/ai-tools/types'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  BILLING_OWNER_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import { INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import { createWorkforceStore } from '@/lib/platform/workforce/in-memory-store'

export const STAFF_APPROVER_USER_ID = 'user_webxxl_staff_approver'
export const UNRELATED_CUSTOMER_ACCOUNT_ID = 'acct_unrelated_customer'

export function createAgent03TestStore(): ReturnType<typeof createWorkforceStore> {
  const grants: AiToolGrant[] = [
    {
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      approvalRequired: true,
    },
    {
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      approvalRequired: true,
    },
    {
      actorId: INTERNAL_AGENT_KEYS.operations,
      actorType: 'AGENT',
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      toolKey: 'hosting.readStatus',
      approvalRequired: false,
    },
  ]
  const store = createWorkforceStore(grants)
  store.operatingMemberships.push(
    { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
    { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID },
    { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
    { userId: STAFF_APPROVER_USER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
  )
  for (const agent of store.agents.values()) {
    agent.paused = false
  }
  return store
}
