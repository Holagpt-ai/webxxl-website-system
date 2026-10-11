import { prisma } from '@/lib/db'
import type { LeadActivityType, Prisma } from '@prisma/client'

export async function writeLeadActivity(input: {
  leadId: string
  actorUserId?: string | null
  type: LeadActivityType
  summary: string
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.leadActivity.create({
    data: {
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  })
}
