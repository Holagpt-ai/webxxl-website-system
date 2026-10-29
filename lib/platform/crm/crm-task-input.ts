import type { CrmResult } from '@/lib/platform/crm/types'
import type { UpdateCrmTaskPatch } from '@/lib/platform/crm/task-service'

type TaskStatus = NonNullable<UpdateCrmTaskPatch['status']>
type TaskPriority = NonNullable<UpdateCrmTaskPatch['priority']>

const TASK_STATUSES: readonly TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const TASK_PRIORITIES: readonly TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
}

export function parseTaskUpdateBody(body: {
  title?: unknown
  status?: unknown
  priority?: unknown
  dueAt?: unknown
  disposition?: unknown
  assignedUserId?: unknown
}): CrmResult<UpdateCrmTaskPatch> {
  const patch: UpdateCrmTaskPatch = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'title must be a string' }
    }
    patch.title = body.title
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !isTaskStatus(body.status)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid status' }
    }
    patch.status = body.status
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== 'string' || !isTaskPriority(body.priority)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid priority' }
    }
    patch.priority = body.priority
  }
  if (body.dueAt !== undefined) {
    if (body.dueAt === null) {
      patch.dueAt = null
    } else if (typeof body.dueAt === 'string') {
      const dueAt = new Date(body.dueAt)
      if (Number.isNaN(dueAt.getTime())) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid dueAt' }
      }
      patch.dueAt = dueAt
    } else {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'dueAt must be an ISO string or null' }
    }
  }
  if (body.disposition !== undefined) {
    if (body.disposition !== null && typeof body.disposition !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'disposition must be a string or null' }
    }
    patch.disposition = body.disposition as string | null
  }
  if (body.assignedUserId !== undefined) {
    if (body.assignedUserId !== null && typeof body.assignedUserId !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'assignedUserId must be a string or null' }
    }
    patch.assignedUserId = body.assignedUserId as string | null
  }

  if (!Object.keys(patch).length) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'No updatable fields provided' }
  }

  return { ok: true, value: patch }
}
