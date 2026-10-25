import { prisma } from '@/lib/db'
import { isAnalyticsIngestionEnabled } from '@/config/analytics-backend'
import { runAnalyticsProviderIngest } from '@/lib/platform/analytics/ingestion/provider-ingest'
import type { SeoAnalyticsProvider } from '@prisma/client'

export type AnalyticsWorkerBatchResult = {
  processed: number
  outcomes: Array<{ managedSiteId: string; provider: string; status: string; reason: string }>
}

const DEFAULT_PROVIDERS: SeoAnalyticsProvider[] = ['GSC', 'GA4', 'GBP', 'RANK_VENDOR']

export async function runAnalyticsIngestionWorkerBatch(input?: {
  limit?: number
  providers?: SeoAnalyticsProvider[]
}): Promise<AnalyticsWorkerBatchResult> {
  if (!isAnalyticsIngestionEnabled()) {
    return { processed: 0, outcomes: [] }
  }
  const limit = input?.limit ?? 10
  const providers = input?.providers ?? DEFAULT_PROVIDERS
  const connections = await prisma.siteAnalyticsConnection.findMany({
    where: { revokedAt: null },
    take: limit,
    orderBy: { updatedAt: 'asc' },
    select: {
      customerAccountId: true,
      managedSiteId: true,
      provider: true,
      dataState: true,
    },
  })
  const outcomes: AnalyticsWorkerBatchResult['outcomes'] = []
  for (const connection of connections) {
    if (!providers.includes(connection.provider)) continue
    const idempotencyKey = `analytics-worker:${connection.managedSiteId}:${connection.provider}:${new Date().toISOString().slice(0, 10)}`
    const result = await runAnalyticsProviderIngest({
      customerAccountId: connection.customerAccountId,
      managedSiteId: connection.managedSiteId,
      provider: connection.provider,
      idempotencyKey,
      connectionDataState: connection.dataState,
    })
    outcomes.push({
      managedSiteId: connection.managedSiteId,
      provider: connection.provider,
      status: result.status,
      reason: result.reason,
    })
  }
  return { processed: outcomes.length, outcomes }
}
