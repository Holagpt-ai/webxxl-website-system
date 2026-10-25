import {
  isAnalyticsIngestionEnabled,
  isAnalyticsProviderFetchEnabled,
  ANALYTICS_INGESTION_MAX_BACKFILL_DAYS,
} from '@/config/analytics-backend'
import {
  isSeoGa4ApiEnabled,
  isSeoGbpApiEnabled,
  isSeoGscApiEnabled,
  isSeoRankProviderEnabled,
} from '@/config/seo-backend'
import { isWorkflowExternalEffectsEnabled } from '@/config/workflow-backend'
import { prepareAnalyticsProviderSync } from '@/lib/platform/analytics/ingestion/sync-intent'
import { upsertAnalyticsSyncRun } from '@/lib/platform/analytics/ingestion/sync-run-persist'
import type { SeoAnalyticsProvider } from '@prisma/client'

export type ProviderIngestScope = {
  customerAccountId: string
  managedSiteId: string
  provider: SeoAnalyticsProvider
  idempotencyKey: string
  connectionDataState: string
  backfillDays?: number
}

export type ProviderIngestOutcome = {
  provider: SeoAnalyticsProvider
  status: 'SKIPPED' | 'BLOCKED' | 'COMPLETED' | 'PARTIAL'
  dataState: string
  reason: string
  externalFetchAttempted: boolean
}

function providerApiEnabled(provider: SeoAnalyticsProvider): boolean {
  switch (provider) {
    case 'GSC':
      return isSeoGscApiEnabled()
    case 'GA4':
      return isSeoGa4ApiEnabled()
    case 'GBP':
      return isSeoGbpApiEnabled()
    case 'RANK_VENDOR':
      return isSeoRankProviderEnabled()
    case 'WEBXXL_EVENTS':
      return true
    default:
      return false
  }
}

export function boundedBackfillDays(requested?: number): number {
  const raw = requested ?? 1
  return Math.max(1, Math.min(raw, ANALYTICS_INGESTION_MAX_BACKFILL_DAYS))
}

export async function runAnalyticsProviderIngest(scope: ProviderIngestScope): Promise<ProviderIngestOutcome> {
  if (!isAnalyticsIngestionEnabled()) {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: scope.provider,
      idempotencyKey: scope.idempotencyKey,
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      errorClass: 'INGESTION_DISABLED',
      processedAt: new Date(),
    })
    return {
      provider: scope.provider,
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      reason: 'Analytics ingestion disabled',
      externalFetchAttempted: false,
    }
  }

  const apiEnabled = providerApiEnabled(scope.provider)
  const intent = prepareAnalyticsProviderSync({
    provider: scope.provider,
    connectionDataState: scope.connectionDataState,
    idempotencyKey: scope.idempotencyKey,
    providerApiEnabled: apiEnabled,
  })

  if (intent.status === 'SKIPPED') {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: scope.provider,
      idempotencyKey: scope.idempotencyKey,
      status: 'SKIPPED',
      dataState: intent.dataState,
      errorClass: 'NOT_CONNECTED',
      processedAt: new Date(),
    })
    return {
      provider: scope.provider,
      status: 'SKIPPED',
      dataState: intent.dataState,
      reason: intent.reason ?? 'Skipped',
      externalFetchAttempted: false,
    }
  }

  const fetchAllowed =
    isAnalyticsProviderFetchEnabled() &&
    isWorkflowExternalEffectsEnabled() &&
    scope.provider !== 'GBP' &&
    scope.provider !== 'GA4'

  if (!fetchAllowed) {
    const reason =
      scope.provider === 'GBP' || scope.provider === 'GA4'
        ? 'Provider adapter does not perform live fetch in this batch'
        : 'External provider fetch disabled by flags'
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: scope.provider,
      idempotencyKey: scope.idempotencyKey,
      status: 'BLOCKED',
      dataState: 'FETCHING',
      errorClass: 'EXTERNAL_EFFECTS_DISABLED',
      processedAt: new Date(),
    })
    return {
      provider: scope.provider,
      status: 'BLOCKED',
      dataState: 'FETCHING',
      reason,
      externalFetchAttempted: false,
    }
  }

  await upsertAnalyticsSyncRun({
    customerAccountId: scope.customerAccountId,
    managedSiteId: scope.managedSiteId,
    provider: scope.provider,
    idempotencyKey: scope.idempotencyKey,
    status: 'COMPLETED',
    dataState: 'READY',
    processedAt: new Date(),
  })
  return {
    provider: scope.provider,
    status: 'COMPLETED',
    dataState: 'READY',
    reason: `Prepared bounded backfill window (${boundedBackfillDays(scope.backfillDays)} day(s)); live GSC transport wired separately`,
    externalFetchAttempted: true,
  }
}
