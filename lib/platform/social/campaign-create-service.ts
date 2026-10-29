import { isSocialMarketingEnabled, marketingStudioDefaultPeriodKey } from '@/config/social-marketing'
import { evaluateIncludedFreeAccessForAccountFromDatabase } from '@/lib/platform/open001/included-free-access'
import { prisma } from '@/lib/db'
import { assertValidQuotaPolicy } from '@/lib/platform/social/quota-policy'
import { assertValidTargetPlatforms } from '@/lib/platform/social/revision-content'
import type { SocialResult } from '@/lib/platform/social/types'

export type CreateCampaignPersistInput = {
  customerAccountId: string
  managedSiteId?: string
  createdByUserId: string
  goal: string
  locale: 'en' | 'es'
  targetPlatforms: string[]
  targetAudience?: string
  brandProfile?: string
  idempotencyKey?: string
}

export async function createSocialCampaignWithQuota(
  input: CreateCampaignPersistInput,
): Promise<SocialResult<{ id: string }>> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio backend is disabled' }
  }
  const access = await evaluateIncludedFreeAccessForAccountFromDatabase({
    entitlementKey: 'core.marketing-studio',
    customerAccountId: input.customerAccountId,
  })
  if (!access.allowed) {
    return { ok: false, code: access.code, message: access.message }
  }

  const policyCheck = assertValidQuotaPolicy()
  if (!policyCheck.ok) return policyCheck

  const platforms = assertValidTargetPlatforms(input.targetPlatforms)
  if (!platforms.ok) return platforms

  const periodKey = marketingStudioDefaultPeriodKey()
  const idempotencyKey = input.idempotencyKey?.trim()

  if (idempotencyKey) {
    const priorUsage = await prisma.marketingStudioUsage.findUnique({
      where: { idempotencyKey },
    })
    if (priorUsage) {
      if (priorUsage.customerAccountId !== input.customerAccountId) {
        return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
      }
      const priorCampaign = await prisma.socialCampaign.findFirst({
        where: {
          customerAccountId: input.customerAccountId,
          createIdempotencyKey: idempotencyKey,
        },
      })
      if (priorCampaign) return { ok: true, value: { id: priorCampaign.id } }
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const used = await tx.marketingStudioUsage.aggregate({
        where: {
          customerAccountId: input.customerAccountId,
          periodKey,
          operation: 'draft',
        },
        _sum: { units: true },
      })
      const usedUnits = used._sum.units ?? 0
      if (usedUnits >= policyCheck.value.draftsPerAccountMonth) {
        throw new Error('QUOTA_EXCEEDED')
      }

      if (idempotencyKey) {
        const existing = await tx.socialCampaign.findFirst({
          where: { customerAccountId: input.customerAccountId, createIdempotencyKey: idempotencyKey },
        })
        if (existing) return existing
      }

      const campaign = await tx.socialCampaign.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          createdByUserId: input.createdByUserId,
          goal: input.goal,
          locale: input.locale,
          targetPlatforms: input.targetPlatforms,
          targetAudience: input.targetAudience,
          brandProfile: input.brandProfile,
          status: 'DRAFT',
          createIdempotencyKey: idempotencyKey,
        },
      })

      await tx.marketingStudioUsage.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          periodKey,
          operation: 'draft',
          units: 1,
          source: 'campaign.create.prisma',
          idempotencyKey: idempotencyKey ?? `draft:${campaign.id}`,
        },
      })
      return campaign
    })
    return { ok: true, value: { id: created.id } }
  } catch (error) {
    if (error instanceof Error && error.message === 'QUOTA_EXCEEDED') {
      return { ok: false, code: 'QUOTA_EXCEEDED', message: 'FREE Marketing Studio draft quota exceeded' }
    }
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.socialCampaign.findFirst({
        where: { customerAccountId: input.customerAccountId, createIdempotencyKey: idempotencyKey },
      })
      if (existing) return { ok: true, value: { id: existing.id } }
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key conflict' }
    }
    throw error
  }
}
