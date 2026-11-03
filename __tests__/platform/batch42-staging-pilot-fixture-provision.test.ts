import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertStagingPilotFixtureEnvironment } from '@/lib/platform/pilot/staging-pilot-environment-guard'
import {
  STAGING_PILOT_APPLY_AUTHORIZATION_ENV,
  STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
  STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID,
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import { buildStagingPilotFixtureApplyReport } from '@/lib/platform/pilot/staging-pilot-fixture-reconcile'
import { buildStagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'
import { stagingPilotFixturePayloadSpec } from '@/lib/platform/pilot/staging-pilot-fixture-payloads'
import type { StagingPilotFixtureState } from '@/lib/platform/pilot/staging-pilot-fixture-inspect'
import { runStagingPilotFixtureProvision } from '@/lib/platform/pilot/staging-pilot-fixture-provision'
import { buildStagingPilotOperatorChecklist } from '@/lib/platform/pilot/staging-pilot-operator-checklist'

function stagingEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  const url = `postgresql://postgres.${WEBXXL_RECORDED_STAGING_SUPABASE_REF}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
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
  }
}

describe('Batch 42 staging pilot fixture provision', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to dry-run without DATABASE_URL and performs no writes', async () => {
    const result = await runStagingPilotFixtureProvision({ env: {}, inspectDatabase: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mode).toBe('dry-run')
    expect(result.execute).toBeUndefined()
    expect(result.report.catalogBlocked).toBe(true)
    expect(result.report.readyForApply).toBe(false)
  })

  it('requires CLI confirmation for apply even when owner env is set', () => {
    const guard = assertStagingPilotFixtureEnvironment(stagingEnv(), {
      mode: 'apply',
      operatorConfirmApply: false,
    })
    expect(guard.ok).toBe(false)
    if (guard.ok) return
    expect(guard.code).toBe('APPLY_CONFIRMATION_REQUIRED')
  })

  it('requires owner authorization env in addition to CLI confirmation', () => {
    const guard = assertStagingPilotFixtureEnvironment(
      stagingEnv({ [STAGING_PILOT_APPLY_AUTHORIZATION_ENV]: undefined }),
      { mode: 'apply', operatorConfirmApply: true },
    )
    expect(guard.ok).toBe(false)
    if (guard.ok) return
    expect(guard.code).toBe('STAGING_APPLY_NOT_AUTHORIZED')
  })

  it('always refuses production apply even with confirmation and owner env', () => {
    const url = `postgresql://postgres.${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
    const guard = assertStagingPilotFixtureEnvironment(
      {
        DATABASE_URL: url,
        DIRECT_URL: url,
        WEBXXL_STAGING_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres`,
        WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
        WEBXXL_STAGING_BOUNDARIES_CONFIRMED: '1',
        [STAGING_PILOT_APPLY_AUTHORIZATION_ENV]: '1',
      },
      { mode: 'apply', operatorConfirmApply: true },
    )
    expect(guard.ok).toBe(false)
    if (guard.ok) return
    expect(guard.code).toBe('PRODUCTION_APPLY_FORBIDDEN')
  })

  it('rejects unknown database ref when bound', () => {
    const unknownRef = 'abcdefghijklmnopq'
    const url = `postgresql://postgres.${unknownRef}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
    const guard = assertStagingPilotFixtureEnvironment(
      {
        DATABASE_URL: url,
        DIRECT_URL: url,
        WEBXXL_STAGING_DATABASE_IDENTITY: `supabase:${unknownRef}/postgres`,
        WEBXXL_PRODUCTION_DATABASE_IDENTITY: `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres`,
      },
      { mode: 'dry-run' },
    )
    expect(guard.ok).toBe(false)
    if (guard.ok) return
    expect(guard.code).toBe('UNKNOWN_DATABASE_REF')
  })

  it('builds idempotent reconcile report with create vs noop actions', () => {
    const plan = buildStagingPilotFixturePlan({ env: {} })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    const empty = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state: emptyState(), mode: 'dry-run' })
    expect(empty.actions.some((a) => a.kind === 'create')).toBe(true)
    expect(empty.catalogBlocked).toBe(false)

    const full = emptyState()
    for (const key of Object.keys(full.billingGroups)) {
      full.billingGroups[key] = { present: true, summary: 'exists' }
    }
    for (const key of Object.keys(full.customerAccounts)) {
      full.customerAccounts[key] = { present: true, summary: 'exists' }
    }
    for (const key of Object.keys(full.users)) {
      full.users[key] = { present: true, summary: 'exists' }
    }
    for (const key of Object.keys(full.customerMemberships)) {
      full.customerMemberships[key] = { present: true, summary: 'exists' }
    }
    for (const key of Object.keys(full.billingGroupMemberships)) {
      full.billingGroupMemberships[key] = { present: true, summary: 'exists' }
    }
    full.subscriptions[STAGING_PILOT_SUBSCRIBER_SUBSCRIPTION_PUBLIC_ID] = {
      present: true,
      summary: 'sub ok',
      customerAccountId: STAGING_PILOT_SUBSCRIBER_ACCOUNT_ID,
    }

    const noopReport = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state: full, mode: 'apply' })
    expect(noopReport.actions.every((a) => a.kind === 'noop')).toBe(true)
    expect(noopReport.readyForApply).toBe(false)
    expect(noopReport.conflicts).toHaveLength(0)
  })

  it('flags subscription on account B as conflict', () => {
    const plan = buildStagingPilotFixturePlan({ env: {} })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const state = emptyState()
    state.subscriptions[`stray:${STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID}`] = {
      present: true,
      customerAccountId: STAGING_PILOT_NON_SUBSCRIBER_ACCOUNT_ID,
      summary: 'bad',
      conflict: 'Non-subscriber account must not hold website.subscription evidence',
    }
    const report = buildStagingPilotFixtureApplyReport({ plan: plan.plan, state, mode: 'apply' })
    expect(report.conflicts.some((c) => c.includes('account B'))).toBe(true)
    expect(report.readyForApply).toBe(false)
  })

  it('operator checklist mentions AUTH_URL and staging ref without secrets', () => {
    const checklist = buildStagingPilotOperatorChecklist()
    expect(checklist.stagingDatabaseRef).toBe(WEBXXL_RECORDED_STAGING_SUPABASE_REF)
    expect(checklist.vercelPreview.some((l) => l.includes('AUTH_URL'))).toBe(true)
    expect(JSON.stringify(checklist)).not.toMatch(/postgres:\/\/[^:]+:[^@]+@|sk_live_|sk_test_/)
  })

  it('provision dry-run uses mock prisma and never calls execute', async () => {
    const prisma = {
      billingGroup: { findMany: vi.fn().mockResolvedValue([]) },
      customerAccount: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      customerMembership: { findMany: vi.fn().mockResolvedValue([]) },
      billingGroupMembership: { findMany: vi.fn().mockResolvedValue([]) },
      commerceSubscription: { findMany: vi.fn().mockResolvedValue([]) },
      commerceProduct: { findUnique: vi.fn().mockResolvedValue({ id: 'p', prices: [{ id: 'pr' }] }) },
      $disconnect: vi.fn(),
    }
    const result = await runStagingPilotFixtureProvision({
      env: stagingEnv(),
      mode: 'dry-run',
      prisma: prisma as never,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.execute).toBeUndefined()
    expect(prisma.billingGroup.findMany).toHaveBeenCalled()
  })
})
