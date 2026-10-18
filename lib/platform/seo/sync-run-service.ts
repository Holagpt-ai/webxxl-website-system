import { isSeoGscApiEnabled } from '@/config/seo-backend'
import type { SeoAnalyticsProvider } from '@prisma/client'

export type SeoSyncRunIntent = {
  provider: SeoAnalyticsProvider
  idempotencyKey: string
  status: 'PENDING' | 'SKIPPED'
  dataState: 'FETCHING' | 'NOT_CONNECTED'
  reason?: string
}

export function prepareSeoProviderSyncRun(input: {
  provider: SeoAnalyticsProvider
  connectionDataState: string
  idempotencyKey: string
  oauthEnabled: boolean
  apiEnabled: boolean
}): SeoSyncRunIntent {
  if (!input.oauthEnabled || !input.apiEnabled) {
    return {
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      reason: 'Provider activation disabled',
    }
  }
  if (input.connectionDataState !== 'READY' && input.connectionDataState !== 'PARTIAL') {
    return {
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      status: 'SKIPPED',
      dataState: 'NOT_CONNECTED',
      reason: 'No verified connection',
    }
  }
  return {
    provider: input.provider,
    idempotencyKey: input.idempotencyKey,
    status: 'PENDING',
    dataState: 'FETCHING',
  }
}

export function gscApiEnabledForRuntime(): boolean {
  return isSeoGscApiEnabled()
}
