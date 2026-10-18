import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { denyBillingGroupSiblingSeoAccess, assertSameSeoAccount } from '@/lib/platform/seo/account-isolation'
import { validateCrawlTargetUrl, validateRedirectTarget } from '@/lib/platform/seo/crawl-authorization'
import { runBoundedSiteCrawl, type CrawlHttpTransport } from '@/lib/platform/seo/bounded-crawler'
import { parseHtmlSeoSignals } from '@/lib/platform/seo/crawl-html-parse'
import {
  aggregateGscAveragePosition,
  aggregateGscTraffic,
  fillMissingGscDays,
  normalizeGscSearchAnalyticsResponse,
} from '@/lib/platform/seo/gsc-normalize'
import { matchGscPropertyToSite, denyForeignGoogleProperty } from '@/lib/platform/seo/property-match'
import { createGoogleGscSeoProvider } from '@/lib/platform/providers/google-gsc-seo'
import { createGoogleGa4SeoProvider } from '@/lib/platform/providers/google-ga4-seo'
import { createGoogleGbpSeoProvider } from '@/lib/platform/providers/google-gbp-seo'
import { rankCompetitorCandidates, placesDiscoveryIsNotKeywordRank } from '@/lib/platform/seo/competitor-ranking'
import {
  detectCrawlOpportunities,
  detectGscOpportunities,
  sortOpportunitiesDeterministic,
} from '@/lib/platform/seo/opportunity-engine'
import { summarizePageInventory } from '@/lib/platform/seo/page-inventory-summary'
import { buildSyntheticPageInventoryFixture, MOCK_GSC_RESPONSE, buildAbmedSeoSiblingIsolationCase } from '@/lib/platform/seo/test-fixtures-seo07'
import { prepareSeoProviderSyncRun } from '@/lib/platform/seo/sync-run-service'
import { denyAiSelfAuthorizedSiteEdit, denySeoAutoPublish } from '@/lib/platform/seo/ai-handoff'
import { localRankWhenProviderDisconnected } from '@/lib/platform/seo/local-rank-contract'
import { buildSeoMetricIdempotencyKey } from '@/lib/platform/seo/ingest-idempotency'
import { redactOAuthLikeSecrets, safeSeoLog } from '@/lib/platform/seo/log-redaction'
import { buildSeoSiteOverviewDto } from '@/lib/platform/seo/dashboard-read-model'

const allowedHosts = ['example.test']

function memoryTransport(pages: Record<string, { status: number; body: string; headers?: Record<string, string> }>): CrawlHttpTransport {
  return {
    async fetch(url: string) {
      const hit = pages[url] ?? pages[new URL(url).pathname] 
      if (!hit) return { status: 404, body: '<html></html>', headers: {}, finalUrl: url }
      return { status: hit.status, body: hit.body, headers: hit.headers ?? {}, finalUrl: url }
    },
  }
}

