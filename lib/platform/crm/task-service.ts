import { prisma } from '@/lib/db'
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
    const contact = await prisma.crmContact.findFirst({ where: { id: input.contactId, customerAccountId: input.customerAccountId } })
    if (!contact) return { ok: false, code: 'VALIDATION_ERROR', message: 'Task contact scope mismatch' }
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
