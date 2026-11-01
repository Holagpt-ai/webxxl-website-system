import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  isSocialMarketingEnabled,
} from '@/config/social-marketing'
import { verifySocialApprovalForScheduling } from '@/lib/platform/social/approval-service'
import { socialProviderDispatchBlocked, socialProviderReconcileBlocked } from '@/lib/platform/social/execution-gates'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import {
  applyReconcileOutcomeToPublicationStatus,
  mapPostizPostStateToReconcileOutcome,
} from '@/lib/platform/social/publication-reconcile-policy'
import { assertWithinQuota, recordMarketingStudioUsage } from '@/lib/platform/social/quota-service'
import { authorizeSocialSchedulingRequest } from '@/lib/platform/social/scheduling-authorization'
import { transitionSocialCampaign } from '@/lib/platform/social/campaign-service'
import { computeSchedulingRequestFingerprint } from '@/lib/platform/social/scheduling-fingerprint'
import type { SocialPublicationRecord, SocialResult, SocialSchedulingIntentRecord } from '@/lib/platform/social/types'
import type { PostizSocialPublisher } from '@/lib/platform/providers/postiz-social'

export type ScheduleCampaignInput = {
  campaignId: string
  customerAccountId: string
  actorUserId: string
  channelId: string
  approvalId: string
  idempotencyKey: string
  scheduledAt: Date
}

function findPublicationForIntent(store: SocialStore, intentId: string): SocialPublicationRecord | undefined {
  return [...store.publications.values()].find((p) => p.schedulingIntentId === intentId)
}

function replaySchedulingResult(
  store: SocialStore,
  intent: SocialSchedulingIntentRecord,
): SocialResult<{ intent: SocialSchedulingIntentRecord; publication: SocialPublicationRecord }> {
  const publication = findPublicationForIntent(store, intent.id)
  if (!publication) {
    return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
  }
  if (intent.status === 'UNKNOWN' || publication.status === 'RECONCILIATION_REQUIRED') {
    return {
      ok: false,
      code: 'RECONCILIATION_REQUIRED',
      message: intent.lastErrorCode ?? 'Provider outcome unknown; reconciliation required',
    }
  }
  if (intent.status === 'FAILED' || publication.status === 'FAILED') {
    return {
      ok: false,
      code: intent.lastErrorCode ?? 'FAILED',
      message: 'Prior scheduling attempt failed',
    }
  }
  return { ok: true, value: { intent, publication } }
}

export async function scheduleApprovedSocialCampaign(
  store: SocialStore,
  publisher: PostizSocialPublisher,
  input: ScheduleCampaignInput,
): Promise<
  SocialResult<{ intent: SocialSchedulingIntentRecord; publication: SocialPublicationRecord }>
> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }

  const campaign = store.campaigns.get(input.campaignId)
  if (!campaign || campaign.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  const revision = campaign.approvedRevisionId
    ? store.revisions.get(campaign.approvedRevisionId)
    : undefined
  if (!revision) {
    return { ok: false, code: 'NO_APPROVED_REVISION', message: 'Missing approved revision' }
  }

  const requestFingerprint = computeSchedulingRequestFingerprint({
    customerAccountId: input.customerAccountId,
    campaignId: campaign.id,
    revisionId: revision.id,
    approvalId: input.approvalId,
    channelId: input.channelId,
    scheduledAt: input.scheduledAt,
    contentHash: revision.contentHash,
  })

  const existingIntentId = store.schedulingByIdempotency.get(input.idempotencyKey)
  if (existingIntentId) {
    const existing = store.schedulingIntents.get(existingIntentId)
    if (!existing) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
    if (existing.requestFingerprint !== requestFingerprint) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reused with different request' }
    }
    return replaySchedulingResult(store, existing)
  }

  const auth = authorizeSocialSchedulingRequest(store, input)
  if (!auth.ok) return auth

  const dispatchBlock = socialProviderDispatchBlocked()
  if (dispatchBlock) return dispatchBlock

  if (!isPostizApiEnabled() || !isPostizLivePublishingEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'Postiz live publishing disabled at gateway',
    }
  }

  transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'SCHEDULING')

  const intent: SocialSchedulingIntentRecord = {
    id: nextSocialId('socintent'),
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
    campaignId: campaign.id,
    revisionId: revision.id,
    approvalId: input.approvalId,
    customerAccountId: input.customerAccountId,
    channelId: input.channelId,
    scheduledAt: input.scheduledAt,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.schedulingIntents.set(intent.id, intent)
  store.schedulingByIdempotency.set(input.idempotencyKey, intent.id)

  const publication: SocialPublicationRecord = {
    id: nextSocialId('socpub'),
    campaignId: campaign.id,
    revisionId: revision.id,
    schedulingIntentId: intent.id,
    customerAccountId: input.customerAccountId,
    channelId: input.channelId,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.publications.set(publication.id, publication)

  recordMarketingStudioUsage(store, {
    customerAccountId: input.customerAccountId,
    operation: 'schedule',
    source: 'schedule.intent',
    idempotencyKey: `schedule:${input.idempotencyKey}`,
  })

  intent.status = 'DISPATCHED'
  intent.dispatchLeaseOwner = input.actorUserId
  intent.updatedAt = new Date()

  const apiQuota = assertWithinQuota(store, input.customerAccountId, 'postiz_api')
  if (!apiQuota.ok) {
    intent.status = 'FAILED'
    intent.lastErrorCode = apiQuota.code
    publication.status = 'FAILED'
    return apiQuota
  }

  const connection = store.connections.get(input.channelId)
  if (!connection) {
    return { ok: false, code: 'NOT_FOUND', message: 'Social connection not found' }
  }

  const dispatch = await publisher.schedulePost({
    customerAccountId: input.customerAccountId,
    externalIntegrationId: connection.externalChannelRef,
    caption: campaign.locale === 'es' && revision.captionEs ? revision.captionEs : revision.captionEn,
    scheduledAt: input.scheduledAt,
    platformType: connection.platform,
    idempotencyKey: input.idempotencyKey,
  })

  recordMarketingStudioUsage(store, {
    customerAccountId: input.customerAccountId,
    operation: 'postiz_api',
    source: 'schedule.dispatch',
    idempotencyKey: `postiz:${input.idempotencyKey}`,
  })

  if (!dispatch.ok) {
    if (dispatch.code === 'UNKNOWN') {
      intent.status = 'UNKNOWN'
      publication.status = 'RECONCILIATION_REQUIRED'
      store.publicationEvents.push({
        id: nextSocialId('socevt'),
        publicationId: publication.id,
        eventKind: 'PROVIDER_UNKNOWN',
        detail: { message: dispatch.message },
        createdAt: new Date(),
      })
      return { ok: false, code: 'RECONCILIATION_REQUIRED', message: dispatch.message }
    }
    intent.status = 'FAILED'
    intent.lastErrorCode = dispatch.code
    publication.status = 'FAILED'
    transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'FAILED')
    return dispatch
  }

  verifySocialApprovalForScheduling(store, {
    approvalId: input.approvalId,
    campaignId: campaign.id,
    revisionId: revision.id,
    contentHash: revision.contentHash,
    consumeUse: true,
  })

  intent.status = 'ACKNOWLEDGED'
  intent.externalPostRef = dispatch.value.externalPostId
  intent.updatedAt = new Date()
  publication.status = 'SCHEDULED'
  publication.externalPostRef = dispatch.value.externalPostId
  publication.updatedAt = new Date()
  transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'SCHEDULED')

  store.publicationEvents.push({
    id: nextSocialId('socevt'),
    publicationId: publication.id,
    eventKind: 'PROVIDER_SCHEDULED',
    detail: { externalPostId: dispatch.value.externalPostId },
    createdAt: new Date(),
  })

  return { ok: true, value: { intent, publication } }
}

export async function reconcileSocialPublication(
  store: SocialStore,
  publisher: PostizSocialPublisher,
  publicationId: string,
  customerAccountId: string,
): Promise<SocialResult<SocialPublicationRecord>> {
  const reconcileBlock = socialProviderReconcileBlocked()
  if (reconcileBlock) return reconcileBlock

  const publication = store.publications.get(publicationId)
  if (!publication || publication.customerAccountId !== customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Publication not found' }
  }
  if (!publication.externalPostRef) {
    return { ok: false, code: 'NO_EXTERNAL_REF', message: 'No provider reference to reconcile' }
  }
  const status = await publisher.getPostStatus(publication.externalPostRef)
  if (!status.ok) {
    if (status.code === 'UNKNOWN') {
      publication.status = 'RECONCILIATION_REQUIRED'
      publication.updatedAt = new Date()
      return { ok: false, code: 'RECONCILIATION_REQUIRED', message: status.message }
    }
    return status
  }

  const outcome = mapPostizPostStateToReconcileOutcome({
    state: status.value.state,
    releaseURL: status.value.releaseURL,
    publishDate: status.value.publishDate,
  })

  if (outcome.kind === 'RECONCILIATION_REQUIRED') {
    publication.status = 'RECONCILIATION_REQUIRED'
    publication.updatedAt = new Date()
    store.publicationEvents.push({
      id: nextSocialId('socevt'),
      publicationId: publication.id,
      eventKind: 'RECONCILE_AMBIGUOUS',
      detail: { reason: outcome.reason },
      createdAt: new Date(),
    })
    return { ok: false, code: 'RECONCILIATION_REQUIRED', message: outcome.reason }
  }

  const nextStatus = applyReconcileOutcomeToPublicationStatus(publication.status, outcome)
  publication.status = nextStatus
  if (outcome.kind === 'PUBLISHED') {
    publication.publishedUrl = outcome.publishedUrl
    publication.publishedAt = outcome.publishedAt
    const campaign = store.campaigns.get(publication.campaignId)
    if (campaign) transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'PUBLISHED')
  }
  publication.updatedAt = new Date()
  return { ok: true, value: publication }
}
