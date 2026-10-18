import type { WorkforceTaskRecord } from '@/lib/platform/workforce/types'

/** Fields that must not be mutated through generic transition patches. */
export const WORKFORCE_TASK_IMMUTABLE_PATCH_KEYS: (keyof WorkforceTaskRecord)[] = [
  'id',
  'idempotencyKey',
  'internalAgentKey',
  'customerAccountId',
  'managedSiteId',
  'inputHash',
  'capability',
  'approvalRequired',
  'providerKey',
  'createdAt',
]

export function stripSecuritySensitiveTaskPatch(
  patch: Partial<WorkforceTaskRecord> | undefined,
): Partial<WorkforceTaskRecord> | undefined {
  if (!patch) return undefined
  const next = { ...patch }
  for (const key of WORKFORCE_TASK_IMMUTABLE_PATCH_KEYS) {
    delete next[key]
  }
  return next
}

/** Reason code reserved for authorizeWorkforceTask — blocks casual AUTHORIZED transitions. */
export const WORKFORCE_AUTHORIZED_TRANSITION_REASON = 'authorized_by_service'
