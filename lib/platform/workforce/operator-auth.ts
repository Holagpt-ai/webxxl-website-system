import { INTERNAL_AGENT_DEFINITIONS } from '@/lib/platform/workforce/internal-agents'
import type { WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import type { WorkforceResult, WorkforceTaskRecord } from '@/lib/platform/workforce/types'

export type WorkforceHumanPermission = 'workforce.approve' | 'workforce.pause'

export type TrustedWorkforceHumanActor = {
  kind: 'verified_human'
  userId: string
  permissions: WorkforceHumanPermission[]
  platformWide: boolean
}

const INTERNAL_AGENT_IDS = new Set(INTERNAL_AGENT_DEFINITIONS.map((agent) => agent.id))

export function isInternalAgentIdentity(actorId: string): boolean {
  return INTERNAL_AGENT_IDS.has(actorId) || actorId.startsWith('internal_agent_')
}

/**
 * Trusted server-side boundary: caller-supplied actorType is never proof of humanity.
 * Production routes must resolve session identity first, then call this helper.
 */
export function resolveTrustedWorkforceHuman(
  store: WorkforceStore,
  userId: string,
  required: WorkforceHumanPermission,
): WorkforceResult<TrustedWorkforceHumanActor> {
  if (isInternalAgentIdentity(userId)) {
    return {
      ok: false,
      code: 'AGENT_IMPERSONATION_DENIED',
      message: 'Internal agent identities cannot act as human operators',
    }
  }
  const registration = store.trustedHumanOperators.get(userId)
  if (!registration || !registration.permissions.includes(required)) {
    return {
      ok: false,
      code: 'UNAUTHORIZED_OPERATOR',
      message: 'Human operator lacks required workforce permission',
    }
  }
  return {
    ok: true,
    value: {
      kind: 'verified_human',
      userId,
      permissions: registration.permissions,
      platformWide: registration.platformWide,
    },
  }
}

export function assertApproverScopeForTask(
  store: WorkforceStore,
  operator: TrustedWorkforceHumanActor,
  task: WorkforceTaskRecord,
): WorkforceResult<true> {
  if (!task.customerAccountId || operator.platformWide) {
    return { ok: true, value: true }
  }
  const scoped = store.operatingMemberships.some(
    (membership) =>
      membership.userId === operator.userId && membership.customerAccountId === task.customerAccountId,
  )
  if (!scoped) {
    return {
      ok: false,
      code: 'APPROVER_SCOPE_DENIED',
      message: 'Approver lacks operating scope for task account',
    }
  }
  return { ok: true, value: true }
}
