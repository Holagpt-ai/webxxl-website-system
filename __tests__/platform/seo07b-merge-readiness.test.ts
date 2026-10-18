import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyNonPublicDestination,
  unwrapHostnameForIpCheck,
  validateCrawlTargetUrl,
} from '@/lib/platform/seo/crawl-authorization'
import { isSyntheticCrawlTestBypass } from '@/lib/platform/seo/crawl-test-gate'
import { authorizeGscSearchAnalyticsQuery } from '@/lib/platform/seo/gsc-query-auth'
import { buildGscPerformanceFromObservations } from '@/lib/platform/seo/gsc-performance-read'
import { sanitizeOwnerSubmittedCompetitors } from '@/lib/platform/seo/competitor-public-input'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

describe('SEO-07B merge readiness', () => {
  afterEach(() => vi.unstubAllEnvs())

  const inScopeAllowlist = ['fe80::1', 'fc00::1', '::1', '10.0.0.1', '::ffff:192.168.1.1', 'example.test']

  it('1: private destinations blocked by classification even when allowlisted', () => {
    const cases = [
      { host: '[fe80::1]', url: 'http://[fe80::1]/' },
      { host: '[fc00::1]', url: 'http://[fc00::1]/' },
      { host: '[::1]', url: 'http://[::1]/' },
      { host: '::ffff:192.168.1.1', url: 'http://[::ffff:192.168.1.1]/' },
    ]
    for (const { host, url } of cases) {
      const parsedHost = new URL(url).hostname
      const classified = classifyNonPublicDestination(host)
      expect(classified.ok).toBe(false)
      if (!classified.ok) {
        expect(classified.message).toContain('Private or local target blocked')
      }
      expect(classifyNonPublicDestination(parsedHost).ok).toBe(false)
      const validated = validateCrawlTargetUrl({
        url,
        allowedHosts: [...inScopeAllowlist, parsedHost, unwrapHostnameForIpCheck(host)],
      })
      expect(validated.ok).toBe(false)
      if (!validated.ok) expect(validated.message).toContain('Private or local target blocked')
    }
  })

  it('1b: production cannot use synthetic crawl bypass', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isSyntheticCrawlTestBypass(true)).toBe(false)
  })

  it('2: PENDING + READY GSC cannot query Search Analytics', () => {
    const denied = authorizeGscSearchAnalyticsQuery({
      contextAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      contextManagedSiteId: 'site-a',
      connection: {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        propertyRef: 'sc-domain:example.test',
        verificationState: 'PENDING',
        dataState: 'READY',
        secretRef: 'sec-1',
        revokedAt: null,
      },
      authorizedHosts: ['example.test'],
      request: { startDate: '2026-10-01', endDate: '2026-10-07' },
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.message).toContain('not verified')
  })

  it('3: forged client provenance rejected; owner path stays OWNER_SUPPLIED', async () => {
    const forged = sanitizeOwnerSubmittedCompetitors([
      {
        displayName: 'Fake',
        categoryMatch: 0.5,
        serviceOverlap: 0.5,
        geoRelevance: 0.5,
        observedEvidence: 0.5,
        provenance: 'PLACES_DISCOVERY',
        providerObservationRef: 'forged-ref',
      },
    ])
    expect(forged.ok).toBe(false)

    const ok = sanitizeOwnerSubmittedCompetitors([
      {
        displayName: 'Owner Named',
        placeId: 'places/abc',
        categoryMatch: 0.5,
        serviceOverlap: 0.5,
        geoRelevance: 0.5,
        observedEvidence: 0.5,
      },
    ])
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value[0]?.provenance).toBe('OWNER_SUPPLIED')
  })

  it('4: without verified snapshot window, performance is PARTIAL with null metrics', () => {
    const perf = buildGscPerformanceFromObservations({
      connectionDataState: 'READY',
      propertyRef: 'sc-domain:example.test',
      rows: [
        {
          idempotencyKey: 'k1',
          query: 'q',
          page: '/',
          clicks: 99,
          impressions: 999,
          ctr: 0.1,
          averagePosition: 3,
          date: new Date('2026-10-01'),
          dataState: 'READY',
        },
      ],
      requireVerifiedSnapshotWindow: true,
    })
    expect(perf.dataState).toBe('PARTIAL')
    expect(perf.clicks).toBeNull()
    expect(perf.completeness.limitations[0]).toContain('No verified GSC snapshot window')
  })
})
