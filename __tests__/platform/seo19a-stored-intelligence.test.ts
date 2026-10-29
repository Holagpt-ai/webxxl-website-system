import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGscPerformanceFromObservations } from '@/lib/platform/seo/gsc-performance-read'
import { applyStoredGscPerformanceToOverview } from '@/lib/platform/seo/overview-gsc-apply'
import { buildSeoSiteOverviewDto } from '@/lib/platform/seo/dashboard-read-model'
import {
  dedupeKeywordRowsForList,
  keywordRowsAfterCursor,
  listGscKeywordsForSite,
} from '@/lib/platform/seo/keyword-list-service'
import { loadGscStoredSiteBundle } from '@/lib/platform/seo/gsc-site-read'
import { decodeSeoListCursor, encodeSeoListCursor } from '@/lib/platform/seo/seo-list-cursor'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

const managedSiteFindFirst = vi.hoisted(() => vi.fn())
const connectionFindMany = vi.hoisted(() => vi.fn())
const snapshotFindFirst = vi.hoisted(() => vi.fn())
const snapshotCount = vi.hoisted(() => vi.fn())
const metricFindMany = vi.hoisted(() => vi.fn())
const keywordFindMany = vi.hoisted(() => vi.fn())
const opportunityFindMany = vi.hoisted(() => vi.fn())
const opportunityFindFirst = vi.hoisted(() => vi.fn())
const marketingRequestFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/managed-sites/queries', () => ({
  getManagedSiteForAccount: (...args: unknown[]) => managedSiteFindFirst(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteAnalyticsConnection: { findMany: (...args: unknown[]) => connectionFindMany(...args) },
    seoSnapshot: {
      findFirst: (...args: unknown[]) => snapshotFindFirst(...args),
      count: (...args: unknown[]) => snapshotCount(...args),
    },
    seoMetricObservation: { findMany: (...args: unknown[]) => metricFindMany(...args) },
    seoKeywordObservation: { findMany: (...args: unknown[]) => keywordFindMany(...args) },
    seoOpportunity: {
      findMany: (...args: unknown[]) => opportunityFindMany(...args),
      findFirst: (...args: unknown[]) => opportunityFindFirst(...args),
    },
    marketingRequest: {
      findFirst: (...args: unknown[]) => marketingRequestFindFirst(...args),
      create: vi.fn(),
      update: vi.fn(),
    },
    marketingRequestStatusEvent: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => {
      for (const op of ops as Promise<unknown>[]) await op
    }),
  },
}))

const sameDay = new Date('2026-10-05T00:00:00.000Z')

function mockSite() {
  managedSiteFindFirst.mockResolvedValue({
    id: 'site-a',
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    domain: 'example.test',
    canonicalUrl: 'https://example.test',
    name: 'Site A',
  })
}

function mockVerifiedGscBundlePath() {
  connectionFindMany.mockResolvedValue([
    {
      propertyRef: 'sc-domain:example.test',
      dataState: 'READY',
      verificationState: 'VERIFIED',
      revokedAt: null,
    },
  ])
  snapshotFindFirst.mockResolvedValue({
    dateRangeStart: new Date('2026-10-01'),
    dateRangeEnd: new Date('2026-10-07'),
    observedAt: new Date('2026-10-08'),
    methodologyVersion: 'gsc-v1',
    propertyRef: 'sc-domain:example.test',
  })
  snapshotCount.mockResolvedValue(0)
  metricFindMany.mockResolvedValue([{ sourceRef: 'sc-domain:example.test' }])
}

