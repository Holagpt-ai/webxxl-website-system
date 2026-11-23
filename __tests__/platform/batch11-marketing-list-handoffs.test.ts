import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listMarketingArtifacts } from '@/lib/platform/marketing/artifact-list-service'
import { listMarketingReviews } from '@/lib/platform/marketing/review-list-service'
import {
  MARKETING_STUDIO_WORKSPACES,
  marketingArtifactListDestination,
  marketingReviewListDestination,
} from '@/lib/platform/marketing/list-handoffs'
import { validateMarketingListScope } from '@/lib/platform/marketing/mkt-list-scope'

const prisma = vi.hoisted(() => ({
  managedSite: { findFirst: vi.fn() },
  marketingRequest: { findFirst: vi.fn() },
  marketingArtifact: { findFirst: vi.fn(), findMany: vi.fn() },
  marketingArtifactReview: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma }))

describe('Batch 11 marketing list handoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes locale-neutral dashboard destinations for artifacts and reviews', () => {
    const art = marketingArtifactListDestination('art_1')
    expect(art.path).toBe('/dashboard/marketing/deliverables/art_1')
    const rev = marketingReviewListDestination('rv_1', 'art_1')
    expect(rev.path).toBe('/dashboard/marketing/deliverables/art_1?reviewId=rv_1')
    expect(MARKETING_STUDIO_WORKSPACES.deliverables).toBe('/dashboard/marketing/deliverables')
  })

  it('rejects sibling-account filters before listing', async () => {
    prisma.managedSite.findFirst.mockResolvedValueOnce(null)
    const scoped = await validateMarketingListScope({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_other',
    })
    expect(scoped.ok).toBe(false)
    if (!scoped.ok) expect(scoped.code).toBe('VALIDATION')
  })

  it('attaches per-row destinations on account-wide artifact list', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z')
    prisma.marketingArtifact.findMany.mockResolvedValueOnce([
      {
        id: 'art_a',
        customerAccountId: 'acct_a',
        managedSiteId: null,
        marketingRequestId: 'req_1',
        artifactType: 'LANDING_PAGE',
        revisionHash: 'abcd1234',
        generationMode: 'DETERMINISTIC_DRAFT',
        reviewStatus: 'DRAFT',
        locale: 'en',
        safetyClass: 'GENERAL_BUSINESS',
        createdAt,
      },
    ])
    const listed = await listMarketingArtifacts({ customerAccountId: 'acct_a' })
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value.artifacts[0]?.destination.path).toBe(
        marketingArtifactListDestination('art_a').path,
      )
    }
  })

  it('attaches per-row destinations on account-wide review list', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z')
    prisma.marketingArtifactReview.findMany.mockResolvedValueOnce([
      {
        id: 'rv_a',
        customerAccountId: 'acct_a',
        managedSiteId: null,
        marketingRequestId: 'req_1',
        marketingArtifactId: 'art_a',
        revisionHash: 'abcd1234',
        intendedAction: 'PUBLISH_SOCIAL',
        allowedChannel: null,
        allowedTarget: null,
        status: 'SUBMITTED',
        approverUserId: null,
        policyVersion: 'mkt-08-v1',
        expiresAt: new Date('2026-12-01T00:00:00.000Z'),
        decidedAt: null,
        revokedAt: null,
        createdAt,
      },
    ])
    const listed = await listMarketingReviews({
      customerAccountId: 'acct_a',
      viewerCanDecide: true,
      approvalWorkflowEnabled: true,
    })
    expect(listed.ok).toBe(true)
    if (listed.ok) {
      expect(listed.value.reviews[0]?.destination.path).toBe(
        marketingReviewListDestination('rv_a', 'art_a').path,
      )
    }
  })

  it('returns navigation workspaces from list HTTP routes', () => {
    const artifacts = readFileSync(join(process.cwd(), 'app/api/v1/marketing/artifacts/route.ts'), 'utf8')
    const reviews = readFileSync(join(process.cwd(), 'app/api/v1/marketing/reviews/route.ts'), 'utf8')
    expect(artifacts).toContain('MARKETING_STUDIO_WORKSPACES')
    expect(artifacts).toContain('navigation: MARKETING_STUDIO_WORKSPACES')
    expect(reviews).toContain('navigation: MARKETING_STUDIO_WORKSPACES')
  })

  it('wires marketing list APIs into dashboard-context handoffs', () => {
    const handoffs = readFileSync(
      join(process.cwd(), 'lib/platform/customer-dashboard/module-handoffs.ts'),
      'utf8',
    )
    expect(handoffs).toContain('/api/v1/marketing/artifacts')
    expect(handoffs).toContain('/api/v1/marketing/reviews')
    const context = readFileSync(
      join(process.cwd(), 'lib/platform/customer-dashboard/context-service.ts'),
      'utf8',
    )
    expect(context).toContain('marketingWorkspaces')
  })
})