describe('SEO-07 foundation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('1/4: entitlement gate and sibling billing group isolation', () => {
    const entitlement = getServiceEntitlement('core.local-seo')
    expect(entitlement).toBeTruthy()
    const access = evaluateEntitlementAccess(entitlement!)
    expect(['INCLUDED', 'POLICY_UNRESOLVED', 'DISABLED']).toContain(access.access)
    const iso = buildAbmedSeoSiblingIsolationCase()
    const denied = denyBillingGroupSiblingSeoAccess({
      actorUserId: 'u1',
      operatingAccountId: iso.aestheticsAccountId,
      recordAccountId: iso.physiciansAccountId,
      operatingMemberships: [{ userId: 'u1', customerAccountId: iso.aestheticsAccountId }],
      billingGroupSiblingAccounts: iso.billingGroupSiblingAccounts,
    })
    expect(denied.ok).toBe(false)
    expect(assertSameSeoAccount(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID).ok).toBe(false)
  })

  it('5: domain and URL-prefix GSC property matching', () => {
    const domain = matchGscPropertyToSite({
      propertyRef: 'sc-domain:example.test',
      authorizedHosts: ['example.test'],
    })
    expect(domain.ok).toBe(true)
    const prefix = matchGscPropertyToSite({
      propertyRef: 'https://example.test/',
      authorizedHosts: ['example.test'],
    })
    expect(prefix.ok).toBe(true)
    const foreign = matchGscPropertyToSite({
      propertyRef: 'sc-domain:other.test',
      authorizedHosts: ['example.test'],
    })
    expect(foreign.ok).toBe(false)
  })

  it('6-8: crawler blocks localhost/private and enforces limits', async () => {
    expect(validateCrawlTargetUrl({ url: 'http://127.0.0.1/', allowedHosts }).ok).toBe(false)
    expect(validateCrawlTargetUrl({ url: 'http://localhost/', allowedHosts }).ok).toBe(false)
    expect(validateCrawlTargetUrl({ url: 'http://192.168.0.1/', allowedHosts }).ok).toBe(false)
    const redirect = validateRedirectTarget({
      fromUrl: 'https://example.test/a',
      toUrl: 'http://127.0.0.1/',
      allowedHosts,
      redirectCount: 1,
      maxRedirects: 5,
    })
    expect(redirect.ok).toBe(false)
    const transport = memoryTransport({
      'https://example.test/': {
        status: 200,
        body: '<html><head><title>Home</title></head><body><a href="https://example.test/about">About</a></body></html>',
      },
    })
    const crawl = await runBoundedSiteCrawl({
      seedUrl: 'https://example.test/',
      allowedHosts,
      transport,
      maxPages: 1,
      maxDepth: 1,
    })
    expect(crawl.ok).toBe(true)
    if (crawl.ok) expect(crawl.value.pages.length).toBe(1)
  })

  it('9-11: parse title/meta/H1/canonical and duplicate/broken detection', async () => {
    const parsed = parseHtmlSeoSignals(
      '<html><head><title>T</title><meta name="description" content="D"/><link rel="canonical" href="https://example.test/"/></head><body><h1>H</h1></body></html>',
      'https://example.test/',
    )
    expect(parsed.title).toBe('T')
    expect(parsed.metaDescription).toBe('D')
    expect(parsed.h1).toBe('H')
    const transport = memoryTransport({
      'https://example.test/': { status: 200, body: '<html><head><title>Dupe</title></head><body><a href="https://example.test/x">x</a><a href="https://example.test/missing">m</a></body></html>' },
      'https://example.test/x': { status: 200, body: '<html><head><title>Dupe</title></head></html>' },
      'https://example.test/missing': { status: 404, body: 'missing' },
    })
    const crawl = await runBoundedSiteCrawl({
      seedUrl: 'https://example.test/',
      allowedHosts,
      transport,
      maxPages: 3,
      maxDepth: 2,
    })
    expect(crawl.ok).toBe(true)
    if (crawl.ok) {
      expect(crawl.value.duplicateTitles.length).toBeGreaterThan(0)
      expect(crawl.value.brokenInternalLinks.some((b) => b.status === 404)).toBe(true)
    }
  })

  it('12: discovered vs published counts from fixture rows', () => {
    const summary = summarizePageInventory(buildSyntheticPageInventoryFixture())
    expect(summary.discovered + summary.crawled).toBe(24)
    expect(summary.draft).toBe(3)
    expect(summary.publishedOnlyWhenVerified).toBe(2)
  })

  it('13-16: GSC mock normalization, average position, CTR aggregation, no zero-fill', () => {
    const normalized = normalizeGscSearchAnalyticsResponse({
      propertyRef: 'sc-domain:example.test',
      request: { startDate: '2026-10-01', endDate: '2026-10-07', dimensions: ['query', 'page'] },
      response: MOCK_GSC_RESPONSE,
      observedAt: new Date('2026-10-08T00:00:00Z'),
    })
    expect(normalized.rows[0]?.averagePosition).toBe(8.2)
    expect(normalized.rows[0]?.metricSemantics.positionIsAverage).toBe(true)
    const traffic = aggregateGscTraffic(normalized.rows)
    expect(traffic.clicks).toBe(52)
    expect(traffic.ctr).toBeCloseTo(52 / 1300, 5)
    const avg = aggregateGscAveragePosition(normalized.rows)
    expect(avg).not.toBeNull()
    const filled = fillMissingGscDays('2026-10-01', '2026-10-07', normalized.rows)
    expect(filled.length).toBe(normalized.rows.length)
  })

  it('17: foreign Google property denied', () => {
    const denied = denyForeignGoogleProperty({
      connectionAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      requestAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      propertyRef: 'sc-domain:example.test',
      authorizedPropertyRefs: ['sc-domain:example.test'],
    })
    expect(denied.ok).toBe(false)
  })

  it('18: OAuth tokens redacted from logs', () => {
    const raw = 'token ya29.super-secret-value failed'
    expect(redactOAuthLikeSecrets(raw)).not.toContain('ya29.')
    const log = safeSeoLog({ event: 'gsc_fetch', detail: { authorization: 'Bearer abc.def.ghi' } })
    expect(JSON.stringify(log)).not.toContain('abc.def.ghi')
  })

  it('19: GA4/GBP disconnected handled honestly', async () => {
    const ga4 = createGoogleGa4SeoProvider()
    const gbp = createGoogleGbpSeoProvider()
    const ctx = {
      customerAccountId: 'a',
      actorId: 'u',
      actorType: 'USER' as const,
      requestId: 'r',
      idempotencyKey: 'k',
    }
    expect((await ga4.readOverview(ctx)).ok && (await ga4.readOverview(ctx))).toMatchObject({ ok: true, value: { status: 'NOT_CONNECTED' } })
    expect((await gbp.readOverview(ctx)).ok && (await gbp.readOverview(ctx))).toMatchObject({ ok: true, value: { status: 'NOT_CONNECTED' } })
  })

  it('20-22: Places discovery is not rank; competitor ordering; honest missing rank', () => {
    expect(placesDiscoveryIsNotKeywordRank()).toBe(true)
    const ranked = rankCompetitorCandidates([
      { displayName: 'A', categoryMatch: 0.9, serviceOverlap: 0.8, geoRelevance: 0.7, observedEvidence: 0.6 },
      { displayName: 'B', categoryMatch: 0.5, serviceOverlap: 0.5, geoRelevance: 0.5, observedEvidence: 0.5 },
    ])
    expect(ranked[0]?.displayName).toBe('A')
    expect(localRankWhenProviderDisconnected().dataState).toBe('NOT_CONNECTED')
  })

  it('23: opportunity provenance and deterministic priority', () => {
    const crawl = {
      pages: [
        {
          url: 'https://example.test/',
          httpStatus: 200,
          parsed: parseHtmlSeoSignals('<html><body></body></html>', 'https://example.test/'),
          redirectChain: [],
        },
      ],
      bytesDownloaded: 100,
      duplicateTitles: [],
      brokenInternalLinks: [],
    }
    const opps = sortOpportunitiesDeterministic(detectCrawlOpportunities(crawl, new Date()))
    expect(opps[0]?.evidenceRef).toContain('crawl:')
    expect(opps[0]?.priorityScore).toBeGreaterThan(0)
  })

  it('24/28: no auto publish; AI cannot self-authorize edits', () => {
    const deniedPublish = denySeoAutoPublish({
      opportunityState: 'PUBLISHED',
      hasApprovedManagedSiteChange: false,
      agentToolGrantApproved: true,
    })
    expect(deniedPublish.ok).toBe(false)
    expect(denyAiSelfAuthorizedSiteEdit().ok).toBe(false)
  })

  it('25-27: stale/disconnected sync skipped without quota spend', () => {
    const skipped = prepareSeoProviderSyncRun({
      provider: 'GSC',
      connectionDataState: 'NOT_CONNECTED',
      idempotencyKey: 'sync-1',
      oauthEnabled: false,
      apiEnabled: false,
    })
    expect(skipped.status).toBe('SKIPPED')
    expect(skipped.dataState).toBe('NOT_CONNECTED')
    const keyA = buildSeoMetricIdempotencyKey({
      managedSiteId: 's1',
      provider: 'GSC',
      metricDefinition: 'clicks',
      date: '2026-10-01',
    })
    const keyB = buildSeoMetricIdempotencyKey({
      managedSiteId: 's1',
      provider: 'GSC',
      metricDefinition: 'clicks',
      date: '2026-10-01',
    })
    expect(keyA).toBe(keyB)
  })

  it('29: GSC provider disabled returns NOT_CONFIGURED on query', async () => {
    const provider = createGoogleGscSeoProvider({
      transport: { async postJson() { return { status: 200, json: MOCK_GSC_RESPONSE } } },
      resolveAccessTokenRef: async () => 'secret-ref',
      resolvePropertyRef: async () => 'sc-domain:example.test',
      resolveAuthorizedHosts: async () => ['example.test'],
    })
    const extended = provider as typeof provider & {
      querySearchAnalytics: (ctx: unknown, req: unknown) => Promise<{ ok: boolean; code?: string }>
    }
    const res = await extended.querySearchAnalytics(
      {
        customerAccountId: 'a',
        actorId: 'u',
        actorType: 'USER',
        requestId: 'r',
        idempotencyKey: 'k',
      },
      { startDate: '2026-10-01', endDate: '2026-10-07' },
    )
    expect(res.ok).toBe(false)
    expect(res.code).toBe('NOT_CONFIGURED')
  })

  it('30: dashboard DTO distinguishes not connected GSC vs crawl inventory', () => {
    const dto = buildSeoSiteOverviewDto({
      managedSiteId: 'site1',
      connections: [],
      inventoryCounts: buildSyntheticPageInventoryFixture(),
      findingsCount: 2,
      competitors: [],
      opportunities: detectGscOpportunities([], new Date()),
      workEvidenceCount: 0,
      rankProviderState: 'NOT_CONNECTED',
    })
    expect(dto.sections.gscPerformance.dataState).toBe('NOT_CONNECTED')
    expect(dto.sections.gscPerformance.clicks).toBeNull()
    expect(dto.sections.pageCounts.published).toBe(2)
  })
})
