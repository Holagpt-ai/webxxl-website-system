import type { CrmSegmentAudiencePreview } from '@/lib/platform/marketing/crm-segment-audience-service'
import type { MktResult } from '@/lib/platform/marketing/types'

export function parseStoredAudiencePlanningPreview(stored: unknown): CrmSegmentAudiencePreview | null {
  if (!stored || typeof stored !== 'object') return null
  const candidate = stored as Partial<CrmSegmentAudiencePreview>
  if (typeof candidate.segmentId !== 'string') return null
  if (typeof candidate.evaluatedAt !== 'string') return null
  if (candidate.planningOnly !== true || candidate.notSendAuthorization !== true) return null
  if (!candidate.audience || typeof candidate.audience !== 'object') return null
  return candidate as CrmSegmentAudiencePreview
}

export function idempotentCampaignPreparationResponse(input: {
  existing: {
    id: string
    status: string
    crmSegmentId: string | null
    audiencePlanningSummary: unknown
  }
  crmSegmentId: string
}): MktResult<{
  requestId: string
  status: string
  crmSegmentId: string
  audiencePreview: CrmSegmentAudiencePreview
}> {
  const audiencePreview = parseStoredAudiencePlanningPreview(input.existing.audiencePlanningSummary)
  if (!audiencePreview) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Idempotent replay requires a stored audience planning snapshot',
    }
  }
  return {
    ok: true,
    value: {
      requestId: input.existing.id,
      status: input.existing.status,
      crmSegmentId: input.existing.crmSegmentId ?? input.crmSegmentId,
      audiencePreview,
    },
  }
}
