import { stableSocialContentHash } from '@/lib/platform/social/hash'

export type SchedulingRequestFingerprintInput = {
  customerAccountId: string
  campaignId: string
  revisionId: string
  approvalId: string
  channelId: string
  scheduledAt: Date
  contentHash: string
}

export function computeSchedulingRequestFingerprint(input: SchedulingRequestFingerprintInput): string {
  return stableSocialContentHash({
    customerAccountId: input.customerAccountId,
    campaignId: input.campaignId,
    revisionId: input.revisionId,
    approvalId: input.approvalId,
    channelId: input.channelId,
    scheduledAt: input.scheduledAt.toISOString(),
    contentHash: input.contentHash,
  })
}
