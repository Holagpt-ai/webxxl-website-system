import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { marketingStudioEn } from '@/lib/i18n/dictionaries/marketing-studio-en'
import { marketingStudioEs } from '@/lib/i18n/dictionaries/marketing-studio-es'
import { classifyWorkspaceError } from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  parseAudienceSnapshot,
  type AudiencePreview,
} from '@/lib/marketing-studio-ui/types'

const syntheticPreview = (segmentId: string, evaluatedAt: string, segmentUpdatedAt: string): AudiencePreview => ({
  segmentId,
  segmentName: 'Newsletter VIP',
  segmentKind: 'DYNAMIC',
  segmentUpdatedAt,
  evaluatedAt,
  planningOnly: true,
  notSendAuthorization: true,
  accountContactCount: 500,
  audience: {
    totalMatchedContacts: 42,
    marketingConsentGrantedContacts: 30,
    revokedExpiredOrSuppressedContacts: 28,
    unknownMarketingConsentContacts: 10,
    missingUsableEmailContacts: 6,
  },
  disclosures: {
    synchronousEvaluationLimit: 5000,
    limitAppliesToActiveContactsInAccount: true,
    consentStatesArePointInTime: true,
    outboundExecutionRequiresFreshEvaluation: true,
  },
})

function time(iso: string): number {
  return new Date(iso).getTime()
}

/** Mirrors AudiencePlanningFlow evidence + stale guards. */
function planningEvidence(segmentId: string, preview: AudiencePreview | null, selectedUpdatedAt: string | null) {
  const evidence = preview && preview.segmentId === segmentId ? preview : null
  const stale = Boolean(
    evidence && selectedUpdatedAt && time(selectedUpdatedAt) > time(evidence.evaluatedAt),
  )
  return { evidence, stale }
}

