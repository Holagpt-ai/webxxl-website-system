import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  idempotentCampaignPreparationResponse,
  parseStoredAudiencePlanningPreview,
} from '@/lib/platform/marketing/crm-audience-idempotency'
import { computeMarketingRequestFingerprint } from '@/lib/platform/marketing/request-fingerprint'
import { buildCrmSegmentSourceRef } from '@/lib/platform/marketing/crm-segment-source-ref'
import type { CrmSegmentAudiencePreview } from '@/lib/platform/marketing/crm-segment-audience-service'

const storedPreview: CrmSegmentAudiencePreview = {
  segmentId: 'seg_1',
  segmentName: 'VIP',
  segmentKind: 'DYNAMIC',
  segmentUpdatedAt: '2026-10-01T00:00:00.000Z',
  evaluatedAt: '2026-10-31T10:00:00.000Z',
  planningOnly: true,
  notSendAuthorization: true,
  accountContactCount: 100,
  audience: {
    totalMatchedContacts: 10,
    marketingConsentGrantedContacts: 5,
    revokedExpiredOrSuppressedContacts: 2,
    unknownMarketingConsentContacts: 2,
    missingUsableEmailContacts: 1,
  },
  disclosures: {
    synchronousEvaluationLimit: 5000,
    limitAppliesToActiveContactsInAccount: true,
    consentStatesArePointInTime: true,
    outboundExecutionRequiresFreshEvaluation: true,
  },
}

describe('Batch 25.1 audience planning integrity', () => {
  it('requires both core.crm and core.marketing-studio entitlement keys in route auth', () => {
    const gateSource = readFileSync(join(process.cwd(), 'lib/platform/open001/module-api-gate.ts'), 'utf8')
    expect(gateSource).toContain("'core.crm'")
    expect(gateSource).toContain("'core.marketing-studio'")
    expect(gateSource).toContain('CRM_AUDIENCE_PLANNING_INCLUDED_FREE_ENTITLEMENT_KEYS')
    const source = readFileSync(join(process.cwd(), 'lib/platform/marketing/crm-audience-route-auth.ts'), 'utf8')
    expect(source).toContain('requireIncludedFreeSoftwareMembershipKeys')
    expect(source).toContain('CRM_AUDIENCE_PLANNING_INCLUDED_FREE_ENTITLEMENT_KEYS')
    expect(source).not.toContain("requireIncludedFreeSoftwareMembership('core.marketing-studio'")
  })

  it('parses stored audience planning snapshots for idempotent replay', () => {
    expect(parseStoredAudiencePlanningPreview(storedPreview)).toEqual(storedPreview)
    expect(parseStoredAudiencePlanningPreview({ segmentId: 'x' })).toBeNull()
  })

  it('returns stored snapshot on idempotent replay when segment row is gone', () => {
    const replay = idempotentCampaignPreparationResponse({
      existing: {
        id: 'req_existing',
        status: 'DRAFT',
        crmSegmentId: 'seg_deleted',
        audiencePlanningSummary: storedPreview,
      },
      crmSegmentId: 'seg_1',
    })
    expect(replay.ok).toBe(true)
    if (replay.ok) {
      expect(replay.value.audiencePreview.evaluatedAt).toBe('2026-10-31T10:00:00.000Z')
      expect(replay.value.crmSegmentId).toBe('seg_deleted')
    }
  })

  it('rejects idempotent replay when stored snapshot is missing', () => {
    const replay = idempotentCampaignPreparationResponse({
      existing: {
        id: 'req_existing',
        status: 'DRAFT',
        crmSegmentId: 'seg_1',
        audiencePlanningSummary: null,
      },
      crmSegmentId: 'seg_1',
    })
    expect(replay.ok).toBe(false)
    if (!replay.ok) expect(replay.code).toBe('CONFLICT')
  })

  it('includes crmSegmentId in request fingerprint for conflict detection', () => {
    const ref = buildCrmSegmentSourceRef('seg_1')
    const withSegment = computeMarketingRequestFingerprint({
      customerAccountId: 'acct-a',
      category: 'CAMPAIGN_PREPARATION',
      goal: 'Grow',
      brief: 'Brief',
      locale: 'en',
      sourceRefs: [ref],
      crmSegmentId: 'seg_1',
      assignedWorkflow: 'mkt-08-default',
    })
    const otherSegment = computeMarketingRequestFingerprint({
      customerAccountId: 'acct-a',
      category: 'CAMPAIGN_PREPARATION',
      goal: 'Grow',
      brief: 'Brief',
      locale: 'en',
      sourceRefs: [buildCrmSegmentSourceRef('seg_2')],
      crmSegmentId: 'seg_2',
      assignedWorkflow: 'mkt-08-default',
    })
    expect(withSegment).not.toBe(otherSegment)
  })

  it('resolves idempotency before live preview in request service source order', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/platform/marketing/crm-audience-request-service.ts'),
      'utf8',
    )
    const idempotencyBlock = source.indexOf('existingGlobal = await prisma.marketingRequest.findFirst')
    const previewCall = source.indexOf('previewCrmSegmentAudience(')
    expect(idempotencyBlock).toBeGreaterThan(-1)
    expect(previewCall).toBeGreaterThan(-1)
    expect(idempotencyBlock).toBeLessThan(previewCall)
    expect(source).toContain('idempotentCampaignPreparationResponse')
    expect(source).not.toMatch(/audiencePreview: preview\.value[\s\S]*existingGlobal/)
  })
})
