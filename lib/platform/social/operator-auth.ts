import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { SocialResult } from '@/lib/platform/social/types'

export type TrustedSocialApprover = {
  kind: 'verified_human'
  userId: string
  platformWide: boolean
}

export function resolveTrustedSocialApprover(
  store: SocialStore,
  userId: string,
): SocialResult<TrustedSocialApprover> {
  if (userId.startsWith('internal_agent_')) {
    return { ok: false, code: 'AGENT_IMPERSONATION_DENIED', message: 'Agents cannot approve social content' }
  }
  const registration = store.trustedApprovers.get(userId)
  if (!registration) {
    return { ok: false, code: 'UNAUTHORIZED_APPROVER', message: 'User lacks social publishing approval authority' }
  }
  return { ok: true, value: { kind: 'verified_human', userId, platformWide: registration.platformWide } }
}

export function assertApproverAccountScope(
  store: SocialStore,
  approver: TrustedSocialApprover,
  customerAccountId: string,
): SocialResult<true> {
  if (approver.platformWide) return { ok: true, value: true }
  const scoped = store.operatingMemberships.some(
    (m) => m.userId === approver.userId && m.customerAccountId === customerAccountId,
  )
  if (!scoped) {
    return { ok: false, code: 'APPROVER_SCOPE_DENIED', message: 'Approver lacks account scope' }
  }
  return { ok: true, value: true }
}
