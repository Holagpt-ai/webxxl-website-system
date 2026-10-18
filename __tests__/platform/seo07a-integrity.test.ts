import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateCrawlTargetUrl } from '@/lib/platform/seo/crawl-authorization'
import { runBoundedSiteCrawl, type CrawlHttpTransport } from '@/lib/platform/seo/bounded-crawler'
import { normalizeScanResourceLimits, buildScanRequestFingerprint } from '@/lib/platform/seo/scan-limits'
import { prepareSeoScanPreview } from '@/lib/platform/seo/scan-preview-service'
import { authorizeGscSearchAnalyticsQuery } from '@/lib/platform/seo/gsc-query-auth'
import {
  buildGscPerformanceFromObservations,
  countOverlappingMetricKeys,
} from '@/lib/platform/seo/gsc-performance-read'
import {
  rankCompetitorCandidates,
  validateCompetitorCandidate,
} from '@/lib/platform/seo/competitor-ranking'
import { denyBillingGroupSiblingSeoAccess } from '@/lib/platform/seo/account-isolation'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_GROUP_ID } from '@/lib/platform/fixtures/abmed'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSite: { findFirst: vi.fn() },
    seoCrawlRun: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/config/seo-backend', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/config/seo-backend')>()
  return { ...orig, isSeoCrawlerEnabled: vi.fn(() => false) }
})

import { prisma } from '@/lib/db'
import { isSeoCrawlerEnabled } from '@/config/seo-backend'

const allowedHosts = ['example.test']