describe('Batch 26B CRM audience planning UI integration', () => {
  it('uses Batch 25 marketing CRM segment list and preview endpoints', () => {
    expect(MKT_API.crmSegments).toBe('/api/v1/marketing/crm-segments')
    expect(MKT_API.audiencePreview('seg_abc')).toBe('/api/v1/marketing/crm-segments/seg_abc/audience-preview')
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('MKT_API.crmSegments')
    expect(flow).toContain('MKT_API.audiencePreview')
    expect(flow).not.toMatch(/\/api\/v1\/crm\/segments/)
  })

  it('keeps description-only request creation without crmSegmentId', () => {
    const source = readFileSync(join(process.cwd(), 'components/marketing-studio/requests.tsx'), 'utf8')
    expect(source).toContain("audience: audience.trim() || undefined")
    expect(source).not.toMatch(/crmSegmentId.*audience\.trim/)
    const manualBlock = source.slice(source.indexOf('workspaceSend(MKT_API.requests, {'))
    expect(manualBlock).toContain('seoOpportunityId: opportunityId')
    expect(manualBlock).not.toContain('crmSegmentId')
  })

  it('preserves SEO opportunity handoffs with fixed category and opportunity id', () => {
    const source = readFileSync(join(process.cwd(), 'components/marketing-studio/requests.tsx'), 'utf8')
    expect(source).toContain("useState<string>(opportunityId ? 'SEO_CONTENT_FIX'")
    expect(source).toContain('seoOpportunityId')
    expect(source).toContain('segmentCapable = category === \'CAMPAIGN_PREPARATION\' && !opportunityId')
  })

  it('shows overlapping audience buckets independently of the matched total', () => {
    const preview = syntheticPreview('seg_1', '2026-10-31T12:00:00.000Z', '2026-10-31T11:00:00.000Z')
    const { audience } = preview
    expect(audience.marketingConsentGrantedContacts + audience.revokedExpiredOrSuppressedContacts).toBeGreaterThan(
      audience.totalMatchedContacts,
    )
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('overlapNote')
    expect(flow).toContain('totalMatchedContacts')
    expect(flow).toContain('BUCKETS')
  })

  it('drops stale preview evidence when the selected segment changes', () => {
    const preview = syntheticPreview('seg_a', '2026-10-31T12:00:00.000Z', '2026-10-31T11:00:00.000Z')
    expect(planningEvidence('seg_b', preview, '2026-10-31T11:00:00.000Z').evidence).toBeNull()
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('preview.data.segmentId === segmentId')
    expect(flow).toContain('chooseSegment')
    expect(flow).toContain('preview.reset()')
  })

  it('blocks submit when segment edits post-date the preview evaluation', () => {
    const preview = syntheticPreview('seg_a', '2026-10-31T10:00:00.000Z', '2026-10-31T09:00:00.000Z')
    const { stale } = planningEvidence('seg_a', preview, '2026-10-31T11:00:00.000Z')
    expect(stale).toBe(true)
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('!stale')
    expect(flow).toContain('category: \'CAMPAIGN_PREPARATION\'')
    expect(flow).toContain('crmSegmentId: segmentId')
    expect(flow).toContain('idempotencyKey')
  })

  it('links successful CRM draft creation to the returned request id', () => {
    const requests = readFileSync(join(process.cwd(), 'components/marketing-studio/requests.tsx'), 'utf8')
    expect(requests).toContain('setCreated(requestId ?? true)')
    expect(requests).toContain('`${base}/requests/${created}`')
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('CampaignPreparationCreated')
    expect(flow).toContain('onCreated(result.data.requestId)')
  })

  it('parses stored audience snapshots and distinguishes fresh current checks on detail', () => {
    const stored = syntheticPreview('seg_1', '2026-10-31T10:00:00.000Z', '2026-10-31T09:00:00.000Z')
    expect(parseAudienceSnapshot(stored)).toEqual(stored)
    expect(parseAudienceSnapshot({ segmentId: 'x' })).toBeNull()
    const detail = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(detail).toContain('AudienceSnapshotSection')
    expect(detail).toContain('request.audienceEvaluatedAt')
    expect(detail).toContain('parseAudienceSnapshot(request.audiencePlanningSummary)')
    expect(detail).toContain('changedSince')
    expect(detail).toContain('snapshotCol')
    expect(detail).toContain('currentCol')
    const api = readFileSync(join(process.cwd(), 'app/api/v1/marketing/requests/[id]/route.ts'), 'utf8')
    expect(api).toContain('return NextResponse.json({ request: record })')
  })

  it('maps disabled, unauthorized, conflict, missing-segment and quota errors for UI copy', () => {
    expect(classifyWorkspaceError(403, { code: 'MKT_DISABLED' }).kind).toBe('DISABLED')
    expect(classifyWorkspaceError(401, { code: 'UNAUTHORIZED' }).kind).toBe('UNAUTHORIZED')
    expect(classifyWorkspaceError(404, { code: 'NOT_FOUND' }).kind).toBe('NOT_FOUND')
    expect(classifyWorkspaceError(429, { code: 'QUOTA_EXCEEDED' }).kind).toBe('QUOTA_EXCEEDED')
    expect(classifyWorkspaceError(409, { code: 'CONFLICT' }).status).toBe(409)
    const entitled = classifyWorkspaceError(403, { code: 'FREE_SOFTWARE_NOT_ELIGIBLE', message: 'Not included' })
    expect(entitled.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
    const flow = readFileSync(join(process.cwd(), 'components/marketing-studio/audience-planning.tsx'), 'utf8')
    expect(flow).toContain('FREE_SOFTWARE_NOT_ELIGIBLE')
    expect(flow).toContain('copy.flags.audiencePlanning')
    expect(flow).toContain('a.quota')
    expect(flow).toContain('a.segmentGone')
    expect(flow).toContain('isConflict')
  })

  it('keeps English and Spanish Marketing Studio audience copy keys aligned', () => {
    expect(Object.keys(marketingStudioEn.audience).sort()).toEqual(Object.keys(marketingStudioEs.audience).sort())
    expect(marketingStudioEn.flags.audiencePlanning).toBeTruthy()
    expect(marketingStudioEs.flags.audiencePlanning).toBeTruthy()
  })
})
