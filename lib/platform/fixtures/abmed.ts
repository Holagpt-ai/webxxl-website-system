import { createEmptyPlatformStore, nextId, type InMemoryPlatformStore } from '@/lib/platform/wallet/in-memory-store'

export const ABMED_GROUP_ID = 'group_abmed'
export const ABMED_WALLET_ID = 'wallet_abmed_messaging'
export const ABMED_AESTHETICS_ACCOUNT_ID = 'acct_abmed_aesthetics'
export const ABMED_PHYSICIANS_ACCOUNT_ID = 'acct_abmed_physicians'
export const ABMED_CLINICAL_ACCOUNT_ID = 'acct_abmed_clinical'
export const EXISTING_ABMED_ACCOUNT_ID = 'abmed-account'
export const EXISTING_ABMED_PROJECT_ID = 'abmed-clinical-research-redesign'
export const BILLING_OWNER_USER_ID = 'user_abmed_billing_owner'
export const CLINICAL_ONLY_USER_ID = 'user_abmed_clinical_member'

const now = new Date('2026-10-17T00:00:00.000Z')

export function createSyntheticAbmedFoundation(): InMemoryPlatformStore {
  const store = createEmptyPlatformStore()

  store.users.set(BILLING_OWNER_USER_ID, { id: BILLING_OWNER_USER_ID, email: 'billing@abmed.example' })
  store.users.set(CLINICAL_ONLY_USER_ID, { id: CLINICAL_ONLY_USER_ID, email: 'clinical@abmed.example' })

  for (const account of [
    { id: ABMED_AESTHETICS_ACCOUNT_ID, businessName: 'ABMED Aesthetics', slug: 'abmed-aesthetics' },
    { id: ABMED_PHYSICIANS_ACCOUNT_ID, businessName: 'ABMED Physicians Group', slug: 'abmed-physicians' },
    { id: ABMED_CLINICAL_ACCOUNT_ID, businessName: 'ABMED Clinical Research', slug: 'abmed-clinical-research' },
    { id: EXISTING_ABMED_ACCOUNT_ID, businessName: 'ABMED existing account', slug: 'abmed' },
  ]) {
    store.accounts.set(account.id, account)
  }

  store.operatingMemberships.push(
    { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
    { userId: CLINICAL_ONLY_USER_ID, customerAccountId: EXISTING_ABMED_ACCOUNT_ID },
  )

  store.sites.push(
    { id: 'site_abmed_aesthetics', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID, name: 'ABMED Aesthetics site' },
    { id: 'site_abmed_physicians', customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID, name: 'ABMED Physicians site' },
    { id: 'site_abmed_clinical', customerAccountId: ABMED_CLINICAL_ACCOUNT_ID, name: 'ABMED Clinical Research site' },
  )

  store.agentConfigs.push(
    {
      id: 'agent_abmed_aesthetics_receptionist',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site_abmed_aesthetics',
      kind: 'receptionist',
      enabled: false,
    },
    {
      id: 'agent_abmed_physicians_receptionist',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      managedSiteId: 'site_abmed_physicians',
      kind: 'receptionist',
      enabled: false,
    },
    {
      id: 'agent_abmed_clinical_receptionist',
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      managedSiteId: 'site_abmed_clinical',
      kind: 'receptionist',
      enabled: false,
    },
  )

  store.groups.set(ABMED_GROUP_ID, {
    id: ABMED_GROUP_ID,
    name: 'ABMED Group',
    slug: 'abmed-group',
    status: 'ACTIVE',
    defaultCurrency: 'USD',
    billingPolicyVersion: 'v1',
  })

  store.profiles.push({
    id: nextId('profile'),
    billingGroupId: ABMED_GROUP_ID,
    legalPayerName: 'ABMED Parent',
    currency: 'USD',
    defaultMethodRef: 'pm_ref_synthetic',
  })

  store.roles.push({
    id: nextId('role'),
    billingGroupId: ABMED_GROUP_ID,
    userId: BILLING_OWNER_USER_ID,
    role: 'GROUP_OWNER',
  })

  for (const accountId of [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_CLINICAL_ACCOUNT_ID]) {
    store.memberships.push({
      id: nextId('bgm'),
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: accountId,
      status: 'ACTIVE',
      validFrom: now,
      validTo: null,
      authorizedByUserId: BILLING_OWNER_USER_ID,
      walletUseAllowed: true,
      spendingPolicyId: null,
      activeFundingKey: accountId,
    })
    store.policies.push({
      id: nextId('pol'),
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: accountId,
      dailyLimit: null,
      monthlyLimit: null,
      maxCampaignCredits: 1000,
      allowedChannels: ['SMS'],
    })
  }

  store.wallets.set(ABMED_WALLET_ID, {
    id: ABMED_WALLET_ID,
    billingGroupId: ABMED_GROUP_ID,
    creditType: 'MESSAGING',
    unit: 'CREDITS',
    status: 'ACTIVE',
    ledgerSequence: 0,
  })

  return store
}

export const SYNTHETIC_ABMED_USAGE = {
  startingCredits: 1000,
  aesthetics: 200,
  physicians: 100,
  clinical: 50,
  expectedAfterAesthetics: 800,
  expectedAfterPhysicians: 700,
  expectedAfterClinical: 650,
} as const
