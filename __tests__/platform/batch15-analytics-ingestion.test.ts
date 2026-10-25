import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    seoProviderSyncRun: { upsert: vi.fn().mockResolvedValue({ id: 'sync' }) },
    seoMetricObservation: { upsert: vi.fn().mockResolvedValue({}) },
    seoKeywordObservation: { upsert: vi.fn().mockResolvedValue({}) },
  },
}))
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { buildAbmedSeoSiblingIsolationCase } from '@/lib/platform/seo/test-fixtures-seo07'
import { denyBillingGroupSiblingAnalyticsAccess } from '@/lib/platform/analytics/account-isolation'
import { utcDayBounds } from '@/lib/platform/analytics/aggregation/conversion-daily'
import {
  hashCaptureSecret,
  resolveCaptureSecretMaterial,
  verifyCaptureRequestSignature,
} from '@/lib/platform/analytics/capture/signature-auth'
import { isApprovedCaptureEventKey } from '@/lib/platform/analytics/capture/event-keys'
import { validateCaptureEventPayload } from '@/lib/platform/analytics/capture/validate-payload'
import { resetCaptureRateLimitsForTests, checkCaptureRateLimit } from '@/lib/platform/analytics/capture/rate-limit'
import { boundedBackfillDays, runAnalyticsProviderIngest } from '@/lib/platform/analytics/ingestion/provider-ingest'
import { persistGscDailyMetrics } from '@/lib/platform/analytics/ingestion/persist-observations'
import { buildAnalyticsProviderSyncJobIdempotencyKey } from '@/lib/platform/analytics/ids'

describe('BATCH-15 analytics ingestion & conversion pipeline', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    resetCaptureRateLimitsForTests()
  })

  it('tenant isolation unchanged for analytics capture scope', () => {
    const iso = buildAbmedSeoSiblingIsolationCase()
    const denied = denyBillingGroupSiblingAnalyticsAccess({
      actorUserId: 'u1',
      operatingAccountId: iso.aestheticsAccountId,
      recordAccountId: iso.physiciansAccountId,
      operatingMemberships: [{ userId: 'u1', customerAccountId: iso.aestheticsAccountId }],
      billingGroupSiblingAccounts: iso.billingGroupSiblingAccounts,
    })
    expect(denied.ok).toBe(false)
    expect(ABMED_AESTHETICS_ACCOUNT_ID).not.toBe(ABMED_PHYSICIANS_ACCOUNT_ID)
  })

  it('rejects unsupported events and sensitive payload fields', () => {
    expect(isApprovedCaptureEventKey({ eventKey: 'form_submit' })).toBe(true)
    expect(isApprovedCaptureEventKey({ eventKey: 'custom_conversion', customConversionKey: 'quote' })).toBe(true)
    expect(isApprovedCaptureEventKey({ eventKey: 'random_event' })).toBe(false)
    const bad = validateCaptureEventPayload({
      rawBody: JSON.stringify({ eventKey: 'form_submit', consentGranted: true, email: 'x@y.com' }),
      parsed: { eventKey: 'form_submit', consentGranted: true, metadata: { email: 'x@y.com' } },
    })
    expect(bad.ok).toBe(false)
    const noConsent = validateCaptureEventPayload({
      rawBody: '{}',
      parsed: { eventKey: 'form_submit', consentGranted: false },
    })
    expect(noConsent.ok).toBe(false)
  })

  it('verifies signed capture requests and enforces replay window', () => {
    const secret = 'site-secret-test'
    const hash = hashCaptureSecret(secret)
    vi.stubEnv('ANALYTICS_CAPTURE_SECRET_site_key_1', secret)
    const resolved = resolveCaptureSecretMaterial({
      publicKeyId: 'site_key_1',
      secretRef: null,
      secretHash: hash,
    })
    expect(resolved.ok).toBe(true)
    const body = JSON.stringify({ eventKey: 'form_submit', consentGranted: true })
    const ts = Math.floor(Date.now() / 1000)
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
    const ok = verifyCaptureRequestSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts),
      secret,
    })
    expect(ok.ok).toBe(true)
    const replay = verifyCaptureRequestSignature({
      rawBody: body,
      signatureHeader: sig,
      timestampHeader: String(ts - 9999),
      secret,
      toleranceSeconds: 60,
    })
    expect(replay.ok).toBe(false)
  })

  it('rate limits capture keys', () => {
    vi.stubEnv('ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE', '2')
    expect(checkCaptureRateLimit({ publicKeyId: 'k1', limitPerMinute: 2 }).ok).toBe(true)
    expect(checkCaptureRateLimit({ publicKeyId: 'k1', limitPerMinute: 2 }).ok).toBe(true)
    expect(checkCaptureRateLimit({ publicKeyId: 'k1', limitPerMinute: 2 }).ok).toBe(false)
  })

  it('provider ingest stays blocked without external fetch flags', async () => {
    vi.stubEnv('ANALYTICS_INGESTION_ENABLED', '1')
    vi.stubEnv('SEO_GSC_API_ENABLED', '1')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', '1')
    const outcome = await runAnalyticsProviderIngest({
      customerAccountId: 'acct',
      managedSiteId: 'site',
      provider: 'GSC',
      idempotencyKey: buildAnalyticsProviderSyncJobIdempotencyKey({
        managedSiteId: 'site',
        provider: 'GSC',
        periodDate: '2026-01-01',
      }),
      connectionDataState: 'READY',
    })
    expect(outcome.status).toBe('BLOCKED')
    expect(outcome.externalFetchAttempted).toBe(false)
  })

  it('bounded backfill respects configured maximum', () => {
    vi.stubEnv('ANALYTICS_INGESTION_MAX_BACKFILL_DAYS', '7')
    expect(boundedBackfillDays(30)).toBe(7)
    expect(boundedBackfillDays(3)).toBe(3)
  })

  it('UTC day boundaries align aggregation windows', () => {
    const { start, end } = utcDayBounds(new Date('2026-01-15T23:59:00.000Z'))
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-16T00:00:00.000Z')
  })

  it('GSC normalization persistence uses idempotent keys', async () => {
    const result = await persistGscDailyMetrics({
      customerAccountId: 'a',
      managedSiteId: 's',
      provider: 'GSC',
      propertyRef: 'https://example.com/',
      observedAt: new Date('2026-01-01T12:00:00.000Z'),
      dataState: 'READY',
      rows: [
        {
          date: '2026-01-01',
          query: 'widgets',
          clicks: 3,
          impressions: 10,
          ctr: 0.3,
          averagePosition: 4.2,
          metricSemantics: { positionIsAverage: true, ctrIsRatio: true, missingRowIsNotZero: true },
        },
      ],
    })
    expect(result.keywords).toBe(1)
    expect(result.metrics).toBe(1)
  })
})
