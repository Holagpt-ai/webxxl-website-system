import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
} from '@/lib/platform/open001/subscriber-evidence'
import { resolveSubscriberEligibility } from '@/lib/platform/open001/subscriber-eligibility'
import { assertStagingPilotFixtureEnvironment } from '@/lib/platform/pilot/staging-pilot-environment-guard'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import {
  buildStagingPilotFixturePlan,
  listForbiddenStagingPilotAccountIds,
  stagingPilotFixturePlansAreIdempotent,
} from '@/lib/platform/pilot/staging-pilot-fixture-plan'

describe('Batch 41 staging pilot tenant fixture (dry-run)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds a deterministic dry-run plan with stable idempotency key', () => {
    const first = buildStagingPilotFixturePlan({ env: {} })
    const second = buildStagingPilotFixturePlan({ env: {} })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(first.plan.idempotencyKey).toBe(second.plan.idempotencyKey)
    expect(stagingPilotFixturePlansAreIdempotent(first.plan, second.plan)).toBe(true)
    expect(first.plan.writesEnabled).toBe(false)
    expect(first.plan.steps).toHaveLength(7)
    expect(first.plan.accounts.subscriber.customerAccountId).toBe(STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID)
    expect(first.plan.accounts.nonSubscriber.customerAccountId).toBe(
      STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
    )
  })

  it('previews OPEN-001 eligibility: subscriber A qualified, B not eligible', () => {
    const result = buildStagingPilotFixturePlan({ env: {} })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.plan.eligibilityPreview.subscriber.outcome).toBe('QUALIFIED')
    expect(result.plan.eligibilityPreview.nonSubscriber.outcome).toBe('NOT_ELIGIBLE')

    const bDecision = evaluateIncludedFreeAccessForAccount({
      entitlementKey: 'core.crm',
      customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
      evidence: {
        ...emptySubscriberEvidence(STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID),
        loadOutcome: 'ok',
      },
    })
    expect(bDecision.allowed).toBe(false)
    if (!bDecision.allowed) {
      expect(bDecision.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
    }
  })

  it('does not entitle account B from account A subscription rows', () => {
    const evidence = {
      ...emptySubscriberEvidence(STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID),
      subscriptions: [
        {
          customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
          productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
          status: 'ACTIVE' as const,
        },
      ],
      loadOutcome: 'ok' as const,
    }
    expect(resolveSubscriberEligibility(STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID, evidence).outcome).toBe(
      'NOT_ELIGIBLE',
    )
  })

  it('refuses ABMED synthetic account ids for staging pilot fixtures', () => {
    expect(listForbiddenStagingPilotAccountIds(['acct_abmed_aesthetics'])).toEqual([
      'acct_abmed_aesthetics',
    ])
    const result = buildStagingPilotFixturePlan({ env: {} })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.refusedAccountIds).toEqual([])
    expect(result.plan.accounts.subscriber.customerAccountId.startsWith('acct_abmed_')).toBe(false)
  })

  it('refuses apply without confirmation and production database targets', () => {
    const apply = assertStagingPilotFixtureEnvironment({}, { mode: 'apply' })
    expect(apply.ok).toBe(false)
    if (apply.ok) return
    expect(apply.code).toBe('APPLY_CONFIRMATION_REQUIRED')

    const production = assertStagingPilotFixtureEnvironment(
      {
        DATABASE_URL: `postgresql://postgres.${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      },
      { mode: 'dry-run' },
    )
    expect(production.ok).toBe(false)
    if (production.ok) return
    expect(production.code).toBe('PRODUCTION_DATABASE_URL')
  })

  it('requires staging preflight when DATABASE_URL is bound', () => {
    vi.stubEnv(
      'DATABASE_URL',
      `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    )
    const blocked = buildStagingPilotFixturePlan({ env: process.env })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.guard.code).toBe('STAGING_PREFLIGHT_BLOCKED')
  })

  it('accepts dry-run when staging DATABASE_URL matches authorized identity env', () => {
    vi.stubEnv(
      'DATABASE_URL',
      `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    )
    vi.stubEnv('DIRECT_URL', process.env.DATABASE_URL!)
    vi.stubEnv(
      'WEBXXL_STAGING_DATABASE_IDENTITY',
      `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
    )
    vi.stubEnv(
      'WEBXXL_PRODUCTION_DATABASE_IDENTITY',
      `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
    )

    const result = buildStagingPilotFixturePlan({ env: process.env })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.writesEnabled).toBe(false)
  })
})
