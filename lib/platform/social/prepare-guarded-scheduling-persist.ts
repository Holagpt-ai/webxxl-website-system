import {
  isPostizLivePublishingEnabled,
  isSocialExecutionGatesEnabled,
  isSocialMarketingEnabled,
  marketingStudioDefaultPeriodKey,
} from '@/config/social-marketing'
import { prisma } from '@/lib/db'
import { socialProviderDispatchBlocked } from '@/lib/platform/social/execution-gates'
import { authorizeSocialSchedulingRequestPrisma } from '@/lib/platform/social/scheduling-authorization-prisma'
import { computeSchedulingRequestFingerprint } from '@/lib/platform/social/scheduling-fingerprint'
import type { SocialResult } from '@/lib/platform/social/types'

export type PrepareGuardedSchedulingPersistInput = {
  campaignId: string
  customerAccountId: string
  actorUserId: string
  channelId: string
  approvalId: string
  idempotencyKey: string
  scheduledAt: Date
}

export type GuardedSchedulingPersistResult = {
  intentId: string
  publicationId: string
  intentStatus: string
  publicationStatus: string
  dispatchBlocked: { code: string; message: string }
  schedulingOccurred: false
  publishingOccurred: false
  livePublishingEnabled: boolean
}

function dispatchBlockedMetadata(): { code: string; message: string } {
  const blocked = socialProviderDispatchBlocked()
  if (blocked && !blocked.ok) {
    return { code: blocked.code, message: blocked.message }
  }
  return { code: 'NOT_CONFIGURED', message: 'Provider dispatch blocked' }
}

function fingerprintMatchesExisting(input: {
  customerAccountId: string
  campaignId: string
  revisionId: string
  approvalId: string
  channelId: string
  scheduledAt: Date
  contentHash: string
  existing: {
    customerAccountId: string
    campaignId: string
    revisionId: string
    approvalId: string
    channelId: string
    scheduledAt: Date
    revision: { contentHash: string }
  }
}): boolean {
  const expected = computeSchedulingRequestFingerprint({
    customerAccountId: input.customerAccountId,
    campaignId: input.campaignId,
    revisionId: input.revisionId,
    approvalId: input.approvalId,
    channelId: input.channelId,
    scheduledAt: input.scheduledAt,
    contentHash: input.contentHash,
  })
  const replay = computeSchedulingRequestFingerprint({
    customerAccountId: input.existing.customerAccountId,
    campaignId: input.existing.campaignId,
    revisionId: input.existing.revisionId,
    approvalId: input.existing.approvalId,
    channelId: input.existing.channelId,
    scheduledAt: input.existing.scheduledAt,
    contentHash: input.existing.revision.contentHash,
  })
  return expected === replay
}

/**
 * Persists scheduling intent + publication in PENDING without Postiz dispatch when live publishing is off.
 */
