import { createHash } from 'node:crypto'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
  type SubscriberEvidenceSnapshot,
} from '@/lib/platform/open001/subscriber-evidence'
import {
  resolveSubscriberEligibility,
  type SubscriberEligibilityResult,
} from '@/lib/platform/open001/subscriber-eligibility'
import {
  assertStagingPilotFixtureEnvironment,
  type StagingPilotFixtureGuardResult,
} from '@/lib/platform/pilot/staging-pilot-environment-guard'
import {
  STAGING_PILOT_FIXTURE_PLAN_VERSION,
  STAGING_PILOT_FORBIDDEN_ACCOUNT_ID_PREFIXES,
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
  STAGING_PILOT_SUBSCRIBER_USER_ID,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type StagingPilotFixturePlanMode = 'dry-run'

export type StagingPilotFixtureEntity =
  | 'BillingGroup'
  | 'CustomerAccount'
  | 'CustomerMembership'
  | 'CommerceSubscription'

export type StagingPilotFixturePlanStep = {
  stepId: string
  entity: StagingPilotFixtureEntity
  operation: 'upsert'
  naturalKey: Record<string, string>
  payloadSummary: string
}

export type StagingPilotFixtureAccountPlan = {
  role: 'subscriber' | 'non_subscriber'
  customerAccountId: string
  billingGroupId: string
  membershipUserId: string
  websiteSubscriptionPublicId: string | null
}

export type StagingPilotFixturePlan = {
  planVersion: typeof STAGING_PILOT_FIXTURE_PLAN_VERSION
  mode: StagingPilotFixturePlanMode
  stagingIntent: true
  authorizedStagingRef: typeof WEBXXL_RECORDED_STAGING_SUPABASE_REF
  writesEnabled: false
  accounts: {
    subscriber: StagingPilotFixtureAccountPlan
    nonSubscriber: StagingPilotFixtureAccountPlan
  }
  steps: StagingPilotFixturePlanStep[]
  eligibilityPreview: {
    subscriber: SubscriberEligibilityResult
    nonSubscriber: SubscriberEligibilityResult
  }
  idempotencyKey: string
  refusedAccountIds: string[]
}

export type BuildStagingPilotFixturePlanInput = {
  mode?: StagingPilotFixturePlanMode
  env?: Record<string, string | undefined>
}

export type BuildStagingPilotFixturePlanResult =
  | { ok: true; plan: StagingPilotFixturePlan; guard: Extract<StagingPilotFixtureGuardResult, { ok: true }> }
  | { ok: false; guard: Extract<StagingPilotFixtureGuardResult, { ok: false }> }

function stableSteps(): StagingPilotFixturePlanStep[] {
  return [
    {
      stepId: '01-billing-group-subscriber',
      entity: 'BillingGroup',
      operation: 'upsert',
      naturalKey: { id: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID },
      payloadSummary: 'Pilot staging payer group for subscriber account A (isolated from account B).',
    },
    {
      stepId: '02-billing-group-non-subscriber',
      entity: 'BillingGroup',
      operation: 'upsert',
      naturalKey: { id: STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID },
      payloadSummary: 'Pilot staging payer group for non-subscriber account B (isolated from account A).',
    },
    {
      stepId: '03-customer-account-subscriber',
      entity: 'CustomerAccount',
      operation: 'upsert',
      naturalKey: { id: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID },
      payloadSummary: 'Staging pilot subscriber account A (slug pilot-staging-a).',
    },
    {
      stepId: '04-customer-account-non-subscriber',
      entity: 'CustomerAccount',
      operation: 'upsert',
      naturalKey: { id: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID },
      payloadSummary: 'Staging pilot non-subscriber account B (slug pilot-staging-b).',
    },
    {
      stepId: '05-membership-subscriber',
      entity: 'CustomerMembership',
      operation: 'upsert',
      naturalKey: {
        userId: STAGING_PILOT_SUBSCRIBER_USER_ID,
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
      },
      payloadSummary: 'Membership for pilot user A on account A only.',
    },
    {
      stepId: '06-membership-non-subscriber',
      entity: 'CustomerMembership',
      operation: 'upsert',
      naturalKey: {
        userId: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
        customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
      },
      payloadSummary: 'Membership for pilot user B on account B only (no subscription evidence).',
    },
    {
      stepId: '07-subscription-subscriber',
      entity: 'CommerceSubscription',
      operation: 'upsert',
      naturalKey: { publicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID },
      payloadSummary: `ACTIVE ${WEBSITE_SUBSCRIPTION_PRODUCT_KEY} scoped to customerAccountId ${STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID} (not billing-group-only).`,
    },
  ]
}

function subscriberEvidenceFromPlan(): SubscriberEvidenceSnapshot {
  return {
    ...emptySubscriberEvidence(STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID),
    loadOutcome: 'synthetic',
    subscriptions: [
      {
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
        status: 'ACTIVE',
      },
    ],
  }
}

function nonSubscriberEvidenceFromPlan(): SubscriberEvidenceSnapshot {
  return {
    ...emptySubscriberEvidence(STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID),
    loadOutcome: 'synthetic',
    subscriptions: [],
  }
}

function computeIdempotencyKey(steps: StagingPilotFixturePlanStep[]): string {
  const canonical = JSON.stringify({
    planVersion: STAGING_PILOT_FIXTURE_PLAN_VERSION,
    steps: steps.map((s) => ({ stepId: s.stepId, naturalKey: s.naturalKey })),
  })
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function listForbiddenStagingPilotAccountIds(accountIds: string[]): string[] {
  return accountIds.filter((id) =>
    STAGING_PILOT_FORBIDDEN_ACCOUNT_ID_PREFIXES.some((prefix) => id.startsWith(prefix)),
  )
}

export function buildStagingPilotFixturePlan(
  input: BuildStagingPilotFixturePlanInput = {},
): BuildStagingPilotFixturePlanResult {
  const env = input.env ?? {}
  const guard = assertStagingPilotFixtureEnvironment(env, { mode: input.mode ?? 'dry-run' })
  if (!guard.ok) {
    return { ok: false, guard }
  }

  const steps = stableSteps()
  const refusedAccountIds = listForbiddenStagingPilotAccountIds([
    STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
    STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  ])

  const subscriberEvidence = subscriberEvidenceFromPlan()
  const nonSubscriberEvidence = nonSubscriberEvidenceFromPlan()

  const plan: StagingPilotFixturePlan = {
    planVersion: STAGING_PILOT_FIXTURE_PLAN_VERSION,
    mode: 'dry-run',
    stagingIntent: true,
    authorizedStagingRef: WEBXXL_RECORDED_STAGING_SUPABASE_REF,
    writesEnabled: false,
    accounts: {
      subscriber: {
        role: 'subscriber',
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        billingGroupId: STAGING_PILOT_SUBSCRIBER_BILLING_GROUP_ID,
        membershipUserId: STAGING_PILOT_SUBSCRIBER_USER_ID,
        websiteSubscriptionPublicId: STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
      },
      nonSubscriber: {
        role: 'non_subscriber',
        customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
        billingGroupId: STAGING_PILOT_NON_SUBSCRIBER_BILLING_GROUP_ID,
        membershipUserId: STAGING_PILOT_NON_SUBSCRIBER_USER_ID,
        websiteSubscriptionPublicId: null,
      },
    },
    steps,
    eligibilityPreview: {
      subscriber: resolveSubscriberEligibility(
        STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        subscriberEvidence,
      ),
      nonSubscriber: resolveSubscriberEligibility(
        STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
        nonSubscriberEvidence,
      ),
    },
    idempotencyKey: computeIdempotencyKey(steps),
    refusedAccountIds,
  }

  return { ok: true, plan, guard }
}

/** Returns true when replanning would emit the same idempotency key and step count. */
export function stagingPilotFixturePlansAreIdempotent(
  first: StagingPilotFixturePlan,
  second: StagingPilotFixturePlan,
): boolean {
  return (
    first.idempotencyKey === second.idempotencyKey &&
    first.steps.length === second.steps.length &&
    first.writesEnabled === false &&
    second.writesEnabled === false
  )
}
