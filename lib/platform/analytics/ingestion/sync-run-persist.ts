import { prisma } from '@/lib/db'
import type { SeoAnalyticsProvider, SeoDataState } from '@prisma/client'

export async function upsertAnalyticsSyncRun(input: {
  customerAccountId: string
  managedSiteId: string
  provider: SeoAnalyticsProvider
  idempotencyKey: string
  status: string
  dataState: SeoDataState
  errorClass?: string | null
  processedAt?: Date | null
}) {
  return prisma.seoProviderSyncRun.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      dataState: input.dataState,
      errorClass: input.errorClass ?? null,
      processedAt: input.processedAt ?? null,
    },
    update: {
      status: input.status,
      dataState: input.dataState,
      errorClass: input.errorClass ?? null,
      processedAt: input.processedAt ?? new Date(),
    },
  })
}
