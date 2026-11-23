import type { MembershipRole, UserRole } from '@prisma/client'
import { isStaffRole } from '@/lib/admin/roles'
import type { SocialResult } from '@/lib/platform/social/types'

export type SocialApproverActor = {
  userId: string
  customerAccountId: string
  membershipRole: MembershipRole
  platformRole: UserRole
}

/**
 * Human social campaign approvers: account OWNER or platform staff.
 * Agents and non-owner members cannot approve (mirrors in-memory trusted approver policy).
 */
export function assertSocialCampaignApprover(actor: SocialApproverActor): SocialResult<true> {
  if (actor.userId.startsWith('internal_agent_')) {
    return { ok: false, code: 'AGENT_IMPERSONATION_DENIED', message: 'Agents cannot approve social content' }
  }
  if (isStaffRole(actor.platformRole)) {
    return { ok: true, value: true }
  }
  if (actor.membershipRole === 'OWNER') {
    return { ok: true, value: true }
  }
  return {
    ok: false,
    code: 'UNAUTHORIZED_APPROVER',
    message: 'User lacks social publishing approval authority',
  }
}