export async function prepareGuardedSchedulingIntentPersist(
  input: PrepareGuardedSchedulingPersistInput,
): Promise<SocialResult<GuardedSchedulingPersistResult>> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }
  if (!isSocialExecutionGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'SOCIAL_EXECUTION_GATES_ENABLED is false',
    }
  }
  if (isPostizLivePublishingEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'Live publishing route remains owner-gated separately',
    }
  }

  const existing = await prisma.socialSchedulingIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: {
      publications: true,
      revision: { select: { contentHash: true } },
    },
  })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
  }

  const auth = await authorizeSocialSchedulingRequestPrisma(input)
  if (!auth.ok) return auth

  const blockedPayload = dispatchBlockedMetadata()
  const periodKey = marketingStudioDefaultPeriodKey()

  if (existing) {
    const matches = fingerprintMatchesExisting({
      ...input,
      revisionId: auth.value.revisionId,
      contentHash: auth.value.contentHash,
      existing,
    })
    if (!matches) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reused with different request' }
    }
    const publication = existing.publications[0]
    if (!publication) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
    if (existing.status === 'UNKNOWN' || publication.status === 'RECONCILIATION_REQUIRED') {
      return {
        ok: false,
        code: 'RECONCILIATION_REQUIRED',
        message: existing.lastErrorCode ?? 'Provider outcome unknown; reconciliation required',
      }
    }
    return {
      ok: true,
      value: {
        intentId: existing.id,
        publicationId: publication.id,
        intentStatus: existing.status,
        publicationStatus: publication.status,
        dispatchBlocked: blockedPayload,
        schedulingOccurred: false,
        publishingOccurred: false,
        livePublishingEnabled: false,
      },
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const intent = await tx.socialSchedulingIntent.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          campaignId: input.campaignId,
          revisionId: auth.value.revisionId,
          approvalId: input.approvalId,
          customerAccountId: input.customerAccountId,
          channelId: input.channelId,
          scheduledAt: input.scheduledAt,
          status: 'PENDING',
        },
      })
      const publication = await tx.socialPublication.create({
        data: {
          campaignId: input.campaignId,
          revisionId: auth.value.revisionId,
          schedulingIntentId: intent.id,
          customerAccountId: input.customerAccountId,
          channelId: input.channelId,
          status: 'PENDING',
        },
      })
      await tx.socialPublicationEvent.create({
        data: {
          publicationId: publication.id,
          eventKind: 'EXECUTION_GATE_PREPARED',
          detail: { dispatchBlockedCode: blockedPayload.code, requestFingerprint: auth.value.requestFingerprint },
        },
      })
      await tx.marketingStudioUsage.create({
        data: {
          customerAccountId: input.customerAccountId,
          periodKey,
          operation: 'schedule',
          units: 1,
          source: 'schedule.guarded_prep.prisma',
          idempotencyKey: `schedule:${input.idempotencyKey}`,
        },
      })
      const campaign = await tx.socialCampaign.findFirst({
        where: { id: input.campaignId, customerAccountId: input.customerAccountId },
      })
      if (campaign && campaign.status === 'APPROVED') {
        await tx.socialCampaign.update({
          where: { id: campaign.id },
          data: { status: 'SCHEDULING' },
        })
      }
      return { intent, publication }
    })

    return {
      ok: true,
      value: {
        intentId: created.intent.id,
        publicationId: created.publication.id,
        intentStatus: created.intent.status,
        publicationStatus: created.publication.status,
        dispatchBlocked: blockedPayload,
        schedulingOccurred: false,
        publishingOccurred: false,
        livePublishingEnabled: false,
      },
    }
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
    throw error
  }
}

export async function listSocialSchedulingStatusForCampaign(input: {
  campaignId: string
  customerAccountId: string
}): Promise<
  SocialResult<{
    campaignId: string
    campaignStatus: string
    intents: Array<{
      id: string
      status: string
      channelId: string
      scheduledAt: string
      approvalId: string
      publicationId: string | null
      publicationStatus: string | null
      dispatchBlockedCode: string | null
    }>
  }>
> {
  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: input.campaignId, customerAccountId: input.customerAccountId },
  })
  if (!campaign) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }

  const intents = await prisma.socialSchedulingIntent.findMany({
    where: { campaignId: input.campaignId, customerAccountId: input.customerAccountId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      publications: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          events: {
            where: { eventKind: 'EXECUTION_GATE_PREPARED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  const blocked = dispatchBlockedMetadata()

  return {
    ok: true,
    value: {
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      intents: intents.map((row) => {
        const publication = row.publications[0]
        const prepEvent = publication?.events[0]
        const detail = prepEvent?.detail as { dispatchBlockedCode?: string } | null
        return {
          id: row.id,
          status: row.status,
          channelId: row.channelId,
          scheduledAt: row.scheduledAt.toISOString(),
          approvalId: row.approvalId,
          publicationId: publication?.id ?? null,
          publicationStatus: publication?.status ?? null,
          dispatchBlockedCode: detail?.dispatchBlockedCode ?? blocked.code,
        }
      }),
    },
  }
}