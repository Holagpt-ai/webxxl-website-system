import {
  isAnalyticsIngestionEnabled,
  isAnalyticsProviderFetchEnabled,
  isAnalyticsGscLiveTransportEnabled,
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
import { runGscProviderIngest, noopGscTransport, type GscIngestDeps } from '@/lib/platform/analytics/ingestion/gsc-ingest'
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

export type ProviderIngestRuntimeDeps = {
  gsc?: Partial<GscIngestDeps> & { allowNetwork?: boolean }
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

function externalFetchGateOpen(): boolean {
  return isAnalyticsProviderFetchEnabled() && isWorkflowExternalEffectsEnabled()
}

async function recordBlocked(scope: ProviderIngestScope, input: {
  reason: string
  dataState: string
  errorClass: string
}): Promise<ProviderIngestOutcome> {
  await upsertAnalyticsSyncRun({
    customerAccountId: scope.customerAccountId,
    managedSiteId: scope.managedSiteId,
    provider: scope.provider,
    idempotencyKey: scope.idempotencyKey,
    status: 'BLOCKED',
    dataState: input.dataState as never,
    errorClass: input.errorClass,
    processedAt: new Date(),
  })
  return {
    provider: scope.provider,
    status: 'BLOCKED',
    dataState: input.dataState,
    reason: input.reason,
    externalFetchAttempted: false,
  }
}

export async function runAnalyticsProviderIngest(
  scope: ProviderIngestScope,
  deps: ProviderIngestRuntimeDeps = {},
): Promise<ProviderIngestOutcome> {
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

  if (scope.provider === 'GA4' || scope.provider === 'GBP') {
    return recordBlocked(scope, {
      reason: 'Live provider ingest adapter not available for this provider',
      dataState: 'NOT_CONNECTED',
      errorClass: 'NOT_SUPPORTED',
    })
  }

  if (scope.provider === 'RANK_VENDOR') {
    return recordBlocked(scope, {
      reason: 'Rank vendor ingest requires licensed provider activation',
      dataState: 'NOT_CONNECTED',
      errorClass: 'NOT_CONNECTED',
    })
  }

  if (scope.provider === 'WEBXXL_EVENTS') {
    await upsertAnalyticsSyncRun({
      customerAccountId: scope.customerAccountId,
      managedSiteId: scope.managedSiteId,
      provider: scope.provider,
      idempotencyKey: scope.idempotencyKey,
      status: 'SKIPPED',
      dataState: 'READY',
      errorClass: 'FIRST_PARTY_ONLY',
      processedAt: new Date(),
    })
    return {
      provider: scope.provider,
      status: 'SKIPPED',
      dataState: 'READY',
      reason: 'First-party events use capture API and aggregation jobs, not provider fetch',
      externalFetchAttempted: false,
    }
  }

  if (!externalFetchGateOpen()) {
    return recordBlocked(scope, {
      reason: 'External provider fetch disabled by flags',
      dataState: 'FETCHING',
      errorClass: 'EXTERNAL_EFFECTS_DISABLED',
    })
  }

  if (scope.provider === 'GSC') {
    const allowNetwork = deps.gsc?.allowNetwork ?? isAnalyticsGscLiveTransportEnabled()
    if (!allowNetwork) {
      return recordBlocked(scope, {
        reason: 'GSC live transport not activated for this deployment',
        dataState: 'FETCHING',
        errorClass: 'NOT_CONFIGURED',
      })
    }
    const gscDeps: GscIngestDeps = {
      transport: deps.gsc?.transport ?? noopGscTransport,
      resolveAccessTokenRef:
        deps.gsc?.resolveAccessTokenRef ??
        (async () => {
          return null
        }),
    }
    return runGscProviderIngest(scope, gscDeps)
  }

  return recordBlocked(scope, {
    reason: 'Unsupported analytics provider',
    dataState: 'NOT_CONNECTED',
    errorClass: 'NOT_SUPPORTED',
  })
}
