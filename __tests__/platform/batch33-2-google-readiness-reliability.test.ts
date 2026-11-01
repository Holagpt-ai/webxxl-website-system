import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSite: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    siteAnalyticsConnection: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    seoProviderSyncRun: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT } from '@/config/google-integration'
import { loadBoundedAccountReadinessSites } from '@/lib/platform/google/account-readiness-load'
import { buildGoogleAccountReadiness } from '@/lib/platform/google/account-readiness-service'
import { recordGoogleReadinessSyncRun } from '@/lib/platform/google/readiness-sync-persist'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { prisma } from '@/lib/db'

const siteRow = (id: string) => ({
  id,
  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
  domain: 'example.test',
  name: `Site ${id}`,
  canonicalUrl: 'https://example.test',
})

describe('Batch 33.2 Google readiness reliability', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('loads at most N+1 site rows and counts only when truncated', async () => {
    const overflow = GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT + 1
    vi.mocked(prisma.managedSite.findMany).mockResolvedValue(
      Array.from({ length: overflow }, (_, i) => siteRow(`site-${i}`)) as never,
    )
    vi.mocked(prisma.managedSite.count).mockResolvedValue(40)

    const result = await loadBoundedAccountReadinessSites(ABMED_AESTHETICS_ACCOUNT_ID)

    expect(prisma.managedSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT + 1,
        where: { customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
      }),
    )
    expect(prisma.managedSite.count).toHaveBeenCalledTimes(1)
    expect(result.sitesTruncated).toBe(true)
    expect(result.sitesTotal).toBe(40)
    expect(result.sites).toHaveLength(GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT)
  })

  it('loads Google connections only for bounded site ids on account-wide readiness', async () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.mocked(prisma.managedSite.findMany).mockResolvedValue([siteRow('site-0'), siteRow('site-1')] as never)

    await buildGoogleAccountReadiness({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: null,
    })

    expect(prisma.siteAnalyticsConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          managedSiteId: { in: ['site-0', 'site-1'] },
        }),
      }),
    )
    expect(prisma.managedSite.count).not.toHaveBeenCalled()
  })

  it('treats concurrent create unique violation as idempotent replay', async () => {
    const idempotencyKey = 'google-readiness:v1:acct:site:GSC:dup'
    vi.mocked(prisma.seoProviderSyncRun.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'r1',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        status: 'READINESS',
        errorClass: 'GOOGLE_READINESS_NOT_CONNECTED',
        dataState: 'NOT_CONNECTED',
      } as never)

    vi.mocked(prisma.seoProviderSyncRun.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    )

    const outcome = await recordGoogleReadinessSyncRun({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      idempotencyKey,
      readinessState: 'NOT_CONNECTED',
    })

    expect(outcome.outcome).toBe('IDEMPOTENT_REPLAY')
    expect(prisma.seoProviderSyncRun.updateMany).not.toHaveBeenCalled()
  })

  it('uses guarded updateMany and refuses to clobber ingestion status under concurrency', async () => {
    const readinessRow = {
      id: 'r2',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      status: 'READINESS',
      errorClass: 'GOOGLE_READINESS_NOT_CONNECTED',
      dataState: 'NOT_CONNECTED',
    }
    const completedRow = {
      id: 'r2',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      status: 'COMPLETED',
      errorClass: null,
      dataState: 'READY',
    }
    vi.mocked(prisma.seoProviderSyncRun.findUnique)
      .mockResolvedValueOnce(readinessRow as never)
      .mockResolvedValueOnce(completedRow as never)

    vi.mocked(prisma.seoProviderSyncRun.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.seoProviderSyncRun.create).mockRejectedValue(new Error('create should not run'))

    const outcome = await recordGoogleReadinessSyncRun({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      provider: 'GSC',
      idempotencyKey: 'google-readiness:v1:acct:site:GSC:race',
      readinessState: 'READY_FOR_INGEST',
    })

    expect(outcome.outcome).toBe('BLOCKED_BY_INGESTION_RUN')
    expect(prisma.seoProviderSyncRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'READINESS' }),
      }),
    )
    expect(prisma.seoProviderSyncRun.create).not.toHaveBeenCalled()
  })
})
