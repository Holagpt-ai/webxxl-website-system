import { prisma } from '@/lib/db'
import type { ServiceOrderActivityType, Prisma } from '@prisma/client'

export async function writeServiceOrderActivity(input: {
  orderId: string
  actorUserId?: string | null
  type: ServiceOrderActivityType
  summary: string
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.serviceOrderActivity.create({
    data: {
      orderId: input.orderId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  })
}
