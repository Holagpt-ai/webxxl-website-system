import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertActiveAccountMembership } from '@/lib/platform/marketing/membership-auth'
import type { MktResult } from '@/lib/platform/marketing/types'

function buildCallbackTaskFingerprint(input: {
  customerAccountId: string
  contactId: string
  assignedUserId: string
  evaluationId: string
  operation: string
}): string {
  const payload = `${input.customerAccountId}:${input.contactId}:${input.assignedUserId}:${input.evaluationId}:${input.operation}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export async function prepareFollowUpCallbackTask(input: {
  customerAccountId: string
  evaluationId: string
  contactId: string
  assignedUserId: string
  idempotencyKey: string
  dueAt?: Date
}): Promise<MktResult<{ taskId: string; created: boolean }>> {
  const evaluation = await prisma.marketingLeadFollowUpEvaluation.findFirst({
    where: { id: input.evaluationId, customerAccountId: input.customerAccountId },
  })
  if (!evaluation) return { ok: false, code: 'NOT_FOUND', message: 'Follow-up evaluation not found' }
  if (evaluation.crmContactId !== input.contactId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Evaluation does not match contact' }
  }

  const contact = await prisma.crmContact.findFirst({
    where: { id: input.contactId, customerAccountId: input.customerAccountId },
  })
  if (!contact) return { ok: false, code: 'FORBIDDEN', message: 'Contact not found for account' }

  const membership = await assertActiveAccountMembership({
    customerAccountId: input.customerAccountId,
    userId: input.assignedUserId,
  })
  if (!membership.ok) return membership

  const fingerprint = buildCallbackTaskFingerprint({
    customerAccountId: input.customerAccountId,
    contactId: input.contactId,
    assignedUserId: input.assignedUserId,
    evaluationId: input.evaluationId,
    operation: 'CALLBACK',
  })

  const existing = await prisma.crmTask.findUnique({ where: { createIdempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key already used for another account' }
    }
    if (existing.contactId !== input.contactId || existing.assignedUserId !== input.assignedUserId) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key reused with different task payload' }
    }
    if (existing.disposition !== fingerprint) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key reused with different operation fingerprint' }
    }
    return { ok: true, value: { taskId: existing.id, created: false } }
  }

  const duplicateOpen = await prisma.crmTask.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      title: { contains: 'CALLBACK', mode: 'insensitive' },
      followUpPolicyKey: 'mkt-08-callback',
    },
  })
  if (duplicateOpen) {
    return { ok: false, code: 'CONFLICT', message: 'Duplicate open callback task already exists for contact' }
  }

  try {
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
        disposition: fingerprint,
      },
    })
    return { ok: true, value: { taskId: task.id, created: true } }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.crmTask.findUnique({ where: { createIdempotencyKey: input.idempotencyKey } })
      if (raced && raced.customerAccountId === input.customerAccountId && raced.disposition === fingerprint) {
        return { ok: true, value: { taskId: raced.id, created: false } }
      }
      return { ok: false, code: 'CONFLICT', message: 'Concurrent task creation conflict' }
    }
    throw error
  }
}
