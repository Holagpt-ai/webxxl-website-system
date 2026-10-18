import { isSocialAutomatedApprovalEnabled } from '@/config/social-marketing'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import {
  assertApproverAccountScope,
  resolveTrustedSocialApprover,
  type TrustedSocialApprover,
} from '@/lib/platform/social/operator-auth'
import { transitionSocialCampaign } from '@/lib/platform/social/campaign-service'
import type { SocialCampaignApprovalRecord, SocialResult } from '@/lib/platform/social/types'

const APPROVAL_POLICY_VERSION = 'social-approval-v1'

export function createSocialCampaignApproval(
  store: SocialStore,
  input: { campaignId: string; revisionId: string; contentHash: string; expiresAt: Date; maxUses?: number },
): SocialCampaignApprovalRecord {
  const approval: SocialCampaignApprovalRecord = {
    id: nextSocialId('socappr'),
    campaignId: input.campaignId,
    revisionId: input.revisionId,
    status: 'PENDING',
    contentHash: input.contentHash,
    approvedScope: {},
    policyVersion: APPROVAL_POLICY_VERSION,
    expiresAt: input.expiresAt,
    maxUses: input.maxUses ?? 1,
    useCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.approvals.set(approval.id, approval)
  return approval
}

export function decideSocialCampaignApproval(
  store: SocialStore,
  input: {
    approvalId: string
    trustedApprover: TrustedSocialApprover
    decision: 'APPROVED' | 'REJECTED'
    approvedScope?: Record<string, unknown>
  },
): SocialResult<SocialCampaignApprovalRecord> {
  if (isSocialAutomatedApprovalEnabled()) {
    return { ok: false, code: 'DENIED', message: 'Automated social approval is disabled by policy' }
  }
  const operator = resolveTrustedSocialApprover(store, input.trustedApprover.userId)
  if (!operator.ok) return operator

  const approval = store.approvals.get(input.approvalId)
  if (!approval) return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval missing' }
  if (approval.status !== 'PENDING') {
    return { ok: false, code: 'APPROVAL_CLOSED', message: 'Approval already decided' }
  }
  const campaign = store.campaigns.get(approval.campaignId)
  if (!campaign) return { ok: false, code: 'NOT_FOUND', message: 'Campaign missing' }
  const revision = store.revisions.get(approval.revisionId)
  if (!revision || revision.contentHash !== approval.contentHash) {
    return { ok: false, code: 'APPROVAL_ARTIFACT_MISMATCH', message: 'Content changed since approval request' }
  }
  const scope = assertApproverAccountScope(store, operator.value, campaign.customerAccountId)
  if (!scope.ok) return scope
  if (approval.expiresAt <= new Date()) {
    approval.status = 'EXPIRED'
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired' }
  }

  approval.status = input.decision
  approval.approverUserId = operator.value.userId
  approval.approvedScope = input.approvedScope ?? {}
  approval.decidedAt = new Date()
  approval.updatedAt = new Date()

  if (input.decision === 'APPROVED') {
    campaign.approvedRevisionId = approval.revisionId
    transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'APPROVED')
  } else {
    transitionSocialCampaign(store, campaign.id, campaign.customerAccountId, 'DRAFT')
  }
  return { ok: true, value: approval }
}

export function verifySocialApprovalForScheduling(
  store: SocialStore,
  input: {
    approvalId: string
    campaignId: string
    revisionId: string
    contentHash: string
    consumeUse?: boolean
  },
): SocialResult<{ approval: SocialCampaignApprovalRecord }> {
  const approval = store.approvals.get(input.approvalId)
  if (!approval) return { ok: false, code: 'FORGED_APPROVAL', message: 'Approval not found' }
  if (approval.campaignId !== input.campaignId) {
    return { ok: false, code: 'APPROVAL_CAMPAIGN_MISMATCH', message: 'Approval campaign mismatch' }
  }
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
    approval.status = 'EXPIRED'
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired' }
  }
  if (approval.useCount >= approval.maxUses) {
    return { ok: false, code: 'APPROVAL_EXHAUSTED', message: 'Approval use limit reached' }
  }
  if (input.consumeUse !== false) {
    approval.useCount += 1
    approval.updatedAt = new Date()
  }
  return { ok: true, value: { approval } }
}