describe('SEO-19A stored intelligence', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('preserves null metrics and dedupes duplicate ingestions for GSC performance', () => {
    const d = new Date('2026-10-01T00:00:00.000Z')
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows: [
        {
          idempotencyKey: 'a1',
          query: 'widgets',
          page: 'https://example.test/p',
          clicks: 2,
          impressions: 10,
          ctr: 0.2,
          averagePosition: 4.5,
          date: d,
          dataState: 'READY',
          observedAt: new Date('2026-10-08T12:00:00Z'),
        },
        {
          idempotencyKey: 'a2',
          query: 'widgets',
          page: 'https://example.test/p',
          clicks: 99,
          impressions: 99,
          ctr: 0.99,
          averagePosition: 1,
          date: d,
          dataState: 'READY',
          observedAt: new Date('2026-10-08T10:00:00Z'),
        },
      ],
      snapshot: { start: '2026-10-01', end: '2026-10-07', observedAt: d.toISOString() },
    })
    expect(perf.clicks).toBe(2)
    expect(perf.impressions).toBe(10)
    expect(perf.completeness.dedupedRowCount).toBe(1)
  })

  it('requires snapshot window before aggregating historical rows', () => {
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows: [
        {
          idempotencyKey: 'k1',
          query: 'q',
          page: null,
          clicks: 5,
          impressions: 5,
          ctr: 1,
          averagePosition: 2,
          date: new Date('2026-10-02'),
          dataState: 'READY',
          observedAt: new Date('2026-10-03T00:00:00Z'),
        },
      ],
      requireVerifiedSnapshotWindow: true,
    })
    expect(perf.dataState).toBe('PARTIAL')
    expect(perf.clicks).toBeNull()
  })

  it('paginates keywords on the same date without duplicates or skips', () => {
    const rows = dedupeKeywordRowsForList([
      {
        idempotencyKey: 'site:GSC:alpha:-:' + sameDay.toISOString().slice(0, 10),
        query: 'alpha',
        page: null,
        clicks: 1,
        impressions: 1,
        ctr: 1,
        averagePosition: 1,
        date: sameDay,
        dataState: 'READY',
        observedAt: new Date('2026-10-08T00:00:00Z'),
      },
      {
        idempotencyKey: 'site:GSC:beta:-:' + sameDay.toISOString().slice(0, 10),
        query: 'beta',
        page: null,
        clicks: 2,
        impressions: 2,
        ctr: 1,
        averagePosition: 2,
        date: sameDay,
        dataState: 'READY',
        observedAt: new Date('2026-10-08T00:00:00Z'),
      },
      {
        idempotencyKey: 'site:GSC:gamma:-:' + sameDay.toISOString().slice(0, 10),
        query: 'gamma',
        page: null,
        clicks: 3,
        impressions: 3,
        ctr: 1,
        averagePosition: 3,
        date: sameDay,
        dataState: 'READY',
        observedAt: new Date('2026-10-08T00:00:00Z'),
      },
    ])
    expect(rows.map((r) => r.query)).toEqual(['alpha', 'beta', 'gamma'])

    const page1 = rows.slice(0, 2)
    const cursor = encodeSeoListCursor({
      p: page1[1]!.sortDateMs,
      q: page1[1]!.sortQuery,
      pg: page1[1]!.sortPage,
      i: page1[1]!.sortId,
    })
    const decoded = decodeSeoListCursor(cursor)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const page2 = keywordRowsAfterCursor(rows, decoded.value)
    expect(page2.map((r) => r.query)).toEqual(['gamma'])

    const allQueries = [...page1.map((r) => r.query), ...page2.map((r) => r.query)]
    expect(new Set(allQueries).size).toBe(3)
  })

  it('rejects malformed SEO list cursors', () => {
    expect(decodeSeoListCursor('not-json').ok).toBe(false)
    expect(decodeSeoListCursor(Buffer.from('{"p":1}', 'utf8').toString('base64url')).ok).toBe(false)
  })

  it('lists keywords with search filter and cursor pagination', async () => {
    mockSite()
    mockVerifiedGscBundlePath()
    keywordFindMany.mockResolvedValue([
      {
        idempotencyKey: 'k-new',
        query: 'alpha query',
        page: 'https://example.test/a',
        clicks: 1,
        impressions: 2,
        ctr: 0.5,
        averagePosition: 3,
        date: new Date('2026-10-07'),
        dataState: 'READY',
        observedAt: new Date('2026-10-08T12:00:00Z'),
      },
      {
        idempotencyKey: 'k-old',
        query: 'beta query',
        page: null,
        clicks: null,
        impressions: 4,
        ctr: null,
        averagePosition: null,
        date: new Date('2026-10-01'),
        dataState: 'READY',
        observedAt: new Date('2026-10-08T10:00:00Z'),
      },
    ])

    const page1 = await listGscKeywordsForSite({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      take: 1,
    })
    expect(page1.ok).toBe(true)
    if (!page1.ok) return
    expect(page1.value.keywords).toHaveLength(1)
    expect(page1.value.keywords[0]?.query).toBe('alpha query')
    expect(page1.value.nextCursor).toBeTruthy()

    const page2 = await listGscKeywordsForSite({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      take: 1,
      cursor: page1.value.nextCursor,
    })
    expect(page2.ok).toBe(true)
    if (!page2.ok) return
    expect(page2.value.keywords[0]?.query).toBe('beta query')
  })

  it('withholds metrics when GSC connection is not verified', async () => {
    mockSite()
    connectionFindMany.mockResolvedValue([
      {
        propertyRef: 'sc-domain:example.test',
        dataState: 'READY',
        verificationState: 'PENDING',
        revokedAt: null,
      },
    ])
    const bundle = await loadGscStoredSiteBundle({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
    })
    expect(bundle.ok).toBe(true)
    if (!bundle.ok) return
    expect(bundle.value.rows).toHaveLength(0)
    expect(bundle.value.performance.clicks).toBeNull()
    expect(bundle.value.limitations[0]).toContain('not verified')
  })

  it('withholds keyword rows when overlapping snapshot exists for another property', async () => {
    mockSite()
    mockVerifiedGscBundlePath()
    snapshotCount.mockResolvedValue(1)
    const bundle = await loadGscStoredSiteBundle({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
    })
    expect(bundle.ok).toBe(true)
    if (!bundle.ok) return
    expect(bundle.value.rows).toHaveLength(0)
    expect(bundle.value.performance.dataState).toBe('PARTIAL')
    expect(bundle.value.limitations.some((l) => l.includes('another property'))).toBe(true)
  })

  it('denies foreign managed site on keyword load', async () => {
    managedSiteFindFirst.mockResolvedValue(null)
    const result = await listGscKeywordsForSite({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      managedSiteId: 'foreign-site',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })

  it('orders opportunities deterministically and uses id asc for equal priority cursor', async () => {
    mockSite()
    opportunityFindMany.mockResolvedValue([{ id: 'opp-1', priorityScore: 90 }])

    const { listSeoOpportunitiesForSite } = await import('@/lib/platform/seo/opportunity-list-service')
    await listSeoOpportunitiesForSite({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      take: 10,
    })
    expect(opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
      }),
    )

    const cursor = encodeSeoListCursor({ p: 50, i: 'opp-a' })
    await listSeoOpportunitiesForSite({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      take: 2,
      cursor,
    })
    const lastCall = opportunityFindMany.mock.calls.at(-1)?.[0] as { where?: { AND?: unknown[] } }
    const andClause = lastCall?.where?.AND?.[1] as { OR?: unknown[] }
    expect(JSON.stringify(andClause)).toContain('"gt":"opp-a"')

    const bad = await listSeoOpportunitiesForSite({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      state: 'NOT_A_STATE',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe('VALIDATION')
  })

  it('applies stored GSC performance onto overview DTO without breaking keys', () => {
    const dto = buildSeoSiteOverviewDto({
      managedSiteId: 'site-a',
      connections: [],
      inventoryCounts: [],
      gsc: null,
      findingsCount: 0,
      competitors: [],
      opportunities: [],
      workEvidenceCount: 0,
      rankProviderState: 'NOT_CONNECTED',
    })
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows: [
        {
          idempotencyKey: 'k1',
          query: 'q',
          page: null,
          clicks: 3,
          impressions: 30,
          ctr: 0.1,
          averagePosition: 8,
          date: new Date('2026-10-03'),
          dataState: 'READY',
          observedAt: new Date('2026-10-08T00:00:00Z'),
        },
      ],
      snapshot: { start: '2026-10-01', end: '2026-10-07', observedAt: '2026-10-08T00:00:00.000Z' },
    })
    applyStoredGscPerformanceToOverview(dto, perf)
    expect(dto.sections.gscPerformance.clicks).toBe(3)
  })

  it('rejects cross-tenant seoOpportunityId on marketing request create', async () => {
    vi.stubEnv('MKT_DRAFT_PREPARATION_ENABLED', 'true')
    managedSiteFindFirst.mockResolvedValue({ id: 'site-ok', customerAccountId: 'acct-a' })
    opportunityFindFirst.mockResolvedValue(null)
    marketingRequestFindFirst.mockResolvedValue(null)

    const { createMarketingRequestRecord } = await import('@/lib/platform/marketing/request-service')
    const result = await createMarketingRequestRecord({
      customerAccountId: 'acct-a',
      userId: 'user-1',
      managedSiteId: 'site-ok',
      category: 'SEO_CONTENT_FIX',
      goal: 'Fix title',
      brief: 'Brief',
      locale: 'en',
      idempotencyKey: 'idem-seo-1',
      seoOpportunityId: 'opp-foreign',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })
})
