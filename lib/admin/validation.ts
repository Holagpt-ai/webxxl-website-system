import type { ProjectStatus, TaskStatus } from '@prisma/client'

export function parseProgressPercent(value: unknown): { ok: true; value: number } | { ok: false; error: 'invalid_progress' } {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: 'invalid_progress' }
  }
  if (value < 0 || value > 100) {
    return { ok: false, error: 'invalid_progress' }
  }
  return { ok: true, value }
}

/** When status changes on a project, derive completedAt (undefined = leave unchanged). */
export function resolveProjectCompletedAt(
  prevStatus: ProjectStatus,
  nextStatus: ProjectStatus,
  existingCompletedAt: Date | null,
  now: Date = new Date(),
): Date | null | undefined {
  if (nextStatus === 'COMPLETED') {
    return existingCompletedAt ?? now
  }
  if (prevStatus === 'COMPLETED') {
    return null
  }
  return undefined
}

/** Derive task completedAt when status changes (undefined = leave unchanged). */
export function resolveTaskCompletedAt(
  prevStatus: TaskStatus,
  nextStatus: TaskStatus,
  existingCompletedAt: Date | null,
  now: Date = new Date(),
): Date | null | undefined {
  if (nextStatus === 'DONE') {
    return prevStatus === 'DONE' ? existingCompletedAt : now
  }
  if (prevStatus === 'DONE') {
    return null
  }
  return undefined
}
