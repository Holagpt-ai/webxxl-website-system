import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { buildAbmedSeoSiblingIsolationCase } from '@/lib/platform/seo/test-fixtures-seo07'
import {
  assertSameAnalyticsAccount,
  denyBillingGroupSiblingAnalyticsAccess,
} from '@/lib/platform/analytics/account-isolation'
import { parseAnalyticsDateRange, previousPeriod } from '@/lib/platform/analytics/date-range'
import { buildConversionObservationIdempotencyKey, buildWebxxlEventIdempotencyKey } from '@/lib/platform/analytics/ids'
import { findDuplicateMetricKeys } from '@/lib/platform/analytics/ingestion/idempotent-metric-upsert'
import { prepareAnalyticsProviderSync } from '@/lib/platform/analytics/ingestion/sync-intent'
import { conversionRate, mapSeoDataStateToFreshness, sumMetricValues } from '@/lib/platform/analytics/normalize'
import { computePeriodChange } from '@/lib/platform/analytics/period-over-period'
import { listAnalyticsSourceProviders } from '@/lib/platform/analytics/providers/registry'
import { buildAnalyticsCrmRelationship } from '@/lib/platform/analytics/crm-bridge'
import { getServiceEntitlement, evaluateEntitlementAccess } from '@/lib/platform/entitlements'

describe('BATCH-14 analytics foundation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('tenant isolation: billing group siblings denied', () => {
    const iso = buildAbmedSeoSiblingIsolationCase()
    const denied = denyBillingGroupSiblingAnalyticsAccess({
      actorUserId: 'u1',
      operatingAccountId: iso.aestheticsAccountId,
      recordAccountId: iso.physiciansAccountId,
      operatingMemberships: [{ userId: 'u1', customerAccountId: iso.aestheticsAccountId }],
      billingGroupSiblingAccounts: iso.billingGroupSiblingAccounts,
    })
    expect(denied.ok).toBe(false)
    expect(assertSameAnalyticsAccount(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID).ok).toBe(false)
  })

  it('entitlement core.analytics defaults disabled via feature flag', () => {
    const ent = getServiceEntitlement('core.analytics')
    expect(ent?.featureFlag).toBe('analyticsBackend')
    const access = evaluateEntitlementAccess(ent!)
    expect(access.access).toBe('DISABLED')
  })

  it('date range boundaries reject oversized windows', () => {
    const params = new URLSearchParams({ start: '2024-01-01', end: '2026-01-01' })
    const result = parseAnalyticsDateRange(params)
    expect(result.ok).toBe(false)
    const ok = parseAnalyticsDateRange(new URLSearchParams({ start: '2026-01-01', end: '2026-01-28' }))
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      const prev = previousPeriod(ok.value)
      expect(prev.endIso < ok.value.startIso).toBe(true)
    }
  })

  it('metric normalization and conversion rate without fabricated sessions', () => {
    const sum = sumMetricValues([
      { value: 10, dataState: 'READY' },
      { value: 5, dataState: 'READY' },
    ])
    expect(sum.total).toBe(15)
    expect(conversionRate(3, null)).toBeNull()
    expect(conversionRate(2, 100)).toBe(0.02)
    expect(mapSeoDataStateToFreshness('FETCHING')).toBe('PENDING')
  })

  it('idempotent ingestion keys dedupe batches', () => {
    const row = {
      managedSiteId: 'site-1',
      customerAccountId: 'acct',
      provider: 'GA4',
      metricDefinition: 'ga4.sessions',
      value: 1,
      dataState: 'READY',
      observedAt: new Date(),
      date: new Date('2026-01-01T00:00:00.000Z'),
    }
    const dupes = findDuplicateMetricKeys([row, row])
    expect(dupes.length).toBe(1)
    expect(buildConversionObservationIdempotencyKey({
      managedSiteId: 's',
      conversionKey: 'lead',
      periodDate: '2026-01-01',
      sourceProvider: 'WEBXXL_EVENTS',
    })).toContain('lead')
    expect(buildWebxxlEventIdempotencyKey({
      customerAccountId: 'a',
      eventKey: 'form_submit',
      idempotencySeed: 'x',
    })).toContain('form_submit')
  })

  it('provider adapters report disconnected states when flags off', async () => {
    vi.stubEnv('SEO_GSC_API_ENABLED', '0')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', '0')
    const providers = listAnalyticsSourceProviders()
    const gsc = providers.find((p) => p.key === 'GSC')!
    const state = await gsc.describeConnection({
      customerAccountId: 'a',
      actorId: 'u',
      actorType: 'USER',
      requestId: 'r',
      idempotencyKey: 'k',
    })
    expect(state.ok).toBe(true)
    if (state.ok) expect(state.value.status).toBe('NOT_CONNECTED')
  })

  it('ingestion sync intent skipped when analytics ingestion disabled', () => {
    vi.stubEnv('ANALYTICS_INGESTION_ENABLED', '0')
    const intent = prepareAnalyticsProviderSync({
      provider: 'GSC',
      connectionDataState: 'READY',
      idempotencyKey: 'sync-1',
      providerApiEnabled: true,
    })
    expect(intent.status).toBe('SKIPPED')
    expect(intent.reason).toMatch(/disabled/i)
  })

  it('period-over-period and CRM disclaimer avoid attribution claims', () => {
    const change = computePeriodChange({
      metric: 'ga4.sessions',
      current: 120,
      previous: 100,
      dataState: 'READY',
    })
    expect(change.percentChange).toBe(20)
    const crm = buildAnalyticsCrmRelationship({ leadsCreated: 2, leadsConverted: 1, openDeals: 3 })
    expect(crm.disclaimer).toMatch(/No marketing attribution/)
    expect(crm.dataState).toBe('READY')
  })

  it('missing data states stay explicit', () => {
    const empty = sumMetricValues([])
    expect(empty.dataState).toBe('NOT_CONNECTED')
    expect(buildAnalyticsCrmRelationship(null).dataState).toBe('NOT_CONNECTED')
  })
})
