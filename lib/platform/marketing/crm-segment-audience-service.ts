import { CRM_SEGMENT_EVAL_MAX_CONTACTS } from '@/config/crm-backend'
import { prisma } from '@/lib/db'
import {
  contactHasUsableEmailIdentity,
  resolveSavedSegmentMatches,
} from '@/lib/platform/crm/segment-service'
import {
  resolveEffectiveMarketingConsent,
  type EffectiveMarketingConsentState,
} from '@/lib/platform/crm/segment-engine'
import type { MktResult } from '@/lib/platform/marketing/types'

export type CrmSegmentAudiencePlanningSummary = {
  totalMatchedContacts: number
  marketingConsentGrantedContacts: number
  revokedExpiredOrSuppressedContacts: number
  unknownMarketingConsentContacts: number
  missingUsableEmailContacts: number
}

export type CrmSegmentAudiencePreview = {
  segmentId: string
  segmentName: string
  segmentKind: string
  segmentUpdatedAt: string
  evaluatedAt: string
  planningOnly: true
  notSendAuthorization: true
  accountContactCount: number
  audience: CrmSegmentAudiencePlanningSummary
  disclosures: {
    synchronousEvaluationLimit: number
    limitAppliesToActiveContactsInAccount: true
    consentStatesArePointInTime: true
    outboundExecutionRequiresFreshEvaluation: true
  }
}

function classifyMatchedContact(view: {
  consents: Parameters<typeof resolveEffectiveMarketingConsent>[0]
  suppressions: Parameters<typeof resolveEffectiveMarketingConsent>[1]
}): EffectiveMarketingConsentState {
  return resolveEffectiveMarketingConsent(view.consents, view.suppressions)
}

export function summarizeCrmSegmentAudiencePlanning(input: {
  matchedViews: {
    id: string
    consents: Parameters<typeof resolveEffectiveMarketingConsent>[0]
    suppressions: Parameters<typeof resolveEffectiveMarketingConsent>[1]
  }[]
  contactRowsById: Map<string, { channelIdentities: { identityType: string; normalizedValue: string }[] }>
}): CrmSegmentAudiencePlanningSummary {
  let marketingConsentGrantedContacts = 0
  let revokedExpiredOrSuppressedContacts = 0
  let unknownMarketingConsentContacts = 0
  let missingUsableEmailContacts = 0

  for (const view of input.matchedViews) {
    const state = classifyMatchedContact(view)
    if (state === 'granted') marketingConsentGrantedContacts += 1
    if (state === 'revoked') revokedExpiredOrSuppressedContacts += 1
    if (state === 'unknown') unknownMarketingConsentContacts += 1
    const row = input.contactRowsById.get(view.id)
    if (!row || !contactHasUsableEmailIdentity(row)) missingUsableEmailContacts += 1
  }

  return {
    totalMatchedContacts: input.matchedViews.length,
    marketingConsentGrantedContacts,
    revokedExpiredOrSuppressedContacts,
    unknownMarketingConsentContacts,
    missingUsableEmailContacts,
  }
}

export async function listCrmSegmentsForAudiencePlanning(
  customerAccountId: string,
): Promise<
  MktResult<
    {
      id: string
      name: string
      kind: string
      updatedAt: string
      audiencePlanningEligible: boolean
    }[]
  >
> {
  const segments = await prisma.crmSegment.findMany({
    where: { customerAccountId },
    orderBy: { updatedAt: 'desc' },
  })
  return {
    ok: true,
    value: segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      kind: segment.kind,
      updatedAt: segment.updatedAt.toISOString(),
      audiencePlanningEligible:
        segment.kind === 'STATIC' || (segment.kind === 'DYNAMIC' && segment.filterDefinition != null),
    })),
  }
}

export async function previewCrmSegmentAudience(
  customerAccountId: string,
  segmentId: string,
  evaluatedAt: Date = new Date(),
): Promise<MktResult<CrmSegmentAudiencePreview>> {
  const resolved = await resolveSavedSegmentMatches(customerAccountId, segmentId)
  if (!resolved.ok) {
    if (resolved.code === 'QUOTA_EXCEEDED') {
      return { ok: false, code: 'QUOTA_EXCEEDED', message: resolved.message }
    }
    if (resolved.code === 'NOT_FOUND') {
      return { ok: false, code: 'NOT_FOUND', message: resolved.message }
    }
    return { ok: false, code: 'VALIDATION', message: resolved.message }
  }
  const { segment, matchedViews, contactRowsById, accountContactCount } = resolved.value
  const audience = summarizeCrmSegmentAudiencePlanning({ matchedViews, contactRowsById })
  return {
    ok: true,
    value: {
      segmentId: segment.id,
      segmentName: segment.name,
      segmentKind: segment.kind,
      segmentUpdatedAt: segment.updatedAt.toISOString(),
      evaluatedAt: evaluatedAt.toISOString(),
      planningOnly: true,
      notSendAuthorization: true,
      accountContactCount,
      audience,
      disclosures: {
        synchronousEvaluationLimit: CRM_SEGMENT_EVAL_MAX_CONTACTS,
        limitAppliesToActiveContactsInAccount: true,
        consentStatesArePointInTime: true,
        outboundExecutionRequiresFreshEvaluation: true,
      },
    },
  }
}
