import { createHash } from 'node:crypto'
import type { GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

export const GOOGLE_READINESS_IDEMPOTENCY_PREFIX = 'google-readiness:v1'

/** Ingestion/worker keys must not share this prefix (see analytics-sync / analytics-worker). */
export function buildGoogleReadinessSyncIdempotencyKey(input: {
  customerAccountId: string
  managedSiteId: string
  provider: GoogleAnalyticsProviderKey
  clientRequestKey: string
}): string {
  const digest = createHash('sha256').update(input.clientRequestKey, 'utf8').digest('hex').slice(0, 24)
  return [
    GOOGLE_READINESS_IDEMPOTENCY_PREFIX,
    input.customerAccountId,
    input.managedSiteId,
    input.provider,
    digest,
  ].join(':')
}

export function isGoogleReadinessSyncIdempotencyKey(key: string): boolean {
  return key.startsWith(`${GOOGLE_READINESS_IDEMPOTENCY_PREFIX}:`)
}
