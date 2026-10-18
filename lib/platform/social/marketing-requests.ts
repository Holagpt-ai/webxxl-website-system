import { isSocialMarketingEnabled } from '@/config/social-marketing'
import { stableSocialContentHash } from '@/lib/platform/social/hash'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import type {
  MarketingArtifactRecord,
  MarketingArtifactType,
  MarketingRequestRecord,
  MarketingRequestType,
  SocialResult,
} from '@/lib/platform/social/types'

const PHI_PATTERN = /\b(patient|diagnosis|mrn|hipaa|phi|clinical trial participant)\b/i

export function createMarketingRequest(
  store: SocialStore,
  input: {
    customerAccountId: string
    managedSiteId?: string
    requestType: MarketingRequestType
    brief: string
    locale: 'en' | 'es'
    audience?: string
    goal?: string
    createdByUserId: string
    sourceRefs?: string[]
  },
): SocialResult<MarketingRequestRecord> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }
  if (PHI_PATTERN.test(input.brief)) {
    return { ok: false, code: 'PHI_DENIED', message: 'PHI or clinical participant data cannot be sent to Postiz' }
  }
  if (input.requestType === 'AD_CREATIVE' && /\b(launch|spend|charge|buy ads)\b/i.test(input.brief)) {
    return { ok: false, code: 'AD_SPEND_DENIED', message: 'Ad creative preparation cannot trigger paid spend' }
  }
  const request: MarketingRequestRecord = {
    id: nextSocialId('mktreq'),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    requestType: input.requestType,
    status: 'DRAFT',
    brief: input.brief,
    locale: input.locale,
    audience: input.audience,
    goal: input.goal,
    sourceRefs: input.sourceRefs ?? [],
    artifactIds: [],
    createdByUserId: input.createdByUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.marketingRequests.set(request.id, request)
  return { ok: true, value: request }
}

export function createMarketingArtifact(
  store: SocialStore,
  input: {
    customerAccountId: string
    managedSiteId?: string
    artifactType: MarketingArtifactType
    payload: Record<string, unknown>
    provenance: string
  },
): SocialResult<MarketingArtifactRecord> {
  const serialized = JSON.stringify(input.payload)
  if (PHI_PATTERN.test(serialized)) {
    return { ok: false, code: 'PHI_DENIED', message: 'Artifact contains prohibited PHI patterns' }
  }
  const artifact: MarketingArtifactRecord = {
    id: nextSocialId('mktart'),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    artifactType: input.artifactType,
    revisionHash: stableSocialContentHash(input.payload),
    payload: input.payload,
    provenance: input.provenance,
    createdAt: new Date(),
  }
  store.marketingArtifacts.set(artifact.id, artifact)
  return { ok: true, value: artifact }
}
