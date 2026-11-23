import type { Prisma, SocialApprovalStatus, SocialCampaignStatus } from '@prisma/client'
import { isSocialAutomatedApprovalEnabled, isSocialMarketingEnabled } from '@/config/social-marketing'
import { prisma } from '@/lib/db'
import { assertSocialCampaignApprover, type SocialApproverActor } from '@/lib/platform/social/operator-auth-prisma'
import { assertSocialCampaignTransition } from '@/lib/platform/social/transitions'
import type { SocialResult } from '@/lib/platform/social/types'

const APPROVAL_POLICY_VERSION = 'social-approval-v1'
const APPROVAL_TTL_MS = 7 * 24 * 3600_000

function transitionOrError(
  from: SocialCampaignStatus,
  to: SocialCampaignStatus,
): { ok: false; code: string; message: string } | undefined {
  const gate = assertSocialCampaignTransition(from, to)
  if (!gate.ok) return gate
  return undefined
}

export async function submitSocialCampaignApprovalPersist(input: {
  campaignId: string
  customerAccountId: string
  actorUserId: string
}): Promise<
  SocialResult<{
    campaignId: string
    status: SocialCampaignStatus
    approval: {
      id: string
      status: SocialApprovalStatus
      revisionId: string
      contentHash: string
      expiresAt: string
    }
  }>
> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio backend is disabled' }
  }

  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: input.campaignId, customerAccountId: input.customerAccountId },
  })
  if (!campaign) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }

  const revisionId = campaign.activeRevisionId
  if (!revisionId) {
    return { ok: false, code: 'NO_REVISION', message: 'Campaign requires a revision before approval' }
  }
  const revision = await prisma.socialCampaignRevision.findFirst({
    where: { id: revisionId, campaignId: campaign.id },
  })
  if (!revision) {
    return { ok: false, code: 'NO_REVISION', message: 'Missing active revision' }
  }

  const transitionErr = transitionOrError(campaign.status, 'AWAITING_APPROVAL')
  if (transitionErr) return transitionErr

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS)

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.socialCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'AWAITING_APPROVAL',
          approvedRevisionId: null,
        },
      })
      const approval = await tx.socialCampaignApproval.create({
        data: {
          campaignId: campaign.id,
          revisionId: revision.id,
          status: 'PENDING',
          contentHash: revision.contentHash,
          approvedScope: {} as Prisma.InputJsonValue,
          policyVersion: APPROVAL_POLICY_VERSION,
          expiresAt,
          maxUses: 1,
          useCount: 0,
        },
      })
      return approval
    })
    return {
      ok: true,
      value: {
        campaignId: campaign.id,
        status: 'AWAITING_APPROVAL',
        approval: {
          id: result.id,
          status: result.status,
          revisionId: result.revisionId,
          contentHash: result.contentHash,
          expiresAt: result.expiresAt.toISOString(),
        },
      },
    }
  } catch (error) {
    console.error('submitSocialCampaignApprovalPersist failed', error)
    return { ok: false, code: 'CONFLICT', message: 'Unable to submit campaign for approval' }
  }
}

export async function decideSocialCampaignApprovalPersist(input: {
  campaignId: string
  customerAccountId: string
  approvalId: string
  decision: 'APPROVED' | 'REJECTED'
  approver: SocialApproverActor
}): Promise<
  SocialResult<{
    approvalId: string
    status: SocialApprovalStatus
    campaignStatus: SocialCampaignStatus
    approvedRevisionId: string | null
  }>
> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio backend is disabled' }
  }
  if (isSocialAutomatedApprovalEnabled()) {
    return { ok: false, code: 'DENIED', message: 'Automated social approval is disabled by policy' }
  }

  const approverGate = assertSocialCampaignApprover(input.approver)
  if (!approverGate.ok) return approverGate

  const approval = await prisma.socialCampaignApproval.findFirst({
    where: { id: input.approvalId, campaignId: input.campaignId },
    include: { campaign: true, revision: true },
  })
  if (!approval || approval.campaign.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval missing' }
  }
  if (approval.status !== 'PENDING') {
    return { ok: false, code: 'APPROVAL_CLOSED', message: 'Approval already decided' }
  }
  if (approval.revision.contentHash !== approval.contentHash) {
    return { ok: false, code: 'APPROVAL_ARTIFACT_MISMATCH', message: 'Content changed since approval request' }
  }
  if (approval.expiresAt <= new Date()) {
    await prisma.socialCampaignApproval.update({
      where: { id: approval.id },
      data: { status: 'EXPIRED' },
    })
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired' }
  }

  const targetStatus: SocialCampaignStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'DRAFT'
  const transitionErr = transitionOrError(approval.campaign.status, targetStatus)
  if (transitionErr) return transitionErr

  const decided = await prisma.$transaction(async (tx) => {
    const updatedApproval = await tx.socialCampaignApproval.update({
      where: { id: approval.id },
      data: {
        status: input.decision,
        approverUserId: input.approver.userId,
        decidedAt: new Date(),
        approvedScope: {
          campaignId: approval.campaignId,
          accountId: input.customerAccountId,
        } as Prisma.InputJsonValue,
      },
    })
    await tx.socialCampaign.update({
      where: { id: approval.campaignId },
      data: {
        status: targetStatus,
        approvedRevisionId: input.decision === 'APPROVED' ? approval.revisionId : null,
      },
    })
    return updatedApproval
  })

  return {
    ok: true,
    value: {
      approvalId: decided.id,
      status: decided.status,
      campaignStatus: targetStatus,
      approvedRevisionId: input.decision === 'APPROVED' ? approval.revisionId : null,
    },
  }
}

export async function verifySocialApprovalForSchedulingPrisma(input: {
  approvalId: string
  campaignId: string
  revisionId: string
  contentHash: string
  consumeUse?: boolean
}): Promise<SocialResult<{ approvalId: string; status: SocialApprovalStatus; useCount: number }>> {
  const approval = await prisma.socialCampaignApproval.findFirst({
    where: { id: input.approvalId, campaignId: input.campaignId },
  })
  if (!approval) return { ok: false, code: 'FORGED_APPROVAL', message: 'Approval not found' }
  if (approval.revisionId !== input.revisionId) {
    return { ok: false, code: 'APPROVAL_REVISION_MISMATCH', message: 'Approval revision mismatch' }
  }
  if (approval.contentHash !== input.contentHash) {
    return { ok: false, code: 'APPROVAL_CONTENT_CHANGED', message: 'Approved content was modified' }
  }
  if (approval.status !== 'APPROVED') {
    return { ok: false, code: 'APPROVAL_INVALID', message: 'Approval not active' }
  }
  if (approval.expiresAt <= new Date()) {
    await prisma.socialCampaignApproval.update({
      where: { id: approval.id },
      data: { status: 'EXPIRED' },
    })
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired' }
  }
  if (approval.useCount >= approval.maxUses) {
    return { ok: false, code: 'APPROVAL_EXHAUSTED', message: 'Approval use limit reached' }
  }
  if (input.consumeUse !== false) {
    await prisma.socialCampaignApproval.update({
      where: { id: approval.id },
      data: { useCount: { increment: 1 } },
    })
  }
  return {
    ok: true,
    value: { approvalId: approval.id, status: approval.status, useCount: approval.useCount },
  }
}

export async function listSocialCampaignApprovalsPersist(input: {
  campaignId: string
  customerAccountId: string
}): Promise<
  SocialResult<
    Array<{
      id: string
      status: SocialApprovalStatus
      revisionId: string
      approverUserId: string | null
      decidedAt: string | null
      expiresAt: string
      createdAt: string
    }>
  >
> {
  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: input.campaignId, customerAccountId: input.customerAccountId },
  })
  if (!campaign) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  const rows = await prisma.socialCampaignApproval.findMany({
    where: { campaignId: input.campaignId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return {
    ok: true,
    value: rows.map((row) => ({
      id: row.id,
      status: row.status,
      revisionId: row.revisionId,
      approverUserId: row.approverUserId,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  }
}