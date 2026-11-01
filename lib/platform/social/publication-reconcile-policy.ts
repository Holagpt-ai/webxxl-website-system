import type { PostizPostState } from '@/lib/platform/providers/postiz-http'
import type { SocialPublicationStatus } from '@/lib/platform/social/types'

export type PublicationReconcileOutcome =
  | { kind: 'NO_CHANGE' }
  | { kind: 'SCHEDULED' }
  | { kind: 'PUBLISHED'; publishedUrl: string; publishedAt: Date }
  | { kind: 'FAILED' }
  | { kind: 'RECONCILIATION_REQUIRED'; reason: string }

/**
 * Never infer PUBLISHED from QUEUE or DRAFT — provider must report PUBLISHED with a release URL.
 */
export function mapPostizPostStateToReconcileOutcome(input: {
  state: PostizPostState
  releaseURL?: string | null
  publishDate?: string | null
}): PublicationReconcileOutcome {
  if (input.state === 'PUBLISHED') {
    if (!input.releaseURL) {
      return {
        kind: 'RECONCILIATION_REQUIRED',
        reason: 'Provider reported PUBLISHED without release URL',
      }
    }
    return {
      kind: 'PUBLISHED',
      publishedUrl: input.releaseURL,
      publishedAt: input.publishDate ? new Date(input.publishDate) : new Date(),
    }
  }
  if (input.state === 'QUEUE') {
    return { kind: 'SCHEDULED' }
  }
  if (input.state === 'ERROR') {
    return { kind: 'FAILED' }
  }
  if (input.state === 'DRAFT') {
    return { kind: 'NO_CHANGE' }
  }
  return { kind: 'RECONCILIATION_REQUIRED', reason: `Unknown Postiz post state: ${input.state}` }
}

export function applyReconcileOutcomeToPublicationStatus(
  current: SocialPublicationStatus,
  outcome: PublicationReconcileOutcome,
): SocialPublicationStatus {
  switch (outcome.kind) {
    case 'PUBLISHED':
      return 'PUBLISHED'
    case 'SCHEDULED':
      return current === 'PUBLISHED' ? 'PUBLISHED' : 'SCHEDULED'
    case 'FAILED':
      return 'FAILED'
    case 'RECONCILIATION_REQUIRED':
      return 'RECONCILIATION_REQUIRED'
    case 'NO_CHANGE':
    default:
      return current
  }
}
