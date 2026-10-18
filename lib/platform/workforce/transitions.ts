import { WORKFORCE_AUTHORIZED_TRANSITION_REASON } from '@/lib/platform/workforce/task-security'
import type { WorkforceTaskStatus } from '@/lib/platform/workforce/types'

const ALLOWED: Record<WorkforceTaskStatus, WorkforceTaskStatus[]> = {
  DRAFT: ['QUEUED', 'CANCELLED'],
  QUEUED: ['AWAITING_APPROVAL', 'PAUSED', 'CANCELLED'],
  AWAITING_APPROVAL: ['FAILED', 'CANCELLED', 'PAUSED'],
  AUTHORIZED: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'PAUSED'],
  COMPLETED: [],
  FAILED: ['QUEUED'],
  PAUSED: ['QUEUED', 'CANCELLED'],
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
  if (to === 'AUTHORIZED') {
    if (reasonCode !== WORKFORCE_AUTHORIZED_TRANSITION_REASON) {
      return {
        ok: false,
        code: 'AUTHORIZATION_BYPASS_DENIED',
        message: 'AUTHORIZED requires authorizeWorkforceTask service path',
      }
    }
    if (from !== 'AWAITING_APPROVAL' && from !== 'PAUSED') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: `Cannot transition ${from} → AUTHORIZED`,
      }
    }
    return { ok: true }
  }
  if (!canTransitionTask(from, to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Cannot transition ${from} → ${to} (${reasonCode})`,
    }
  }
  return { ok: true }
}
