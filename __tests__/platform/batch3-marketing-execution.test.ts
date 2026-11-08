import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { prepareApprovedCreativeSocialHandoff, prepareSocialHandoffFromApprovedCreative } from '@/lib/platform/marketing/social-handoff-service'

const buildPostizMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  managedSite: { findFirst: vi.fn() },
  marketingRequest: { groupBy: vi.fn() },
  marketingArtifactReview: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  socialPublication: { groupBy: vi.fn(), count: vi.fn() },
  marketingArtifact: { findFirst: vi.fn() },
  crmSegment: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

vi.mock('@/lib/platform/social/postiz-provider-readiness', () => ({
  buildPostizProviderReadiness: buildPostizMock,
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(async (customerAccountId: string) => ({
    customerAccountId,
    subscriptions:
      customerAccountId === 'acct_a'
        ? [{ customerAccountId, productKey: 'website.subscription', status: 'ACTIVE' }]
        : [],
    legacyWebsiteServices: [],
    loadOutcome: 'ok' as const,
  })),
}))

vi.mock('@/lib/platform/marketing/crm-segment-audience-service', () => ({
  listCrmSegmentsForAudiencePlanning: vi.fn(async (customerAccountId: string) => ({
    ok: true,
    value:
      customerAccountId === 'acct_a'
        ? [
            {
              id: 'seg_1',
              name: 'Newsletter',
              kind: 'STATIC',
              updatedAt: '2026-11-08T00:00:00.000Z',
              audiencePlanningEligible: true,
            },
          ]
        : [],
  })),
  previewCrmSegmentAudience: vi.fn(async () => ({
    ok: true,
    value: {
      segmentId: 'seg_1',
      segmentName: 'Newsletter',
      evaluatedAt: '2026-11-08T12:00:00.000Z',
      audience: {
        totalMatchedContacts: 3,
        marketingConsentGrantedContacts: 2,
        revokedExpiredOrSuppressedContacts: 1,
        unknownMarketingConsentContacts: 0,
        missingUsableEmailContacts: 0,
      },
      disclosures: {
        synchronousEvaluationLimit: 500,
        limitAppliesToActiveContactsInAccount: true,
        consentStatesArePointInTime: true,
        outboundExecutionRequiresFreshEvaluation: true,
      },
    },
  })),
}))

function portalStub(accountId: string): PortalUser {
  return {
    id: 'user_1',
    role: 'CUSTOMER',
    membership: { role: 'OWNER', customerAccountId: accountId, userId: 'user_1' } as PortalUser['membership'],
    customerAccount: { id: accountId, businessName: 'Co' } as PortalUser['customerAccount'],
  } as PortalUser
}

