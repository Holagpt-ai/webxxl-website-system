import type { Prisma, PrismaClient } from '@prisma/client'
import type { WorkflowJobStatus } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export async function recordWorkflowEvent(
  db: Db,
  input: {
    workflowJobId: string
    eventType: string
    fromStatus?: WorkflowJobStatus | null
    toStatus?: WorkflowJobStatus | null
    actorUserId?: string | null
    actorService?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  await db.workflowEvent.create({
    data: {
      workflowJobId: input.workflowJobId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? undefined,
      toStatus: input.toStatus ?? undefined,
      actorUserId: input.actorUserId ?? undefined,
      actorService: input.actorService ?? undefined,
      detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
