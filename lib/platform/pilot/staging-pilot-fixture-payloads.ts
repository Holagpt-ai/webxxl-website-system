import { WEBSITE_SUBSCRIPTION_PRODUCT_KEY } from '@/lib/platform/open001/subscriber-evidence'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
  STAGING_PILOT_SUBSCRIBER_USER_ID,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

/** Deterministic fixture payloads — no secrets; staging pilot only. */
export const STAGING_PILOT_SUBSCRIBER_EMAIL = 'pilot-staging-a@staging.webxxl.invalid' as const
export const STAGING_PILOT_NON_SUBSCRIBER_EMAIL = 'pilot-staging-b@staging.webxxl.invalid' as const

export const STAGING_PILOT_SUBSCRIBER_ACCOUNT_SLUG = 'pilot-staging-a' as const
export const STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_SLUG = 'pilot-staging-b' as const

export const STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_SLUG = 'pilot-staging-a-payer' as const
export const STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_SLUG = 'pilot-staging-b-payer' as const

export const STAGING_PILOT_BILLING_GROUP_MEMBERSHIP_A_ID = 'bgm_pilot_staging_a' as const
export const STAGING_PILOT_BILLING_GROUP_MEMBERSHIP_B_ID = 'bgm_pilot_staging_b' as const

export const STAGING_PILOT_WEBSITE_SUBSCRIPTION_PROVIDER_KEY = 'internal-staging-pilot' as const

export type StagingPilotFixturePayloadSpec = {
  billingGroups: Array<{ id: string; name: string; slug: string }>
  customerAccounts: Array<{ id: string; businessName: string; slug: string }>
  users: Array<{ id: string; email: string; preferredLocale: 'en' | 'es' }>
  customerMemberships: Array<{ userId: string; customerAccountId: string; role: 'MEMBER' }>
  billingGroupMemberships: Array<{
    id: string
    billingGroupId: string
    customerAccountId: string
  }>
  subscription: {
    publicId: string
    billingGroupId: string
    customerAccountId: string
    productKey: typeof WEBSITE_SUBSCRIPTION_PRODUCT_KEY
    status: 'ACTIVE'
    providerKey: string
  }
}

export function stagingPilotFixturePayloadSpec(): StagingPilotFixturePayloadSpec {
  return {
    billingGroups: [
      {
        id: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
        name: 'Pilot Staging A Payer',
        slug: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_SLUG,
      },
      {
        id: STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
        name: 'Pilot Staging B Payer',
        slug: STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_SLUG,
      },
    ],
    customerAccounts: [
      {
        id: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        businessName: 'Pilot Staging Subscriber A',
        slug: STAGING_PILOT_SUBSCRIBER_ACCOUNT_SLUG,
      },
      {
        id: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
        businessName: 'Pilot Staging Member B',
        slug: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_SLUG,
      },
    ],
    users: [
      {
        id: STAGING_PILOT_SUBSCRIBER_USER_ID,
        email: STAGING_PILOT_SUBSCRIBER_EMAIL,
        preferredLocale: 'en',
      },
      {
        id: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
        email: STAGING_PILOT_NON_SUBSCRIBER_EMAIL,
        preferredLocale: 'es',
      },
    ],
    customerMemberships: [
      {
        userId: STAGING_PILOT_SUBSCRIBER_USER_ID,
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        role: 'MEMBER',
      },
      {
        userId: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
        customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
        role: 'MEMBER',
      },
    ],
    billingGroupMemberships: [
      {
        id: STAGING_PILOT_BILLING_GROUP_MEMBERSHIP_A_ID,
        billingGroupId: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
      },
      {
        id: STAGING_PILOT_BILLING_GROUP_MEMBERSHIP_B_ID,
        billingGroupId: STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
        customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
      },
    ],
    subscription: {
      publicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
      billingGroupId: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
      customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
      productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
      status: 'ACTIVE',
      providerKey: STAGING_PILOT_WEBSITE_SUBSCRIPTION_PROVIDER_KEY,
    },
  }
}
