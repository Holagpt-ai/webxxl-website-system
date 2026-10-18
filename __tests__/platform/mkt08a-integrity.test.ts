import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { computeMarketingRequestFingerprint } from '@/lib/platform/marketing/request-fingerprint'
import {
  coverageFromEvidence,
  deriveFollowUpEvidenceFromTimeline,
} from '@/lib/platform/marketing/follow-up-coverage-evidence'
import { resolveBrandDraftTrust, isBrandContextComplianceApproved } from '@/lib/platform/marketing/brand-trust'
import { denyBillingGroupSiblingMarketingAccess } from '@/lib/platform/marketing/account-isolation'
import { validateReviewForRevision, MKT_APPROVAL_POLICY_VERSION } from '@/lib/platform/marketing/approval-service'
import { assertMarketingStatusTransition } from '@/lib/platform/marketing/transitions'
import { clampFollowUpEvalLimit, validateMarketingRequestPayload } from '@/lib/platform/marketing/request-validation'

const membershipFindUnique = vi.hoisted(() => vi.fn())
const evaluationFindFirst = vi.hoisted(() => vi.fn())
const contactFindFirst = vi.hoisted(() => vi.fn())
const intentFindUnique = vi.hoisted(() => vi.fn())
const intentFindFirst = vi.hoisted(() => vi.fn())
const transaction = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    customerMembership: { findUnique: (...args: unknown[]) => membershipFindUnique(...args) },
    marketingLeadFollowUpEvaluation: { findFirst: (...args: unknown[]) => evaluationFindFirst(...args) },
    crmContact: { findFirst: (...args: unknown[]) => contactFindFirst(...args) },
    marketingFollowUpTaskIntent: {
      findUnique: (...args: unknown[]) => intentFindUnique(...args),
      findFirst: (...args: unknown[]) => intentFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}))

describe('MKT-08A integrity (pure logic)', () => {
  it('D: pending callback task is not qualifying outreach', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'NONE',
      completedCallbackTask: false,
      pendingCallbackTask: true,
    })
    expect(evidence.hasQualifyingOutreach).toBe(false)
    expect(evidence.evidenceRefs.some((r) => r.includes('pending_callback'))).toBe(true)
  })

  it('E: missing provider coverage stays UNKNOWN_COVERAGE', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'NONE',
      completedCallbackTask: false,
      pendingCallbackTask: false,
    })
    expect(evidence.providerCoverageMissing).toBe(true)
    const coverage = coverageFromEvidence({
      evidence,
      dueAt: new Date(Date.now() - 86400000),
    })
    expect(coverage).toBe('UNKNOWN_COVERAGE')
  })

  it('F: SMS_DELIVERED counts as confirmed outreach', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [
        {
          id: 'e1',
          eventKind: 'SMS_DELIVERED',
          eventAt: new Date('2026-10-01T12:00:00Z'),
          sourceSystem: 'native.crm',
        },
      ],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'GRANTED',
      completedCallbackTask: false,
      pendingCallbackTask: false,
    })
    expect(evidence.hasQualifyingOutreach).toBe(true)
    expect(evidence.hasQualifyingOutreach).toBe(true)
  })

  it('G: completed callback task classifies COMPLETED', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'GRANTED',
      completedCallbackTask: true,
      pendingCallbackTask: false,
    })
    const coverage = coverageFromEvidence({ evidence, dueAt: new Date() })
    expect(coverage).toBe('COMPLETED')
  })

  it('H: inactive suppression flag does not mark active suppression', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'NONE',
      completedCallbackTask: false,
      pendingCallbackTask: false,
    })
    expect(evidence.hasActiveSuppression).toBe(false)
  })

  it('L: request fingerprint changes when brief changes', () => {
    const base = {
      customerAccountId: 'acct-a',
      managedSiteId: 'site-1',
      category: 'LANDING_PAGE' as const,
      goal: 'Leads',
      brief: 'Original brief',
      locale: 'en',
      audience: null,
      sourceRefs: ['seo:1'],
      seoOpportunityId: null,
      assignedWorkflow: 'mkt-08-default',
    }
    const h1 = computeMarketingRequestFingerprint(base)
    const h2 = computeMarketingRequestFingerprint({ ...base, brief: 'Changed brief' })
    expect(h1).not.toBe(h2)
  })

  it('P: pending healthcare brand claims not treated as approved', () => {
    const trust = resolveBrandDraftTrust({
      id: 'b1',
      customerAccountId: 'a1',
      managedSiteId: null,
      versionNumber: 1,
      businessName: 'Clinic',
      approvedServices: ['Trials'],
      operatingGeography: null,
      businessCategory: 'healthcare',
      audience: null,
      locale: 'en',
      brandTone: null,
      approvedClaims: ['FDA approved cure'],
      excludedTopics: null,
      brandAssetRefs: null,
      approvedCtaDestinations: null,
      complianceReviewState: 'REQUIRES_REVIEW',
      sourceProvenance: 'owner_submitted',
      createdByUserId: null,
      createdAt: new Date(),
    })
    expect(trust.ok).toBe(true)
    if (trust.ok) {
      expect(isBrandContextComplianceApproved({ complianceReviewState: 'REQUIRES_REVIEW' })).toBe(false)
      expect(trust.value.approvedClaims).toEqual([])
      expect(trust.value.requiresHumanReview).toBe(true)
    }
  })

  it('Q: ABMED sibling isolation preserved', () => {
    const siblings = new Map([[ABMED_AESTHETICS_ACCOUNT_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]])
    expect(
      denyBillingGroupSiblingMarketingAccess({
        operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
        billingGroupSiblingAccounts: siblings,
      }).ok,
    ).toBe(false)
  })

  it('O: invalid FSM transition to COMPLETED blocked', () => {
    expect(assertMarketingStatusTransition('SUBMITTED', 'COMPLETED').ok).toBe(false)
  })

  it('validation bounds follow-up limit', () => {
    expect(clampFollowUpEvalLimit(9999)).toBe(100)
    expect(validateMarketingRequestPayload({
      category: 'NOT_REAL',
      goal: 'x',
      brief: 'y',
      locale: 'en',
      idempotencyKey: 'k',
    }).ok).toBe(false)
  })

  it('J/K: approval policy binding', () => {
    expect(MKT_APPROVAL_POLICY_VERSION).toBe('mkt-08-v1')
    expect(validateReviewForRevision({ approvedRevisionHash: 'a', requestedRevisionHash: 'b' }).ok).toBe(false)
  })
})

