import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function recordCrmDataAccessAudit(input: {
  customerAccountId: string
  actorUserId: string
  operation: 'import.preview' | 'import.commit' | 'export.page'
  resourceRef: string
  detail?: Prisma.InputJsonValue
}) {
  await prisma.crmDataAccessAudit.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      operation: input.operation,
      resourceRef: input.resourceRef,
      detail: input.detail,
    },
  })
}
