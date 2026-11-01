import {
  GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION,
  isGoogleProviderReadinessEnabled,
} from '@/config/google-integration'
import { upsertAnalyticsSyncRun } from '@/lib/platform/analytics/ingestion/sync-run-persist'
import { assessGoogleProviderReadinessRow } from '@/lib/platform/google/readiness-assess'
import {
  GOOGLE_ANALYTICS_PROVIDERS,
  type GoogleAnalyticsProviderKey,
  type GoogleReadinessOperationOutcome,
  type StoredGoogleConnectionSnapshot,
} from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

export function parseGoogleReadinessProviders(
  requested: GoogleAnalyticsProviderKey[] | undefined,
): SeoResult<{ providers: GoogleAnalyticsProviderKey[] }> {
  const list = requested?.length ? requested : [...GOOGLE_ANALYTICS_PROVIDERS]
  if (list.length > GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: `At most ${GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION} providers per readiness operation`,
    }
  }
  for (const p of list) {
    if (!GOOGLE_ANALYTICS_PROVIDERS.includes(p)) {
      return { ok: false, code: 'VALIDATION', message: `Unsupported provider ${p}` }
    }
  }
  return { ok: true, value: { providers: list } }
}

export async function runBoundedGoogleReadinessOperation(input: {
  customerAccountId: string
  managedSiteId: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
  connections: StoredGoogleConnectionSnapshot[]
  providers: GoogleAnalyticsProviderKey[]
  idempotencyKey: string
  assessedAt?: Date
}): Promise<SeoResult<{ outcomes: GoogleReadinessOperationOutcome[] }>> {
  if (!isGoogleProviderReadinessEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Google provider readiness module disabled' }
  }
  if (!input.idempotencyKey.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key required' }
  }

  const outcomes: GoogleReadinessOperationOutcome[] = []
  const scoped = input.connections.filter(
    (c) => c.managedSiteId === input.managedSiteId && c.customerAccountId === input.customerAccountId,
  )

  for (const provider of input.providers) {
    const row = assessGoogleProviderReadinessRow({
      provider,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      authorizedHosts: input.authorizedHosts,
      siteCanonicalUrl: input.siteCanonicalUrl,
      connections: scoped,
      assessedAt: input.assessedAt,
    })

    const dataState =
      row.readinessState === 'READY_FOR_INGEST'
        ? 'READY'
        : row.readinessState === 'PENDING_VERIFICATION'
          ? 'PARTIAL'
          : row.readinessState === 'NOT_SUPPORTED'
            ? 'NOT_CONNECTED'
            : 'NOT_CONNECTED'

    await upsertAnalyticsSyncRun({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider,
      idempotencyKey: `${input.idempotencyKey}:${provider}`,
      status: 'READINESS',
      dataState,
      errorClass: `GOOGLE_READINESS_${row.readinessState}`,
      processedAt: input.assessedAt ?? new Date(),
    })

    outcomes.push({
      provider,
      readinessState: row.readinessState,
      syncRunStatus: 'READINESS_RECORDED',
      idempotencyKey: `${input.idempotencyKey}:${provider}`,
      reason: row.limitations[0] ?? row.readinessState,
      externalFetchAttempted: false,
    })
  }

  return { ok: true, value: { outcomes } }
}