describe('MKT-08A follow-up task authorization (mocked Prisma — not PostgreSQL concurrency)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('A: foreign staff assignment rejected', async () => {
    evaluationFindFirst.mockResolvedValue({
      id: 'eval-1',
      customerAccountId: 'acct-a',
      crmContactId: 'contact-1',
    })
    contactFindFirst.mockResolvedValue({ id: 'contact-1', customerAccountId: 'acct-a' })
    membershipFindUnique.mockResolvedValue(null)
    const { prepareFollowUpCallbackTask } = await import('@/lib/platform/marketing/follow-up-task-service')
    const result = await prepareFollowUpCallbackTask({
      customerAccountId: 'acct-a',
      evaluationId: 'eval-1',
      contactId: 'contact-1',
      assignedUserId: 'foreign-user',
      idempotencyKey: 'idem-1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FORBIDDEN')
  })

  it('B: foreign idempotency replay protected', async () => {
    evaluationFindFirst.mockResolvedValue({
      id: 'eval-1',
      customerAccountId: 'acct-a',
      crmContactId: 'contact-1',
    })
    contactFindFirst.mockResolvedValue({ id: 'contact-1', customerAccountId: 'acct-a' })
    membershipFindUnique.mockResolvedValue({ userId: 'staff-1', customerAccountId: 'acct-a' })
    intentFindUnique.mockResolvedValue({
      id: 'intent-1',
      customerAccountId: 'acct-b',
      crmContactId: 'contact-1',
      evaluationId: 'eval-1',
      intentFingerprint: 'fp',
      idempotencyKey: 'idem-shared',
      crmTaskId: 'task-1',
    })
    const { prepareFollowUpCallbackTask } = await import('@/lib/platform/marketing/follow-up-task-service')
    const result = await prepareFollowUpCallbackTask({
      customerAccountId: 'acct-a',
      evaluationId: 'eval-1',
      contactId: 'contact-1',
      assignedUserId: 'staff-1',
      idempotencyKey: 'idem-shared',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })
})
