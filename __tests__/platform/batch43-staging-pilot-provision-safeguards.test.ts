import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertStagingPilotFixtureEnvironment } from '@/lib/platform/pilot/staging-pilot-environment-guard'
import { detectStagingPilotFixtureCollisions } from '@/lib/platform/pilot/staging-pilot-fixture-collision'
import { executeStagingPilotFixtureApply } from '@/lib/platform/pilot/staging-pilot-fixture-execute'
import {
  STAGING_PILOT_APPLY_AUTHORIZATION_ENV,
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
  STAGING_PILOT_SUBSCRIBER_USER_ID,
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import { buildStagingPilotFixtureApplyReport } from '@/lib/platform/pilot/staging-pilot-fixture-reconcile'
import { buildStagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'
import {
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_SLUG,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_SLUG,
  STAGING_PILOT_SUBSCRIBER_EMAIL,
  stagingPilotFixturePayloadSpec,
} from '@/lib/platform/pilot/staging-pilot-fixture-payloads'
import type { StagingPilotFixtureState } from '@/lib/platform/pilot/staging-pilot-fixture-inspect'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'
import { emptySubscriberEvidence, WEBSITE_SUBSCRIPTION_PRODUCT_KEY } from '@/lib/platform/open001/subscriber-evidence'

function stagingEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  const url = `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  return {
    DATABASE_URL: url,
    DIRECT_URL: url,
    WEBXXL_STAGING_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
    WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
    WEBXXL_STAGING_BOUNDARIES_CONFIRMED: '1',
    [STAGING_PILOT_APPLY_AUTHORIZATION_ENV]: '1',
    ...overrides,
  }
}

function emptyState(): StagingPilotFixtureState {
  const missing = (id: string) => ({ present: false, summary: `${id} not found` })
  const payload = stagingPilotFixturePayloadSpec()
  return {
    billingGroups: Object.fromEntries(payload.billingGroups.map((g) => [g.id, missing(g.id)])),
    customerAccounts: Object.fromEntries(payload.customerAccounts.map((a) => [a.id, missing(a.id)])),
    users: Object.fromEntries(payload.users.map((u) => [u.id, missing(u.id)])),
    customerMemberships: Object.fromEntries(
      payload.customerMemberships.map((m) => [`${m.userId}:${m.customerAccountId}`, missing('membership')]),
    ),
    billingGroupMemberships: Object.fromEntries(
      payload.billingGroupMemberships.map((m) => [m.customerAccountId, missing(m.id)]),
    ),
    subscriptions: {
      [STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID]: missing(STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID),
    },
    catalog: {
      websiteSubscriptionProduct: {
        present: true,
        productId: 'prod_test',
        priceId: 'price_test',
        summary: 'catalog ok',
      },
    },
    collisionConflicts: [],
  }
}

function readyApplyReport(state: StagingPilotFixtureState) {
  const plan = buildStagingPilotFixturePlan({ env: {} })
  expect(plan.ok).toBe(true)
  if (!plan.ok) throw new Error('plan failed')
  const report = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state, mode: 'apply' })
  expect(report.readyForApply).toBe(true)
  return report
}

function createMockTransactionPrisma() {
  const tx = {
    billingGroup: { create: vi.fn().mockResolvedValue({}) },
    customerAccount: { create: vi.fn().mockResolvedValue({}) },
    user: { create: vi.fn().mockResolvedValue({}) },
    billingGroupMembership: { create: vi.fn().mockResolvedValue({}) },
    customerMembership: { create: vi.fn().mockResolvedValue({}) },
    commerceSubscription: { create: vi.fn().mockResolvedValue({}) },
  }
  const prisma = {
    $transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<void>) => fn(tx)),
  }
  return { prisma, tx }
}

describe('Batch 43 staging pilot provision safeguards', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('PILOT-42-PRE-001 collision protection', () => {
    it('detects account slug collision with foreign id', async () => {
      const prisma = {
        customerAccount: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: 'other_acct', slug: STAGING_PILOT_SUBSCRIBER_ACCOUNT_SLUG }])
            .mockResolvedValueOnce([]),
        },
        billingGroup: { findMany: vi.fn().mockResolvedValue([]) },
        user: { findMany: vi.fn().mockResolvedValue([]) },
        customerMembership: { findMany: vi.fn().mockResolvedValue([]) },
        account: { findMany: vi.fn().mockResolvedValue([]) },
      }
      const report = await detectStagingPilotFixtureCollisions(prisma as never)
      expect(report.conflicts.some((c) => c.includes('slug') && c.includes('other_acct'))).toBe(true)
    })

    it('detects user email collision and cross-tenant membership', async () => {
      const prisma = {
        customerAccount: { findMany: vi.fn().mockResolvedValue([]) },
        billingGroup: { findMany: vi.fn().mockResolvedValue([]) },
        user: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ id: 'other_user', email: STAGING_PILOT_SUBSCRIBER_EMAIL }])
            .mockResolvedValueOnce([]),
        },
        customerMembership: {
          findMany: vi.fn().mockResolvedValue([
            { userId: 'user_pilot_staging_a', customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID },
          ]),
        },
        account: { findMany: vi.fn().mockResolvedValue([]) },
      }
      const report = await detectStagingPilotFixtureCollisions(prisma as never)
      expect(report.conflicts.some((c) => c.includes(STAGING_PILOT_SUBSCRIBER_EMAIL))).toBe(true)
      expect(report.conflicts.some((c) => c.includes('Cross-tenant'))).toBe(true)
    })

    it('blocks apply when collisionConflicts are present', () => {
      const plan = buildStagingPilotFixturePlan({ env: {} })
      expect(plan.ok).toBe(true)
      if (!plan.ok) return
      const state = emptyState()
      state.collisionConflicts = [
        `CustomerAccount slug "${STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_SLUG}" is owned by foreign id`,
      ]
      const report = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state, mode: 'apply' })
      expect(report.readyForApply).toBe(false)
      expect(report.conflicts.length).toBeGreaterThan(0)
    })
  })

  describe('PILOT-42-PRE-002 execution path', () => {
    it('provisions all entities on first apply with mocked transaction', async () => {
      const state = emptyState()
      const report = readyApplyReport(state)
      const { prisma, tx } = createMockTransactionPrisma()

      const result = await executeStagingPilotFixtureApply(prisma as never, report, state)
      expect(result.applied).toBeGreaterThan(0)
      expect(tx.commerceSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
            status: 'ACTIVE',
          }),
        }),
      )
      expect(tx.commerceSubscription.create).toHaveBeenCalledTimes(1)
    })

    it('skips entities already present when other rows still need create', async () => {
      const state = emptyState()
      state.users[STAGING_PILOT_SUBSCRIBER_USER_ID] = { present: true, summary: 'exists' }

      const plan = buildStagingPilotFixturePlan({ env: {} })
      if (!plan.ok) throw new Error('plan')
      const report = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state, mode: 'apply' })
      expect(report.readyForApply).toBe(true)

      const { prisma, tx } = createMockTransactionPrisma()
      await executeStagingPilotFixtureApply(prisma as never, report, state)
      expect(tx.user.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: STAGING_PILOT_SUBSCRIBER_USER_ID }),
        }),
      )
      expect(tx.user.create).toHaveBeenCalledTimes(1)
      expect(tx.billingGroup.create).toHaveBeenCalled()
    })

    it('second execute with fully present state is a no-op (applied 0)', async () => {
      const state = emptyState()
      for (const key of Object.keys(state.billingGroups)) {
        state.billingGroups[key] = { present: true, summary: 'ok' }
      }
      for (const key of Object.keys(state.customerAccounts)) {
        state.customerAccounts[key] = { present: true, summary: 'ok' }
      }
      for (const key of Object.keys(state.users)) {
        state.users[key] = { present: true, summary: 'ok' }
      }
      for (const key of Object.keys(state.customerMemberships)) {
        state.customerMemberships[key] = { present: true, summary: 'ok' }
      }
      for (const key of Object.keys(state.billingGroupMemberships)) {
        state.billingGroupMemberships[key] = { present: true, summary: 'ok' }
      }
      state.subscriptions[STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID] = {
        present: true,
        summary: 'sub',
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
      }

      const plan = buildStagingPilotFixturePlan({ env: {} })
      if (!plan.ok) throw new Error('plan')
      const report = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state, mode: 'apply' })
      expect(report.readyForApply).toBe(false)

      const { prisma, tx } = createMockTransactionPrisma()
      const result = await executeStagingPilotFixtureApply(prisma as never, report, state)
      expect(result.applied).toBe(0)
      expect(tx.billingGroup.create).not.toHaveBeenCalled()
    })

    it('propagates transaction failure (rollback delegated to prisma)', async () => {
      const state = emptyState()
      const report = readyApplyReport(state)
      const { prisma, tx } = createMockTransactionPrisma()
      tx.customerAccount.create.mockRejectedValueOnce(new Error('simulated db failure'))

      await expect(executeStagingPilotFixtureApply(prisma as never, report, state)).rejects.toThrow(
        'simulated db failure',
      )
    })

    it('preserves OPEN-001: B not eligible, A qualified from account-scoped subscription', () => {
      const aEvidence = {
        ...emptySubscriberEvidence(STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID),
        subscriptions: [
          {
            customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
            productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
            status: 'ACTIVE' as const,
          },
        ],
        loadOutcome: 'ok' as const,
      }
      const bEvidence = emptySubscriberEvidence(STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID)
      bEvidence.loadOutcome = 'ok'

      expect(evaluateIncludedFreeAccessForAccount({
        entitlementKey: 'core.crm',
        customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
        evidence: aEvidence,
      }).allowed).toBe(true)

      const bDecision = evaluateIncludedFreeAccessForAccount({
        entitlementKey: 'core.crm',
        customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
        evidence: bEvidence,
      })
      expect(bDecision.allowed).toBe(false)
    })
  })

  describe('PILOT-42-PRE-003 production safety guards', () => {
    it('dry-run allows production identity env alone without DATABASE_URL', () => {
      const guard = assertStagingPilotFixtureEnvironment(
        {
          WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
        },
        { mode: 'dry-run' },
      )
      expect(guard.ok).toBe(true)
    })

    it('rejects production ref in DIRECT_URL on dry-run', () => {
      const stagingUrl = `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
      const prodUrl = `postgresql://postgres.${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
      const guard = assertStagingPilotFixtureEnvironment(
        {
          DATABASE_URL: stagingUrl,
          DIRECT_URL: prodUrl,
          WEBXXL_STAGING_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
          WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
        },
        { mode: 'dry-run' },
      )
      expect(guard.ok).toBe(false)
      if (guard.ok) return
      expect(guard.code).toBe('PRODUCTION_DATABASE_URL')
    })

    it('rejects staging identity collision with production fingerprint', () => {
      const url = `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
      const guard = assertStagingPilotFixtureEnvironment(
        {
          DATABASE_URL: url,
          DIRECT_URL: url,
          WEBXXL_STAGING_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
          WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
        },
        { mode: 'dry-run' },
      )
      expect(guard.ok).toBe(false)
      if (guard.ok) return
      expect(guard.code).toBe('PRODUCTION_IDENTITY_COLLISION')
    })

    it('apply requires WEBXXL_STAGING_BOUNDARIES_CONFIRMED', () => {
      const guard = assertStagingPilotFixtureEnvironment(
        stagingEnv({ WEBXXL_STAGING_BOUNDARIES_CONFIRMED: undefined }),
        { mode: 'apply', operatorConfirmApply: true },
      )
      expect(guard.ok).toBe(false)
      if (guard.ok) return
      expect(guard.code).toBe('STAGING_PREFLIGHT_BLOCKED')
    })

    it('apply without DATABASE_URL is blocked', () => {
      const guard = assertStagingPilotFixtureEnvironment(
        {
          [STAGING_PILOT_APPLY_AUTHORIZATION_ENV]: '1',
        },
        { mode: 'apply', operatorConfirmApply: true },
      )
      expect(guard.ok).toBe(false)
      if (guard.ok) return
      expect(guard.code).toBe('STAGING_PREFLIGHT_BLOCKED')
    })
  })
})
