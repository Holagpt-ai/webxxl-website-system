import { isSocialExecutionGatesEnabled } from '@/config/social-marketing'
import { socialProviderDispatchBlocked } from '@/lib/platform/social/execution-gates'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import { recordMarketingStudioUsage } from '@/lib/platform/social/quota-service'
import {
  authorizeSocialSchedulingRequest,
  type SocialSchedulingAuthorizationInput,
} from '@/lib/platform/social/scheduling-authorization'
import { computeSchedulingRequestFingerprint } from '@/lib/platform/social/scheduling-fingerprint'
import type { SocialPublicationRecord, SocialResult, SocialSchedulingIntentRecord } from '@/lib/platform/social/types'

export type PrepareGuardedSchedulingInput = SocialSchedulingAuthorizationInput & {
  idempotencyKey: string
}

export type GuardedSchedulingPrepResult = {
  intent: SocialSchedulingIntentRecord
  publication: SocialPublicationRecord
  dispatchBlocked: { code: string; message: string }
}

function findPublicationForIntent(store: SocialStore, intentId: string): SocialPublicationRecord | undefined {
  return [...store.publications.values()].find((p) => p.schedulingIntentId === intentId)
}

function dispatchBlockedMetadata(): { code: string; message: string } {
  const blocked = socialProviderDispatchBlocked()
  if (blocked && !blocked.ok) {
    return { code: blocked.code, message: blocked.message }
  }
  return { code: 'NOT_CONFIGURED', message: 'Provider dispatch blocked' }
}

function replayGuardedPrep(
  store: SocialStore,
  intent: SocialSchedulingIntentRecord,
): SocialResult<GuardedSchedulingPrepResult> {
  const publication = findPublicationForIntent(store, intent.id)
  if (!publication) {
    return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
  }
  const blocked = dispatchBlockedMetadata()
  if (intent.status === 'UNKNOWN' || publication.status === 'RECONCILIATION_REQUIRED') {
    return {
      ok: false,
      code: 'RECONCILIATION_REQUIRED',
      message: intent.lastErrorCode ?? 'Provider outcome unknown; reconciliation required',
    }
  }
  return {
    ok: true,
    value: {
      intent,
      publication,
      dispatchBlocked: blocked,
    },
  }
}

/**
 * Records a scheduling intent and publication in PENDING state without provider dispatch.
 * Campaign status remains APPROVED — never SCHEDULED or PUBLISHED until provider ack under live gates.
 */
export function prepareGuardedSchedulingIntent(
  store: SocialStore,
  input: PrepareGuardedSchedulingInput,
): SocialResult<GuardedSchedulingPrepResult> {
  if (!isSocialExecutionGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SOCIAL_EXECUTION_GATES_ENABLED is false',
    }
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
    return replayGuardedPrep(store, existing)
  }

  const auth = authorizeSocialSchedulingRequest(store, input)
  if (!auth.ok) return auth

  const blockedPayload = dispatchBlockedMetadata()

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
    source: 'schedule.guarded_prep',
    idempotencyKey: `schedule:${input.idempotencyKey}`,
  })

  store.publicationEvents.push({
    id: nextSocialId('socevt'),
    publicationId: publication.id,
    eventKind: 'EXECUTION_GATE_PREPARED',
    detail: { dispatchBlockedCode: blockedPayload.code },
    createdAt: new Date(),
  })

  return {
    ok: true,
    value: {
      intent,
      publication,
      dispatchBlocked: { code: blockedPayload.code, message: blockedPayload.message },
    },
  }
}
