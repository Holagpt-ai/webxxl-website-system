import type { WorkforceTaskStatus } from '@/lib/platform/workforce/types'

const ALLOWED: Record<WorkforceTaskStatus, WorkforceTaskStatus[]> = {
  DRAFT: ['QUEUED', 'CANCELLED'],
  QUEUED: ['AWAITING_APPROVAL', 'AUTHORIZED', 'PAUSED', 'CANCELLED'],
  AWAITING_APPROVAL: ['AUTHORIZED', 'FAILED', 'CANCELLED', 'PAUSED'],
  AUTHORIZED: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'PAUSED'],
  COMPLETED: [],
  FAILED: ['QUEUED'],
  PAUSED: ['QUEUED', 'AUTHORIZED', 'CANCELLED'],
  CANCELLED: [],
}

export function canTransitionTask(from: WorkforceTaskStatus, to: WorkforceTaskStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function assertTaskTransition(
  from: WorkforceTaskStatus,
  to: WorkforceTaskStatus,
  reasonCode: string,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!canTransitionTask(from, to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Cannot transition ${from} → ${to} (${reasonCode})`,
    }
  }
  return { ok: true }
}
