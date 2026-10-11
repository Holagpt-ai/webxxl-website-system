import { prisma } from '@/lib/db'
import type { InfrastructureAssetType, Prisma } from '@prisma/client'

export async function writeInfrastructureActivity(input: {
  assetType: InfrastructureAssetType
  assetId: string
  customerAccountId: string
  actorUserId?: string | null
  summary: string
  metadata?: Prisma.InputJsonValue
}) {
  return prisma.infrastructureActivity.create({
    data: {
      assetType: input.assetType,
      assetId: input.assetId,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  })
}
