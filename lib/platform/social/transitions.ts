import type { SocialCampaignStatus } from '@/lib/platform/social/types'

const ALLOWED: Record<SocialCampaignStatus, SocialCampaignStatus[]> = {
  DRAFT: ['AWAITING_APPROVAL', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED', 'FAILED'],
  APPROVED: ['SCHEDULING', 'CANCELLED'],
  SCHEDULING: ['SCHEDULED', 'FAILED', 'CANCELLED'],
  SCHEDULED: ['PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'],
  PUBLISHING: ['PUBLISHED', 'FAILED'],
  PUBLISHED: [],
  FAILED: ['DRAFT'],
  CANCELLED: [],
}

export function assertSocialCampaignTransition(
  from: SocialCampaignStatus,
  to: SocialCampaignStatus,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!ALLOWED[from].includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Cannot transition campaign ${from} → ${to}`,
    }
  }
  return { ok: true }
}
