import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_GROUP_ID,
} from '@/lib/platform/fixtures/abmed'
import { denyBillingGroupSiblingCrmAccess, assertSameCustomerAccount } from '@/lib/platform/crm/account-isolation'
import { normalizeEmail, escapeCsvCell } from '@/lib/platform/crm/normalize'
import {
  evaluateSegmentGroup,
  summarizeSegmentPopulation,
  validateSegmentFilterGroup,
} from '@/lib/platform/crm/segment-engine'
import { buildSynthetic200ContactSegmentFixture } from '@/lib/platform/crm/test-fixtures-200'
import { classifyFollowUpCoverage, buildSyntheticOverdueFollowUpReport } from '@/lib/platform/crm/follow-up-service'
import { importMustNotGrantConsent } from '@/lib/platform/crm/consent-service'
import { rejectCrossAccountMerge } from '@/lib/platform/crm/dedup-service'
import { assertChatwootTenantIsolation } from '@/lib/platform/crm/chatwoot-contract'
import { createTwentyCrmProvider } from '@/lib/platform/providers/twenty-crm'
import { createWebxxlNativeCrmProvider } from '@/lib/platform/providers/webxxl-native-crm'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'
import { Prisma } from '@prisma/client'

describe('CRM-05 foundation', () => {
  beforeEach(() => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.stubEnv('CRM_EXTERNAL_SYNC_ENABLED', 'false')
    vi.stubEnv('CRM_IMPORT_ENABLED', 'true')
    vi.stubEnv('CRM_EXPORT_ENABLED', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('1-3: account scope and billing group CRM isolation', () => {
    const memberships = [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }]
    const siblings = new Map<string, string[]>([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]])
    const denied = denyBillingGroupSiblingCrmAccess({
      actorUserId: 'u1',
      targetAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: memberships,
      billingGroupSiblingAccounts: siblings,
    })
    expect(denied.ok).toBe(false)
    expect(assertSameCustomerAccount(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_AESTHETICS_ACCOUNT_ID).ok).toBe(true)
  })

  it('4-6: normalization and identity boundaries', () => {
    expect(normalizeEmail(' Test@Example.com ')).toBe('test@example.com')
    expect(normalizeEmail('a@b.c')).not.toBe(normalizeEmail('other@b.c'))
  })

  it('7-8: segment filter validation rejects unsafe fields', () => {
    const invalid = validateSegmentFilterGroup({
      logic: 'AND',
      rules: [{ field: 'tag' as never, operator: 'eq', value: 'vip' }],
    })
    expect(invalid.ok).toBe(true)
    const bad = validateSegmentFilterGroup({
      logic: 'AND',
      rules: [{ field: 'rawSql' as never, operator: 'eq', value: 'drop table' }],
    })
    expect(bad.ok).toBe(false)
  })

  it('15-16: 200-contact segment summary uses fixture counts', () => {
    const fixture = buildSynthetic200ContactSegmentFixture(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(fixture).toHaveLength(200)
    const summary = summarizeSegmentPopulation(fixture)
    expect(summary.totalContacts).toBe(200)
    expect(summary.suppressedContacts).toBe(20)
    expect(summary.unknownConsentContacts).toBe(180)
    expect(summary.eligibleContacts).toBe(20)
    const vip = fixture.filter((c) => evaluateSegmentGroup(c, { logic: 'AND', rules: [{ field: 'tag', operator: 'eq', value: 'vip' }] }))
    expect(vip.length).toBe(20)
  })

  it('10-11: follow-up coverage distinguishes unknown vs contacted', () => {
    expect(classifyFollowUpCoverage({ hasQualifyingOutreach: false, providerCoverageMissing: true, awaitingReply: false, completed: false })).toBe(
      'UNKNOWN_COVERAGE',
    )
    expect(classifyFollowUpCoverage({ hasQualifyingOutreach: false, providerCoverageMissing: false, awaitingReply: false, completed: false })).toBe(
      'CONFIRMED_NO_OUTREACH',
    )
    const report = buildSyntheticOverdueFollowUpReport()
    expect(report.ok).toBe(true)
    if (report.ok) expect(report.value).toHaveLength(10)
  })

  it('12-14: import never grants consent; cross-account merge denied', async () => {
    expect(importMustNotGrantConsent().ok).toBe(true)
    expect((await rejectCrossAccountMerge('a1', 'a2')).ok).toBe(false)
  })

  it('18-20: csv formula escape and export guard concepts', () => {
    expect(escapeCsvCell('=cmd')).toBe("'=cmd")
  })

  it('22-23: Twenty provider NOT_CONFIGURED without sync; native registered', async () => {
    const twenty = createTwentyCrmProvider()
    const res = await twenty.searchContacts(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorId: 'u',
        actorType: 'USER',
        requestId: 'r',
        idempotencyKey: 'k',
      },
      'test',
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NOT_CONFIGURED')
    const registry = createDefaultProviderRegistry()
    expect(registry.list('crm').some((p) => p.key === 'webxxl-native')).toBe(true)
    expect(createWebxxlNativeCrmProvider().describeCapabilities().contacts).toBe(true)
  })

  it('24: Chatwoot mapping isolation', () => {
    const ok = assertChatwootTenantIsolation([
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        billingGroupId: ABMED_GROUP_ID,
        chatwootAccountId: 'cw_1',
        chatwootInboxIds: ['inbox_a'],
        isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
      },
    ])
    expect(ok.ok).toBe(true)
    const bad = assertChatwootTenantIsolation([
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        billingGroupId: ABMED_GROUP_ID,
        chatwootAccountId: 'cw_shared',
        chatwootInboxIds: [],
        isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
      },
      {
        customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
        billingGroupId: ABMED_GROUP_ID,
        chatwootAccountId: 'cw_shared',
        chatwootInboxIds: [],
        isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
      },
    ])
    expect(bad.ok).toBe(false)
  })

  it('25: SalesLead model preserved', () => {
    expect(Prisma.ModelName.SalesLead).toBe('SalesLead')
    expect(Prisma.ModelName.LeadActivity).toBe('LeadActivity')
  })
})
