import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import {
  isMktAiGenerationEnabled,
  isMktApprovalWorkflowEnabled,
  isMktAutomatedExecutionEnabled,
  isMktBackendEnabled,
  isMktDraftPreparationEnabled,
  isMktExternalHandoffEnabled,
  isMktLeadMonitorEnabled,
} from '@/config/mkt-backend'
import { isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import { isPostizLivePublishingEnabled, isSocialMarketingEnabled } from '@/config/social-marketing'
import { computeMarketingArtifactRevisionHash } from '@/lib/platform/marketing/artifact-hash'
import { assertMarketingContentAllowed } from '@/lib/platform/marketing/content-safety'
import { generateDeterministicAdCreative, generateDeterministicLandingPage } from '@/lib/platform/marketing/creative-generator'
import { denyBillingGroupSiblingMarketingAccess } from '@/lib/platform/marketing/account-isolation'
import { assertMarketingStatusTransition } from '@/lib/platform/marketing/transitions'
import { decideMarketingArtifactReview, validateReviewForRevision } from '@/lib/platform/marketing/approval-service'
import { prepareSocialHandoffFromApprovedCreative } from '@/lib/platform/marketing/social-handoff-service'
import { buildLandingPageManagedSiteChangeHandoff } from '@/lib/platform/marketing/site-change-handoff-service'
import { classifyFollowUpCoverage } from '@/lib/platform/crm/follow-up-service'
import { getAiTool } from '@/lib/platform/ai-tools/registry'

describe('MKT-08 foundation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('AD: all MKT execution flags default OFF', () => {
    expect(isMktBackendEnabled()).toBe(false)
    expect(isMktDraftPreparationEnabled()).toBe(false)
    expect(isMktApprovalWorkflowEnabled()).toBe(false)
    expect(isMktLeadMonitorEnabled()).toBe(false)
    expect(isMktAiGenerationEnabled()).toBe(false)
    expect(isMktExternalHandoffEnabled()).toBe(false)
    expect(isMktAutomatedExecutionEnabled()).toBe(false)
    expect(isSocialMarketingEnabled()).toBe(false)
    expect(isPostizLivePublishingEnabled()).toBe(false)
    expect(isCommunicationsOutboundEnabled()).toBe(false)
  })

  it('AA: ABMED sibling billing group does not grant marketing access', () => {
    const siblings = new Map<string, string[]>([[ABMED_AESTHETICS_ACCOUNT_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]])
    const denied = denyBillingGroupSiblingMarketingAccess({
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      billingGroupSiblingAccounts: siblings,
    })
    expect(denied.ok).toBe(false)
  })

  it('I: immutable revision hash changes when CTA changes', () => {
    const base = {
      customerAccountId: 'acct1',
      managedSiteId: 'site1',
      marketingRequestId: 'req1',
      artifactType: 'LANDING_PAGE',
      locale: 'en',
      structuredContent: { cta: 'Contact us' },
      complianceVersion: 'mkt-08-v1',
      generationPolicyVersion: 'mkt-08-v1',
    }
    const h1 = computeMarketingArtifactRevisionHash(base)
    const h2 = computeMarketingArtifactRevisionHash({
      ...base,
      structuredContent: { cta: 'Book now' },
    })
    expect(h1).not.toBe(h2)
  })

  it('J: approval for revision 1 cannot authorize revision 2', () => {
    const v = validateReviewForRevision({ approvedRevisionHash: 'hash-v1', requestedRevisionHash: 'hash-v2' })
    expect(v.ok).toBe(false)
  })

  it('N: agent self-approval rejected', async () => {
    const result = await decideMarketingArtifactReview({
      customerAccountId: 'acct1',
      reviewerUserId: 'agent1',
      reviewId: 'rev1',
      decision: 'APPROVED',
      actorType: 'AGENT',
    })
    expect(result.ok).toBe(false)
  })

  it('O: social handoff cannot schedule Postiz when flags off', () => {
    const handoff = prepareSocialHandoffFromApprovedCreative({ revisionHash: 'abc', approved: true })
    expect(handoff.ok).toBe(true)
    if (handoff.ok) expect(handoff.value.schedulingAllowed).toBe(false)
  })

  it('P: ad draft blocks paid execution claims', () => {
    const ad = generateDeterministicAdCreative({ objective: 'Leads', locale: 'en', businessName: 'Demo Co' })
    expect(ad.ok).toBe(true)
    if (ad.ok) expect(ad.value.content.paidExecution).toBe('BLOCKED')
    const denied = assertMarketingContentAllowed({ text: 'launch campaign on meta ads api' })
    expect(denied.ok).toBe(false)
  })

  it('Q: new marketing agent tools default disabled (not live AI)', () => {
    expect(getAiTool('marketing.artifact.prepare')?.enabled).toBe(false)
    expect(getAiTool('marketing.createDraft')?.enabled).toBe(true)
  })

  it('R/S/T: CRM follow-up coverage classifications', () => {
    const overdue = classifyFollowUpCoverage({
      hasQualifyingOutreach: true,
      providerCoverageMissing: false,
      awaitingReply: false,
      dueAt: new Date(Date.now() - 86400000),
      completed: false,
    })
    expect(overdue).toBe('OVERDUE')
    const noOutreach = classifyFollowUpCoverage({
      hasQualifyingOutreach: false,
      providerCoverageMissing: false,
      awaitingReply: false,
      dueAt: new Date(Date.now() - 86400000),
      completed: false,
    })
    expect(noOutreach).toBe('CONFIRMED_NO_OUTREACH')
    const unknown = classifyFollowUpCoverage({
      hasQualifyingOutreach: false,
      providerCoverageMissing: true,
      awaitingReply: false,
      dueAt: new Date(Date.now() - 86400000),
      completed: false,
    })
    expect(unknown).toBe('UNKNOWN_COVERAGE')
    const completed = classifyFollowUpCoverage({
      hasQualifyingOutreach: true,
      providerCoverageMissing: false,
      awaitingReply: false,
      dueAt: new Date(),
      completed: true,
    })
    expect(completed).toBe('COMPLETED')
  })

  it('AB: healthcare unsafe clinical claims blocked', () => {
    const blocked = assertMarketingContentAllowed({ text: 'We cure diabetes with guaranteed results' })
    expect(blocked.ok).toBe(false)
    const phi = assertMarketingContentAllowed({ text: 'patient MRN 12345' })
    expect(phi.ok).toBe(false)
  })

  it('H + A: landing page draft includes evidence refs (deterministic)', () => {
    const draft = generateDeterministicLandingPage({
      goal: 'Improve service page',
      locale: 'en',
      businessName: 'ABMED Aesthetics',
      approvedServices: ['Medical aesthetics'],
      evidenceRefs: ['seo:opportunity:opp-1'],
    })
    expect(draft.ok).toBe(true)
    if (draft.ok) {
      expect(draft.value.generationMode).toBe('DETERMINISTIC_DRAFT')
      expect(draft.value.content.evidenceRefs).toContain('seo:opportunity:opp-1')
    }
    const handoff = buildLandingPageManagedSiteChangeHandoff({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-aesthetics',
      marketingRequestId: 'req-1',
      artifactRevisionHash: 'hash1',
      structuredContent: { title: 'Test' },
    })
    expect(handoff.ok).toBe(true)
    if (handoff.ok) expect(handoff.value.payload.publishAuthorized).toBe(false)
  })

  it('D/E: request lifecycle blocks invalid COMPLETED transition', () => {
    expect(assertMarketingStatusTransition('SUBMITTED', 'COMPLETED').ok).toBe(false)
    expect(assertMarketingStatusTransition('HANDED_OFF', 'COMPLETED').ok).toBe(true)
  })
})

const marketingRequestFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/managed-sites/queries', () => ({
  getManagedSiteForAccount: vi.fn(async (siteId: string, accountId: string) =>
    siteId === 'site-ok' ? { id: siteId, customerAccountId: accountId } : null,
  ),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
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

describe('MKT-08 durable services (mocked Prisma)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('B: foreign managed site rejected on create', async () => {
    vi.stubEnv('MKT_DRAFT_PREPARATION_ENABLED', 'true')
    const { createMarketingRequestRecord } = await import('@/lib/platform/marketing/request-service')
    const result = await createMarketingRequestRecord({
      customerAccountId: 'acct-a',
      userId: 'user-1',
      managedSiteId: 'site-wrong',
      category: 'LANDING_PAGE',
      goal: 'Leads',
      brief: 'Brief',
      locale: 'en',
      idempotencyKey: 'idem-1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FORBIDDEN')
  })

  it('E: idempotency key conflict on changed fingerprint', async () => {
    vi.stubEnv('MKT_DRAFT_PREPARATION_ENABLED', 'true')
    marketingRequestFindFirst.mockResolvedValueOnce({
      id: 'req-existing',
      customerAccountId: 'acct-a',
      requestFingerprint: 'LANDING_PAGE:en:site-ok:Other goal',
      status: 'SUBMITTED',
    })
    const { createMarketingRequestRecord } = await import('@/lib/platform/marketing/request-service')
    const result = await createMarketingRequestRecord({
      customerAccountId: 'acct-a',
      userId: 'user-1',
      managedSiteId: 'site-ok',
      category: 'LANDING_PAGE',
      goal: 'Leads',
      brief: 'Brief',
      locale: 'en',
      idempotencyKey: 'idem-same',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })
})
