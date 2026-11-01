import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    seoProviderSyncRun: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'sync-new' }),
      update: vi.fn().mockResolvedValue({ id: 'sync-upd' }),
      upsert: vi.fn(),
    },
  },
}))

import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { buildGoogleReadinessSyncIdempotencyKey } from '@/lib/platform/google/readiness-idempotency'
import {
  parseGoogleReadinessProvidersBody,
  validateGoogleReadinessClientRequestKey,
} from '@/lib/platform/google/readiness-request-validate'
import { runBoundedGoogleReadinessOperation } from '@/lib/platform/google/readiness-operation'
import { recordGoogleReadinessSyncRun } from '@/lib/platform/google/readiness-sync-persist'
import { assertSeoPermission } from '@/lib/platform/seo/permissions'
import { prisma } from '@/lib/db'

describe('Batch 33.1 Google readiness safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('derives tenant-scoped idempotency keys so the same client key cannot cross accounts', () => {
    const clientKey = 'owner-assess-2026-11-01'
    const keyA = buildGoogleReadinessSyncIdempotencyKey({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      clientRequestKey: clientKey,
    })
    const keyB = buildGoogleReadinessSyncIdempotencyKey({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      clientRequestKey: clientKey,
    })
    expect(keyA).not.toBe(keyB)
    expect(keyA).toContain(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(keyB).toContain(ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(keyA.startsWith('google-readiness:v1:')).toBe(true)
  })

  it('rejects malformed idempotency keys and provider arrays at the HTTP validation layer', () => {
    expect(validateGoogleReadinessClientRequestKey('').ok).toBe(false)
    expect(validateGoogleReadinessClientRequestKey('short').ok).toBe(false)
    expect(validateGoogleReadinessClientRequestKey('a'.repeat(200)).ok).toBe(false)
    expect(validateGoogleReadinessClientRequestKey('bad key spaces').ok).toBe(false)
    expect(validateGoogleReadinessClientRequestKey('analytics-sync:evil').ok).toBe(false)

    expect(parseGoogleReadinessProvidersBody(['GSC', 'GSC']).ok).toBe(false)
    expect(parseGoogleReadinessProvidersBody(['GSC', 'GA4', 'GBP', 'GSC']).ok).toBe(false)
    expect(parseGoogleReadinessProvidersBody('GSC').ok).toBe(false)
    expect(parseGoogleReadinessProvidersBody([]).ok).toBe(false)
  })

  it('requires seo.configure for readiness assess (MEMBER cannot configure)', () => {
    expect(() =>
      assertSeoPermission({ membershipRole: 'MEMBER', isStaff: false }, 'seo.configure'),
    ).toThrow(/Missing SEO permission/)
    expect(() =>
      assertSeoPermission({ membershipRole: 'OWNER', isStaff: false }, 'seo.configure'),
    ).not.toThrow()
  })

  it('does not overwrite an existing ingestion sync run', async () => {
    vi.mocked(prisma.seoProviderSyncRun.findUnique).mockResolvedValue({
      id: 'ingest-1',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      status: 'COMPLETED',
      errorClass: null,
      dataState: 'READY',
    } as never)

    const outcome = await recordGoogleReadinessSyncRun({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      idempotencyKey: buildGoogleReadinessSyncIdempotencyKey({
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        provider: 'GSC',
        clientRequestKey: 'repeatable-key-01',
      }),
      readinessState: 'READY_FOR_INGEST',
    })

    expect(outcome.outcome).toBe('BLOCKED_BY_INGESTION_RUN')
    expect(prisma.seoProviderSyncRun.update).not.toHaveBeenCalled()
    expect(prisma.seoProviderSyncRun.create).not.toHaveBeenCalled()
  })

  it('persists readiness with READINESS status and NOT_CONNECTED dataState (not ingest success)', async () => {
    vi.mocked(prisma.seoProviderSyncRun.findUnique).mockResolvedValue(null)

    await recordGoogleReadinessSyncRun({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      idempotencyKey: 'google-readiness:v1:acct:site:GSC:abc',
      readinessState: 'READY_FOR_INGEST',
    })

    expect(prisma.seoProviderSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'READINESS',
          dataState: 'NOT_CONNECTED',
          errorClass: 'GOOGLE_READINESS_READY_FOR_INGEST',
        }),
      }),
    )
  })

  it('replays idempotent readiness without mutating ingestion rows', async () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')

    vi.mocked(prisma.seoProviderSyncRun.findUnique).mockResolvedValue({
      id: 'ready-1',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      status: 'READINESS',
      errorClass: 'GOOGLE_READINESS_NOT_CONNECTED',
      dataState: 'NOT_CONNECTED',
    } as never)

    const result = await runBoundedGoogleReadinessOperation({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [],
      providers: ['GSC'],
      clientRequestKey: 'repeatable-key-02',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcomes[0]?.syncRunStatus).toBe('READINESS_REPLAY')
    }
    expect(prisma.seoProviderSyncRun.update).not.toHaveBeenCalled()
  })

  it('reports ingestion run untouched when worker row already exists for derived key', async () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')

    vi.mocked(prisma.seoProviderSyncRun.findUnique).mockResolvedValue({
      id: 'ingest-2',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      status: 'PARTIAL',
      errorClass: 'EXTERNAL_EFFECTS_DISABLED',
      dataState: 'FETCHING',
    } as never)

    const result = await runBoundedGoogleReadinessOperation({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [],
      providers: ['GSC'],
      clientRequestKey: 'repeatable-key-03',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcomes[0]?.syncRunStatus).toBe('INGESTION_RUN_UNTOUCHED')
    }
  })
})
