import { isSocialExecutionGatesEnabled } from '@/config/social-marketing'
import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { MarketingArtifactType, SocialResult } from '@/lib/platform/social/types'

const SOCIAL_ARTIFACT_TYPES: MarketingArtifactType[] = ['SOCIAL_CAMPAIGN', 'SOCIAL_POST']

export function assertMarketingRequestApprovedForSocialExecution(
  store: SocialStore,
  input: {
    customerAccountId: string
    marketingRequestId: string
    expectedRevisionHash?: string
  },
): SocialResult<{ requestId: string; artifactIds: string[] }> {
  if (!isSocialExecutionGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SOCIAL_EXECUTION_GATES_ENABLED is false',
    }
  }

  const request = store.marketingRequests.get(input.marketingRequestId)
  if (!request || request.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Marketing request not found' }
  }
  if (!SOCIAL_ARTIFACT_TYPES.includes(request.requestType as MarketingArtifactType)) {
    return {
      ok: false,
      code: 'INVALID_REQUEST_TYPE',
      message: 'Marketing request is not a social deliverable type',
    }
  }
  if (request.status !== 'APPROVED') {
    return {
      ok: false,
      code: 'MARKETING_NOT_APPROVED',
      message: 'Marketing request must be approved before social scheduling prep',
    }
  }

  if (input.expectedRevisionHash) {
    const artifacts = request.artifactIds
      .map((id) => store.marketingArtifacts.get(id))
      .filter(Boolean)
    const hashMatch = artifacts.some((row) => row!.revisionHash === input.expectedRevisionHash)
    if (!hashMatch) {
      return {
        ok: false,
        code: 'MARKETING_ARTIFACT_MISMATCH',
        message: 'Approved marketing artifact hash does not match social revision',
      }
    }
  }

  return { ok: true, value: { requestId: request.id, artifactIds: request.artifactIds } }
}
