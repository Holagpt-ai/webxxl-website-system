import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CRM_SEGMENT_EVAL_MAX_CONTACTS } from '@/config/crm-backend'
import {
  resolveEffectiveMarketingConsent,
  type SegmentContactView,
} from '@/lib/platform/crm/segment-engine'
import { contactHasUsableEmailIdentity } from '@/lib/platform/crm/segment-service'
import { summarizeCrmSegmentAudiencePlanning } from '@/lib/platform/marketing/crm-segment-audience-service'
import { buildCrmSegmentSourceRef, parseCrmSegmentSourceRef } from '@/lib/platform/marketing/crm-segment-source-ref'
import { computeMarketingRequestFingerprint } from '@/lib/platform/marketing/request-fingerprint'
import { denyBillingGroupSiblingMarketingAccess } from '@/lib/platform/marketing/account-isolation'

const segmentFindFirst = vi.hoisted(() => vi.fn())
const segmentFindMany = vi.hoisted(() => vi.fn())
const contactFindMany = vi.hoisted(() => vi.fn())
const contactCount = vi.hoisted(() => vi.fn())
const memberFindMany = vi.hoisted(() => vi.fn())
const requestFindFirst = vi.hoisted(() => vi.fn())
const requestCreate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    crmSegment: {
      findFirst: (...args: unknown[]) => segmentFindFirst(...args),
      findMany: (...args: unknown[]) => segmentFindMany(...args),
    },
    crmContact: {
      findMany: (...args: unknown[]) => contactFindMany(...args),
      count: (...args: unknown[]) => contactCount(...args),
    },
    crmSegmentMember: {
      findMany: (...args: unknown[]) => memberFindMany(...args),
    },
    marketingRequest: {
      findFirst: (...args: unknown[]) => requestFindFirst(...args),
      create: (...args: unknown[]) => requestCreate(...args),
    },
  },
}))

vi.mock('@/config/mkt-backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/mkt-backend')>()
  return {
    ...actual,
    isMktDraftPreparationEnabled: () => true,
    isMktCrmAudiencePlanningEnabled: () => true,
  }
})

function baseView(overrides: Partial<SegmentContactView> = {}): SegmentContactView {
  return {
    id: 'c1',
    customerAccountId: 'acct-a',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    tagLabels: [],
    consents: [],
    suppressions: [],
    ...overrides,
  }
}

