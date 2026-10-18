import type { AiToolGrant } from '@/lib/platform/ai-tools/types'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  BILLING_OWNER_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import { INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import { createWorkforceStore, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import type { TrustedWorkforceHumanActor } from '@/lib/platform/workforce/operator-auth'

export const STAFF_APPROVER_USER_ID = 'user_webxxl_staff_approver'
export const UNRELATED_OPERATOR_USER_ID = 'user_unrelated_operator'
export const UNRELATED_CUSTOMER_ACCOUNT_ID = 'acct_unrelated_customer'

export function trustedStaffApprover(): TrustedWorkforceHumanActor {
  return {
    kind: 'verified_human',
    userId: STAFF_APPROVER_USER_ID,
    permissions: ['workforce.approve', 'workforce.pause'],
    platformWide: true,
  }
}

export function registerSyntheticTrustedOperators(store: WorkforceStore): void {
  store.trustedHumanOperators.set(STAFF_APPROVER_USER_ID, {
    permissions: ['workforce.approve', 'workforce.pause'],
    platformWide: true,
  })
  store.trustedHumanOperators.set(BILLING_OWNER_USER_ID, {
    permissions: ['workforce.approve'],
    platformWide: false,
  })
}

export function createAgent03TestStore(): WorkforceStore {
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
  registerSyntheticTrustedOperators(store)
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
