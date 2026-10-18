import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function prepareFollowUpCallbackTask(input: {
  customerAccountId: string
  contactId: string
  assignedUserId: string
  idempotencyKey: string
  dueAt?: Date
}): Promise<MktResult<{ taskId: string; created: boolean }>> {
  const contact = await prisma.crmContact.findFirst({
    where: { id: input.contactId, customerAccountId: input.customerAccountId },
  })
  if (!contact) return { ok: false, code: 'FORBIDDEN', message: 'Contact not found for account' }

  const existing = await prisma.crmTask.findUnique({ where: { createIdempotencyKey: input.idempotencyKey } })
  if (existing) return { ok: true, value: { taskId: existing.id, created: false } }

  const task = await prisma.crmTask.create({
    data: {
      customerAccountId: input.customerAccountId,
      contactId: contact.id,
      title: 'CALLBACK — marketing follow-up',
      status: 'OPEN',
      assignedUserId: input.assignedUserId,
      dueAt: input.dueAt ?? new Date(Date.now() + 86400000),
      followUpPolicyKey: 'mkt-08-callback',
      createIdempotencyKey: input.idempotencyKey,
    },
  })
  return { ok: true, value: { taskId: task.id, created: true } }
}
