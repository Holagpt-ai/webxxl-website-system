import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertCrmContactOwnedByAccount } from '@/lib/platform/crm/contact-guard'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function createCrmTask(input: {
  customerAccountId: string
  title: string
  contactId?: string
  dealId?: string
  assignedUserId?: string
  dueAt?: Date
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  idempotencyKey?: string
}): Promise<CrmResult<{ id: string }>> {
  if (input.idempotencyKey) {
    const existing = await prisma.crmTask.findFirst({
      where: { customerAccountId: input.customerAccountId, createIdempotencyKey: input.idempotencyKey },
    })
    if (existing) return { ok: true, value: { id: existing.id } }
  }
  if (input.contactId) {
    const contact = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
    if (!contact.ok) return contact
  }
  if (input.dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: input.dealId, customerAccountId: input.customerAccountId } })
    if (!deal) return { ok: false, code: 'VALIDATION_ERROR', message: 'Task deal scope mismatch' }
  }
  const task = await prisma.crmTask.create({
    data: {
      customerAccountId: input.customerAccountId,
      title: input.title,
      contactId: input.contactId,
      dealId: input.dealId,
      assignedUserId: input.assignedUserId,
      dueAt: input.dueAt,
      priority: input.priority,
      createIdempotencyKey: input.idempotencyKey,
      followUpPolicyKey: 'default_4_day',
    },
  })
  return { ok: true, value: { id: task.id } }
}

const TERMINAL_TASK_STATUSES = new Set(['COMPLETED', 'CANCELLED'])

export type UpdateCrmTaskPatch = {
  title?: string
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  dueAt?: Date | null
  disposition?: string | null
  assignedUserId?: string | null
}

export async function updateCrmTask(input: {
  customerAccountId: string
  taskId: string
  patch: UpdateCrmTaskPatch
  allowAssigneeChange: boolean
}): Promise<CrmResult<{ id: string; status: string }>> {
  const task = await prisma.crmTask.findFirst({
    where: { id: input.taskId, customerAccountId: input.customerAccountId },
  })
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }

  if (input.patch.assignedUserId !== undefined && !input.allowAssigneeChange) {
    return { ok: false, code: 'FORBIDDEN', message: 'Task assignee changes require owner or staff' }
  }

  if (input.patch.title !== undefined && !input.patch.title.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'title cannot be empty' }
  }

  const nextStatus = input.patch.status ?? task.status
  if (TERMINAL_TASK_STATUSES.has(task.status) && nextStatus !== task.status) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Task status is terminal' }
  }

  const allowed: Record<string, Set<string>> = {
    OPEN: new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    IN_PROGRESS: new Set(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OPEN']),
    COMPLETED: new Set(['COMPLETED']),
    CANCELLED: new Set(['CANCELLED']),
  }
  if (!allowed[task.status]?.has(nextStatus)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid task status transition' }
  }

  const completedAt = nextStatus === 'COMPLETED' ? task.completedAt ?? new Date() : task.completedAt

  const data: Prisma.CrmTaskUpdateInput = {
    title: input.patch.title?.trim(),
    status: nextStatus,
    priority: input.patch.priority,
    dueAt: input.patch.dueAt === null ? null : input.patch.dueAt,
    disposition: input.patch.disposition === null ? null : input.patch.disposition,
    completedAt,
  }
  if (input.patch.assignedUserId !== undefined) {
    data.assignedUserId = input.patch.assignedUserId
  }

  await prisma.crmTask.update({ where: { id: task.id }, data })
  return { ok: true, value: { id: task.id, status: nextStatus } }
}