describe('Batch 25 CRM → Marketing audience planning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactCount.mockResolvedValue(2)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('summarizes granted, revoked, unknown and missing email independently', () => {
    const now = new Date('2026-08-01T00:00:00Z')
    const marketing = { channel: 'EMAIL' as const, purpose: 'MARKETING' as const }
    const views = [
      baseView({
        id: 'granted',
        consents: [{ ...marketing, status: 'GRANTED', capturedAt: now }],
      }),
      baseView({
        id: 'revoked',
        consents: [
          { ...marketing, status: 'GRANTED', capturedAt: new Date('2026-01-01T00:00:00Z') },
          { ...marketing, status: 'REVOKED', capturedAt: now },
        ],
      }),
      baseView({
        id: 'unknown',
        consents: [{ ...marketing, status: 'UNKNOWN', capturedAt: now }],
      }),
      baseView({ id: 'no-email', consents: [{ ...marketing, status: 'GRANTED', capturedAt: now }] }),
    ]
    const rows = new Map([
      ['granted', { channelIdentities: [{ identityType: 'EMAIL', normalizedValue: 'a@example.com' }] }],
      ['revoked', { channelIdentities: [{ identityType: 'EMAIL', normalizedValue: 'b@example.com' }] }],
      ['unknown', { channelIdentities: [{ identityType: 'EMAIL', normalizedValue: 'c@example.com' }] }],
      ['no-email', { channelIdentities: [] }],
    ])
    const summary = summarizeCrmSegmentAudiencePlanning({ matchedViews: views, contactRowsById: rows })
    expect(summary.totalMatchedContacts).toBe(4)
    expect(summary.marketingConsentGrantedContacts).toBe(2)
    expect(summary.revokedExpiredOrSuppressedContacts).toBe(1)
    expect(summary.unknownMarketingConsentContacts).toBe(1)
    expect(summary.missingUsableEmailContacts).toBe(1)
    expect(resolveEffectiveMarketingConsent([], [], 'EMAIL', 'MARKETING', now)).toBe('unknown')
  })

  it('transactional consent does not grant email marketing eligibility', () => {
    const now = new Date('2026-08-01T00:00:00Z')
    expect(
      resolveEffectiveMarketingConsent(
        [
          {
            channel: 'EMAIL',
            purpose: 'TRANSACTIONAL',
            status: 'GRANTED',
            capturedAt: now,
          },
        ],
        [],
        'EMAIL',
        'MARKETING',
        now,
      ),
    ).toBe('unknown')
  })

  it('uses canonical CRM segment source refs and fingerprint segment linkage', () => {
    const ref = buildCrmSegmentSourceRef('seg_123')
    expect(parseCrmSegmentSourceRef(ref)).toBe('seg_123')
    expect(parseCrmSegmentSourceRef('seo:1')).toBeNull()
    const fpWith = computeMarketingRequestFingerprint({
      customerAccountId: 'acct',
      category: 'CAMPAIGN_PREPARATION',
      goal: 'Grow',
      brief: 'Brief',
      locale: 'en',
      sourceRefs: [ref],
      crmSegmentId: 'seg_123',
      assignedWorkflow: 'mkt-08-default',
    })
    const fpWithout = computeMarketingRequestFingerprint({
      customerAccountId: 'acct',
      category: 'CAMPAIGN_PREPARATION',
      goal: 'Grow',
      brief: 'Brief',
      locale: 'en',
      sourceRefs: [ref],
      crmSegmentId: null,
      assignedWorkflow: 'mkt-08-default',
    })
    expect(fpWith).not.toBe(fpWithout)
  })

  it('denies billing-group sibling marketing access (account isolation)', () => {
    const siblings = new Map([['bg1', ['acct-a', 'acct-b']]])
    expect(
      denyBillingGroupSiblingMarketingAccess({
        operatingAccountId: 'acct-a',
        recordAccountId: 'acct-b',
        billingGroupSiblingAccounts: siblings,
      }).ok,
    ).toBe(false)
  })

  it('contactHasUsableEmailIdentity requires EMAIL channel identity', () => {
    expect(
      contactHasUsableEmailIdentity({
        channelIdentities: [{ identityType: 'EMAIL', normalizedValue: 'user@example.com' }],
      }),
    ).toBe(true)
    expect(
      contactHasUsableEmailIdentity({
        channelIdentities: [{ identityType: 'PHONE', normalizedValue: '+15551212' }],
      }),
    ).toBe(false)
  })

  it('preview returns QUOTA_EXCEEDED when active contacts exceed synchronous limit', async () => {
    contactCount.mockResolvedValue(CRM_SEGMENT_EVAL_MAX_CONTACTS + 1)
    segmentFindFirst.mockResolvedValue({
      id: 'seg_1',
      name: 'VIP',
      kind: 'DYNAMIC',
      filterDefinition: { logic: 'AND', rules: [{ field: 'consentEligible', operator: 'eq', value: true }] },
      updatedAt: new Date(),
    })
    const { previewCrmSegmentAudience } = await import('@/lib/platform/marketing/crm-segment-audience-service')
    const result = await previewCrmSegmentAudience('acct-a', 'seg_1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('QUOTA_EXCEEDED')
  })

  it('preview denies cross-account segment references', async () => {
    segmentFindFirst.mockResolvedValue(null)
    const { previewCrmSegmentAudience } = await import('@/lib/platform/marketing/crm-segment-audience-service')
    const result = await previewCrmSegmentAudience('acct-a', 'seg_other')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })
})
