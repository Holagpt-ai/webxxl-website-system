import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertActiveAccountMembership } from '@/lib/platform/marketing/membership-auth'
import type { MktResult } from '@/lib/platform/marketing/types'

const CALLBACK_POLICY_KEY = 'mkt-08-callback'

export function buildCallbackTaskIntentFingerprint(input: {
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

  const intentFingerprint = buildCallbackTaskIntentFingerprint({
    customerAccountId: input.customerAccountId,
    contactId: input.contactId,
    assignedUserId: input.assignedUserId,
    evaluationId: input.evaluationId,
    operation: 'CALLBACK',
  })

  const existingByIdempotency = await prisma.marketingFollowUpTaskIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existingByIdempotency) {
    if (existingByIdempotency.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key already used for another account' }
    }
    if (
      existingByIdempotency.intentFingerprint !== intentFingerprint ||
      existingByIdempotency.crmContactId !== input.contactId ||
      existingByIdempotency.evaluationId !== input.evaluationId
    ) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key reused with different task payload' }
    }
    if (!existingByIdempotency.crmTaskId) {
      return { ok: false, code: 'CONFLICT', message: 'Task intent incomplete' }
    }
    return { ok: true, value: { taskId: existingByIdempotency.crmTaskId, created: false } }
  }

  const existingByEvaluation = await prisma.marketingFollowUpTaskIntent.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      crmContactId: input.contactId,
      policyKey: CALLBACK_POLICY_KEY,
      evaluationId: input.evaluationId,
    },
  })
  if (existingByEvaluation?.crmTaskId) {
    if (existingByEvaluation.idempotencyKey === input.idempotencyKey) {
      return { ok: true, value: { taskId: existingByEvaluation.crmTaskId, created: false } }
    }
    return { ok: false, code: 'CONFLICT', message: 'Callback task already prepared for this evaluation' }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const intent = await tx.marketingFollowUpTaskIntent.create({
        data: {
          customerAccountId: input.customerAccountId,
          crmContactId: contact.id,
          evaluationId: input.evaluationId,
          policyKey: CALLBACK_POLICY_KEY,
          intentFingerprint,
          idempotencyKey: input.idempotencyKey,
        },
      })

      const task = await tx.crmTask.create({
        data: {
          customerAccountId: input.customerAccountId,
          contactId: contact.id,
          title: 'CALLBACK — marketing follow-up',
          status: 'OPEN',
          assignedUserId: input.assignedUserId,
          dueAt: input.dueAt ?? new Date(Date.now() + 86400000),
          followUpPolicyKey: CALLBACK_POLICY_KEY,
          createIdempotencyKey: input.idempotencyKey,
        },
      })

      await tx.marketingFollowUpTaskIntent.update({
        where: { id: intent.id },
        data: { crmTaskId: task.id },
      })

      return { ok: true as const, value: { taskId: task.id, created: true } }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const racedIntent =
        (await prisma.marketingFollowUpTaskIntent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })) ??
        (await prisma.marketingFollowUpTaskIntent.findFirst({
          where: {
            customerAccountId: input.customerAccountId,
            crmContactId: input.contactId,
            policyKey: CALLBACK_POLICY_KEY,
            evaluationId: input.evaluationId,
          },
        }))
      if (racedIntent) {
        if (racedIntent.customerAccountId !== input.customerAccountId) {
          return { ok: false, code: 'CONFLICT', message: 'Idempotency key already used for another account' }
        }
        if (racedIntent.intentFingerprint !== intentFingerprint) {
          return { ok: false, code: 'CONFLICT', message: 'Concurrent callback creation conflict' }
        }
        if (racedIntent.crmTaskId) {
          return { ok: true, value: { taskId: racedIntent.crmTaskId, created: false } }
        }
      }
      return { ok: false, code: 'CONFLICT', message: 'Concurrent callback creation conflict' }
    }
    throw error
  }
}