describe('SEO-07A integrity', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('A: cross-account idempotency replay conflicts without foreign id', async () => {
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValue({ id: 'site-b' } as never)
    vi.mocked(prisma.seoCrawlRun.findFirst).mockResolvedValue({
      id: 'secret-run-id',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      idempotencyKey: 'key-1',
      operation: 'SCAN_PREVIEW',
      requestFingerprint: 'SCAN_PREVIEW:50:3',
      status: 'PREPARED',
    } as never)
    const result = await prepareSeoScanPreview({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      managedSiteId: 'site-b',
      idempotencyKey: 'key-1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
      expect(result.message).not.toContain('secret-run-id')
    }
  })

  it('B: changed scan request conflicts on same idempotency key', async () => {
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValue({ id: 'site-a' } as never)
    vi.mocked(prisma.seoCrawlRun.findFirst).mockResolvedValue({
      id: 'run-1',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      idempotencyKey: 'key-2',
      operation: 'SCAN_PREVIEW',
      requestFingerprint: buildScanRequestFingerprint({ operation: 'SCAN_PREVIEW', maxPages: 10, maxDepth: 2 }),
      status: 'PREPARED',
    } as never)
    const result = await prepareSeoScanPreview({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      idempotencyKey: 'key-2',
      maxPages: 20,
      maxDepth: 2,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })

  it('C: invalid scan resource limits rejected', () => {
    expect(normalizeScanResourceLimits({ maxPages: NaN }).ok).toBe(false)
    expect(normalizeScanResourceLimits({ maxPages: -1 }).ok).toBe(false)
    expect(normalizeScanResourceLimits({ maxPages: 1.5 }).ok).toBe(false)
  })

  it('D: broken-link checks share HTTP request budget', async () => {
    vi.mocked(isSeoCrawlerEnabled).mockReturnValue(true)
    let requests = 0
    const transport: CrawlHttpTransport = {
      async fetch(url: string) {
        requests += 1
        if (url.includes('missing')) return { status: 404, body: '', headers: {}, finalUrl: url }
        return {
          status: 200,
          body: '<html><head><title>T</title></head><body><a href="https://example.test/missing">m</a></body></html>',
          headers: {},
          finalUrl: url,
        }
      },
    }
    const crawl = await runBoundedSiteCrawl({
      seedUrl: 'https://example.test/',
      allowedHosts,
      transport,
      maxPages: 1,
      maxDepth: 0,
      testBypassLiveNetworkGate: true,
    })
    expect(crawl.ok).toBe(true)
    if (crawl.ok) {
      expect(crawl.value.httpRequests).toBeGreaterThan(1)
      expect(requests).toBe(crawl.value.httpRequests)
    }
  })

  it('E: unsafe cross-host redirect rejected', () => {
    const blocked = validateCrawlTargetUrl({
      url: 'https://evil.test/steal',
      allowedHosts: ['example.test'],
    })
    expect(blocked.ok).toBe(false)
  })

  it('F: IPv6 link-local destination denied', () => {
    expect(validateCrawlTargetUrl({ url: 'http://[fe80::1]/', allowedHosts: ['fe80::1'] }).ok).toBe(false)
  })

  it('G: GSC query rejects foreign property', () => {
    const denied = authorizeGscSearchAnalyticsQuery({
      contextAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      contextManagedSiteId: 'site-b',
      connection: {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        propertyRef: 'sc-domain:example.test',
        verificationState: 'VERIFIED',
        dataState: 'READY',
        secretRef: 'sec-1',
        revokedAt: null,
      },
      authorizedHosts: ['example.test'],
      request: { startDate: '2026-10-01', endDate: '2026-10-07' },
    })
    expect(denied.ok).toBe(false)
  })

  it('H: revoked GSC connection fails closed', () => {
    const denied = authorizeGscSearchAnalyticsQuery({
      contextAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      contextManagedSiteId: 'site-a',
      connection: {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        propertyRef: 'sc-domain:example.test',
        verificationState: 'REVOKED',
        dataState: 'READY',
        secretRef: 'sec-1',
        revokedAt: new Date(),
      },
      authorizedHosts: ['example.test'],
      request: { startDate: '2026-10-01', endDate: '2026-10-07' },
    })
    expect(denied.ok).toBe(false)
  })

  it('I: overlapping metric keys detected; dedupe prevents double count', () => {
    const rows = [
      {
        idempotencyKey: 'a1',
        query: 'q',
        page: '/',
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        averagePosition: 5,
        date: new Date('2026-10-01'),
        dataState: 'READY',
      },
      {
        idempotencyKey: 'a2',
        query: 'q',
        page: '/',
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        averagePosition: 5,
        date: new Date('2026-10-01'),
        dataState: 'READY',
      },
    ]
    expect(countOverlappingMetricKeys(rows)).toBeGreaterThan(0)
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows,
    })
    expect(perf.clicks).toBe(10)
  })

  it('J: missing GSC observations return null metrics', () => {
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows: [],
    })
    expect(perf.clicks).toBeNull()
    expect(perf.dataState).toBe('PARTIAL')
  })

  it('K: forged Places provenance rejected', () => {
    const invalid = validateCompetitorCandidate({
      displayName: 'X',
      categoryMatch: 0.5,
      serviceOverlap: 0.5,
      geoRelevance: 0.5,
      observedEvidence: 0.5,
      placeId: 'places/abc',
      provenance: 'PLACES_DISCOVERY',
    })
    expect(invalid.ok).toBe(false)
  })

  it('L: invalid competitor scores rejected', () => {
    expect(
      validateCompetitorCandidate({
        displayName: 'X',
        categoryMatch: Infinity,
        serviceOverlap: 0.5,
        geoRelevance: 0.5,
        observedEvidence: 0.5,
      }).ok,
    ).toBe(false)
  })

  it('M/N: owner-supplied source and billing group isolation preserved', () => {
    const ranked = rankCompetitorCandidates([
      {
        displayName: 'Local Spa',
        categoryMatch: 0.8,
        serviceOverlap: 0.7,
        geoRelevance: 0.6,
        observedEvidence: 0.5,
        placeId: 'places/123',
        provenance: 'OWNER_SUPPLIED',
      },
    ])
    expect(ranked[0]?.source).toBe('OWNER_SUPPLIED')
    const denied = denyBillingGroupSiblingSeoAccess({
      actorUserId: 'u1',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
    })
    expect(denied.ok).toBe(false)
  })
})
