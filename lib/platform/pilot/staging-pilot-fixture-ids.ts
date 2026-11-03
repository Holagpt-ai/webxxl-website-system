/** Stable staging pilot fixture identifiers (Batch 41 / PILOT-21B). Not ABMED Vitest fixtures. */

export const STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID = 'acct_pilot_staging_a' as const
export const STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID = 'acct_pilot_staging_b' as const

export const STAGING_PILOT_SUBSCRIBER_USER_ID = 'user_pilot_staging_a' as const
export const STAGING_PILOT_NON_SUBSCRIBER_USER_ID = 'user_pilot_staging_b' as const

export const STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID = 'group_pilot_staging_a' as const
export const STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID = 'group_pilot_staging_b' as const

export const STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID =
  'sub_pilot_staging_a_website' as const

/** Supabase project refs recorded in rollout docs — used for production refusal only. */
export const WEBXXL_RECORDED_STAGING_SUPABASE_REF = 'vcgibefnhneaqhcguhnt' as const
export const WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF = 'txfxeehglqfszletuumn' as const

export const STAGING_PILOT_FORBIDDEN_ACCOUNT_ID_PREFIXES = ['acct_abmed_'] as const

export const STAGING_PILOT_FIXTURE_PLAN_VERSION = 'batch41-staging-pilot-v1' as const
