import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { validateTargetChannelIdsForAccountPrisma } from '@/lib/platform/social/channel-validation-prisma'
import {
  assertRevisionContentBounds,
  computeSocialRevisionContentHash,
} from '@/lib/platform/social/revision-content'
import type { SocialResult } from '@/lib/platform/social/types'

export type CreateRevisionPersistInput = {
  campaignId: string
  customerAccountId: string
  managedSiteId?: string
  captionEn: string
  captionEs?: string
  mediaRefs?: string[]
  platformPayloads?: Record<string, unknown>
  targetChannelIds: string[]
  scheduledAt?: string
}

export async function createSocialCampaignRevisionPersist(
  input: CreateRevisionPersistInput,
): Promise<SocialResult<{ id: string; contentHash: string; revisionNumber: number }>> {
  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: input.campaignId, customerAccountId: input.customerAccountId },
  })
  if (!campaign) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }

  const contentInput = {
    captionEn: input.captionEn,
    captionEs: input.captionEs,
    mediaRefs: input.mediaRefs ?? [],
    platformPayloads: input.platformPayloads ?? {},
    targetChannelIds: input.targetChannelIds,
    scheduledAt: input.scheduledAt,
  }
  const bounds = assertRevisionContentBounds(contentInput)
  if (!bounds.ok) return bounds

  const channelCheck = await validateTargetChannelIdsForAccountPrisma(
    input.customerAccountId,
    input.managedSiteId ?? campaign.managedSiteId ?? undefined,
    input.targetChannelIds,
  )
  if (!channelCheck.ok) return channelCheck

  const contentHash = computeSocialRevisionContentHash(contentInput)
  const scheduledAtDate = input.scheduledAt ? new Date(input.scheduledAt) : undefined
  if (scheduledAtDate && Number.isNaN(scheduledAtDate.getTime())) {
    return { ok: false, code: 'INVALID_BODY', message: 'scheduledAt is invalid' }
  }

  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const count = await tx.socialCampaignRevision.count({ where: { campaignId: input.campaignId } })
        const revisionNumber = count + 1
        const revision = await tx.socialCampaignRevision.create({
          data: {
            campaignId: input.campaignId,
            revisionNumber,
            contentHash,
            captionEn: input.captionEn,
            captionEs: input.captionEs,
            mediaRefs: contentInput.mediaRefs,
            platformPayloads: contentInput.platformPayloads as Prisma.InputJsonValue,
            targetChannelIds: input.targetChannelIds,
            scheduledAt: scheduledAtDate,
          },
        })
        await tx.socialCampaign.update({
          where: { id: input.campaignId },
          data: { activeRevisionId: revision.id, status: 'DRAFT', approvedRevisionId: null },
        })
        return revision
      })
      return {
        ok: true,
        value: { id: result.id, contentHash: result.contentHash, revisionNumber: result.revisionNumber },
      }
    } catch (error) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002' && attempt < maxAttempts - 1) continue
      throw error
    }
  }
  return { ok: false, code: 'CONFLICT', message: 'Unable to allocate revision number' }
}