describe('Batch 3 marketing execution integration', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    buildPostizMock.mockReset()
    process.env = {
      ...env,
      MKT_BACKEND_ENABLED: 'true',
      MKT_EXTERNAL_HANDOFF_ENABLED: 'true',
      SOCIAL_MARKETING_ENABLED: 'true',
      SOCIAL_EXECUTION_GATES_ENABLED: 'false',
      POSTIZ_API_ENABLED: 'false',
      POSTIZ_LIVE_PUBLISHING_ENABLED: 'false',
      OPEN001_FREE_SOFTWARE_COHORT: 'SUBSCRIBER_ONLY',
    }
    prismaMock.managedSite.findFirst.mockResolvedValue({ id: 'site_a' })
    prismaMock.marketingRequest.groupBy.mockResolvedValue([{ status: 'APPROVED', _count: { _all: 2 } }])
    prismaMock.marketingArtifactReview.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValue(0)
    prismaMock.marketingArtifactReview.findMany.mockResolvedValue([
      {
        id: 'rev_1',
        marketingRequestId: 'req_1',
        marketingArtifactId: 'art_1',
        managedSiteId: 'site_a',
        revisionHash: 'hash_ok',
        status: 'APPROVED',
        expiresAt: null,
        decidedAt: new Date('2026-11-07'),
        revokedAt: null,
        allowedChannel: 'linkedin',
      },
    ])
    prismaMock.socialPublication.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 3 } },
      { status: 'SCHEDULED', _count: { _all: 2 } },
    ])
    prismaMock.socialPublication.count.mockResolvedValue(0)
    prismaMock.marketingArtifactReview.findFirst.mockResolvedValue({
      status: 'APPROVED',
      expiresAt: null,
      revokedAt: null,
      allowedChannel: 'linkedin',
    })
  })

  afterEach(() => {
    process.env = env
    vi.clearAllMocks()
  })

  it('documents execution summary API for v0 Stage B', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH3-MARKETING-EXECUTION-API-CONTRACT.md'),
      'utf8',
    )
    expect(doc).toContain('/api/v1/marketing/execution/summary')
    expect(doc).toContain('planningOnly')
    expect(doc).toContain('dashboard/marketing')
    expect(doc).toContain('not `dashboard/business/**`')
  })

  it('composes workflow, review, CRM, and social slices with dispatch blocked', async () => {
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_a'), managedSiteId: 'site_a' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.workflowCounts.status).toBe('AVAILABLE')
    expect(result.value.crmAudiencePlanning.status).toBe('AVAILABLE')
    expect(buildPostizMock).not.toHaveBeenCalled()
    expect(result.value.socialProviderReadiness.status).toBe('UNAVAILABLE')
    expect(result.value.socialHandoffPolicy.status).toBe('AVAILABLE')
    if (result.value.socialHandoffPolicy.status === 'AVAILABLE') {
      expect(result.value.socialHandoffPolicy.data.dispatchBlocked).toBe(true)
    }
  })

  it('returns NOT_FOUND for cross-account managed site scope', async () => {
    prismaMock.managedSite.findFirst.mockResolvedValue(null)
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_b'), managedSiteId: 'site_a' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('NOT_FOUND')
  })

  it('marks marketing slices unavailable for OPEN-001 ineligible account', async () => {
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_denied') })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.workflowCounts.status).toBe('UNAVAILABLE')
    expect(prismaMock.marketingRequest.groupBy).not.toHaveBeenCalled()
  })

  it('denies social handoff when revision hash mismatches artifact', async () => {
    prismaMock.marketingArtifact.findFirst.mockResolvedValue({
      id: 'art_1',
      revisionHash: 'hash_live',
      artifactType: 'SOCIAL_POST',
      managedSiteId: 'site_a',
    })
    const result = await prepareApprovedCreativeSocialHandoff({
      customerAccountId: 'acct_a',
      marketingArtifactId: 'art_1',
      revisionHash: 'hash_tampered',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('VALIDATION')
  })

  it('denies social handoff for revoked approval', async () => {
    prismaMock.marketingArtifact.findFirst.mockResolvedValue({
      id: 'art_1',
      revisionHash: 'hash_ok',
      artifactType: 'SOCIAL_POST',
      managedSiteId: 'site_a',
    })
    prismaMock.marketingArtifactReview.findFirst.mockResolvedValue({
      status: 'REVOKED',
      expiresAt: null,
      revokedAt: new Date(),
      allowedChannel: 'linkedin',
    })
    const result = await prepareApprovedCreativeSocialHandoff({
      customerAccountId: 'acct_a',
      marketingArtifactId: 'art_1',
      revisionHash: 'hash_ok',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('FORBIDDEN')
  })

  it('prepares handoff only in blocked scheduling mode', () => {
    const handoff = prepareSocialHandoffFromApprovedCreative({ revisionHash: 'abc', approved: true })
    expect(handoff.ok).toBe(true)
    if (handoff.ok) {
      expect(handoff.value.schedulingAllowed).toBe(false)
    }
  })

  it('scopes social publication aggregates to managed site via campaign relation', async () => {
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    await getMarketingExecutionSummary({ portal: portalStub('acct_a'), managedSiteId: 'site_a' })
    expect(prismaMock.socialPublication.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerAccountId: 'acct_a',
          campaign: { managedSiteId: 'site_a' },
        }),
      }),
    )
    expect(prismaMock.socialPublication.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign: { managedSiteId: 'site_a' },
          publishedUrl: { not: null },
        }),
      }),
    )
  })

  it('keeps PENDING out of execution ladder SCHEDULED total', async () => {
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_a'), managedSiteId: 'site_a' })
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.workflowCounts.status !== 'AVAILABLE') return
    expect(result.value.workflowCounts.data.publicationStatus.PENDING).toBe(3)
    expect(result.value.workflowCounts.data.executionLadder.SCHEDULED).toBe(2)
  })

  it('uses mutually exclusive count queries for review effective status aggregates', async () => {
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    await getMarketingExecutionSummary({ portal: portalStub('acct_a') })
    expect(prismaMock.marketingArtifactReview.count.mock.calls.length).toBeGreaterThanOrEqual(6)
    const firstCallWhere = prismaMock.marketingArtifactReview.count.mock.calls[0]?.[0]?.where
    expect(JSON.stringify(firstCallWhere)).toMatch(/REVOKED|revokedAt/)
  })

  it('returns UNAVAILABLE social readiness slice when Postiz assess throws', async () => {
    process.env.SOCIAL_EXECUTION_GATES_ENABLED = 'true'
    buildPostizMock.mockRejectedValue({ code: 'P2021', meta: { modelName: 'BusinessSocialConnection' } })
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_a') })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.socialProviderReadiness.status).toBe('UNAVAILABLE')
  })

  it('never implies dispatch authorization when live flags are on', async () => {
    process.env.SOCIAL_EXECUTION_GATES_ENABLED = 'true'
    process.env.POSTIZ_API_ENABLED = 'true'
    process.env.POSTIZ_LIVE_PUBLISHING_ENABLED = 'true'
    buildPostizMock.mockResolvedValue({
      ok: true,
      value: {
        customerAccountId: 'acct_a',
        assessedAt: '2026-11-08T00:00:00.000Z',
        moduleEnabled: true,
        postizApiEnabled: true,
        livePublishingEnabled: true,
        credentialsConfigured: true,
        workspaceConnected: true,
        channels: [
          {
            connectionId: 'ch_1',
            platform: 'linkedin',
            displayName: 'Co',
            connectionState: 'CONNECTED',
            externalChannelRef: 'secret-ref',
            dispatchAllowed: true,
          },
        ],
        dispatchBlockedCode: 'LIVE_DISPATCH_AUTHORIZED_AT_FLAG',
        dispatchBlockedMessage: 'flag on',
      },
    })
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    const result = await getMarketingExecutionSummary({ portal: portalStub('acct_a') })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.socialHandoffPolicy.status).toBe('AVAILABLE')
    if (result.value.socialHandoffPolicy.status === 'AVAILABLE') {
      expect(result.value.socialHandoffPolicy.data.dispatchBlocked).toBe(true)
    }
    if (result.value.socialProviderReadiness.status === 'AVAILABLE') {
      expect(result.value.socialProviderReadiness.data.dispatchBlockedCode).toBe('PREPARATION_ONLY_DISPATCH_BLOCKED')
      expect(result.value.socialProviderReadiness.data.livePublishingEnabled).toBe(true)
      expect(result.value.socialProviderReadiness.data.channels[0]?.dispatchAllowed).toBe(false)
    }
  })

  it('skips Postiz readiness when social gates are off even if module env is on', async () => {
    process.env.SOCIAL_EXECUTION_GATES_ENABLED = 'true'
    buildPostizMock.mockResolvedValue({
      ok: true,
      value: {
        customerAccountId: 'acct_a',
        assessedAt: '2026-11-08T00:00:00.000Z',
        moduleEnabled: true,
        postizApiEnabled: false,
        livePublishingEnabled: false,
        credentialsConfigured: false,
        workspaceConnected: false,
        channels: [],
        dispatchBlockedCode: 'LIVE_PUBLISHING_DISABLED',
        dispatchBlockedMessage: 'blocked',
      },
    })
    const { getMarketingExecutionSummary } = await import('@/lib/platform/marketing-execution/service')
    await getMarketingExecutionSummary({ portal: portalStub('acct_a') })
    expect(buildPostizMock).toHaveBeenCalledTimes(1)
  })
})
