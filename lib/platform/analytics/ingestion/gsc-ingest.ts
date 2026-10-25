import { prisma } from '@/lib/db'
import type { GscHttpTransport } from '@/lib/platform/seo/gsc-http'
import { queryGscSearchAnalytics } from '@/lib/platform/seo/gsc-http'
import { normalizeGscSearchAnalyticsResponse } from '@/lib/platform/seo/gsc-normalize'
import { persistGscDailyMetrics } from '@/lib/platform/analytics/ingestion/persist-observations'
import type { ProviderIngestOutcome, ProviderIngestScope } from '@/lib/platform/analytics/ingestion/provider-ingest'
import { upsertAnalyticsSyncRun } from '@/lib/platform/analytics/ingestion/sync-run-persist'

export type GscIngestDeps = {
  transport: GscHttpTransport
  resolveAccessTokenRef: (input: {
    customerAccountId: string
    managedSiteId: string
    secretRef: string | null
  }) => Promise<string | null>
}

/** No network I/O — used when external fetch is not authorized for this deployment. */
export const noopGscTransport: GscHttpTransport = {
  async postJson() {
    return { status: 503, json: { rows: [] }, errorMessage: 'GSC transport disabled' }
  },
}

export async function runGscProviderIngest(
  scope: ProviderIngestScope,
  deps: GscIngestDeps,
): Promise<ProviderIngestOutcome & { persistedKeywords?: number; persistedMetrics?: number }> {
  const connection = await prisma.siteAnalyticsConnection.findFirst({
    where: {
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: 'GSC',
      revokedAt: null,
    },
  })
  if (!connection || (connection.dataState !== 'READY' && connection.dataState !== 'PARTIAL')) {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: 'GSC',
      idempotencyKey: scope.idempotencyKey,
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      errorClass: 'NO_CONNECTION',
      processedAt: new Date(),
    })
    return {
      provider: 'GSC',
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      reason: 'No verified GSC connection',
      externalFetchAttempted: false,
    }
  }

  const tokenRef = await deps.resolveAccessTokenRef({
    customerAccountId: scope.customerAccountId,
    managedSiteId: scope.managedSiteId,
    secretRef: connection.secretRef,
  })
  if (!tokenRef) {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: 'GSC',
      idempotencyKey: scope.idempotencyKey,
      status: 'BLOCKED',
      dataState: connection.dataState,
      errorClass: 'NOT_CONFIGURED',
      processedAt: new Date(),
    })
    return {
      provider: 'GSC',
      status: 'BLOCKED',
      dataState: connection.dataState,
      reason: 'GSC OAuth token not configured',
      externalFetchAttempted: false,
    }
  }

  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 1)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const queried = await queryGscSearchAnalytics({
    transport: deps.transport,
    propertyRef: connection.propertyRef,
    accessTokenRef: tokenRef,
    body: {
      startDate,
      endDate,
      dimensions: ['date', 'query', 'page'],
      rowLimit: 250,
    },
  })

  const externalFetchAttempted = true

  if (!queried.ok) {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: 'GSC',
      idempotencyKey: scope.idempotencyKey,
      status: 'BLOCKED',
      dataState: 'FETCHING',
      errorClass: queried.code,
      processedAt: new Date(),
    })
    return {
      provider: 'GSC',
      status: 'BLOCKED',
      dataState: 'FETCHING',
      reason: queried.message,
      externalFetchAttempted,
    }
  }

  const normalized = normalizeGscSearchAnalyticsResponse({
    propertyRef: connection.propertyRef,
    request: { startDate, endDate, dimensions: ['date', 'query', 'page'] },
    response: queried.response,
    observedAt: new Date(),
  })

  const persisted = await persistGscDailyMetrics({
    customerAccountId: scope.customerAccountId,
    managedSiteId: scope.managedSiteId,
    provider: 'GSC',
    propertyRef: connection.propertyRef,
    rows: normalized.rows,
    observedAt: new Date(),
    dataState: normalized.dataState,
  })

  const hasEvidence = persisted.metrics > 0 || persisted.keywords > 0
  await upsertAnalyticsSyncRun({
    customerAccountId: scope.customerAccountId,
    managedSiteId: scope.managedSiteId,
    provider: 'GSC',
    idempotencyKey: scope.idempotencyKey,
    status: hasEvidence ? 'COMPLETED' : 'PARTIAL',
    dataState: hasEvidence ? 'READY' : 'PARTIAL',
    errorClass: hasEvidence ? null : 'NO_ROWS',
    processedAt: new Date(),
  })

  return {
    provider: 'GSC',
    status: hasEvidence ? 'COMPLETED' : 'PARTIAL',
    dataState: hasEvidence ? 'READY' : 'PARTIAL',
    reason: hasEvidence
      ? `Persisted ${persisted.metrics} daily metrics and ${persisted.keywords} keyword rows`
      : 'GSC response contained no persistable rows',
    externalFetchAttempted,
    persistedKeywords: persisted.keywords,
    persistedMetrics: persisted.metrics,
  }
}
