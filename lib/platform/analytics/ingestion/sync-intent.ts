import { isAnalyticsIngestionEnabled } from '@/config/analytics-backend'
import { isSeoGoogleOauthEnabled } from '@/config/seo-backend'
import { prepareSeoProviderSyncRun } from '@/lib/platform/seo/sync-run-service'
import type { SeoAnalyticsProvider } from '@prisma/client'

export function prepareAnalyticsProviderSync(input: {
  provider: SeoAnalyticsProvider
  connectionDataState: string
  idempotencyKey: string
  providerApiEnabled: boolean
}) {
  if (!isAnalyticsIngestionEnabled()) {
    return {
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      status: 'SKIPPED' as const,
      dataState: 'NOT_CONNECTED' as const,
      reason: 'Analytics ingestion disabled',
    }
  }
  return prepareSeoProviderSyncRun({
    provider: input.provider,
    connectionDataState: input.connectionDataState,
    idempotencyKey: input.idempotencyKey,
    oauthEnabled: isSeoGoogleOauthEnabled(),
    apiEnabled: input.providerApiEnabled,
  })
}
