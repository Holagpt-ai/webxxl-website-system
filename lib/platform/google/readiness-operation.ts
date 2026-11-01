import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import { assessGoogleProviderReadinessRow } from '@/lib/platform/google/readiness-assess'
import { buildGoogleReadinessSyncIdempotencyKey } from '@/lib/platform/google/readiness-idempotency'
import { validateGoogleReadinessClientRequestKey } from '@/lib/platform/google/readiness-request-validate'
import { recordGoogleReadinessSyncRun } from '@/lib/platform/google/readiness-sync-persist'
import {
  type GoogleAnalyticsProviderKey,
  type GoogleReadinessOperationOutcome,
  type StoredGoogleConnectionSnapshot,
} from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

export { parseGoogleReadinessProvidersBody as parseGoogleReadinessProviders } from '@/lib/platform/google/readiness-request-validate'

export async function runBoundedGoogleReadinessOperation(input: {
  customerAccountId: string
  managedSiteId: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
  connections: StoredGoogleConnectionSnapshot[]
  providers: GoogleAnalyticsProviderKey[]
  clientRequestKey: string
  assessedAt?: Date
}): Promise<SeoResult<{ outcomes: GoogleReadinessOperationOutcome[] }>> {
  if (!isGoogleProviderReadinessEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Google provider readiness module disabled' }
  }
  const requestKey = validateGoogleReadinessClientRequestKey(input.clientRequestKey)
  if (!requestKey.ok) return requestKey

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

    const idempotencyKey = buildGoogleReadinessSyncIdempotencyKey({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider,
      clientRequestKey: requestKey.value.normalized,
    })

    const persist = await recordGoogleReadinessSyncRun({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider,
      idempotencyKey,
      readinessState: row.readinessState,
      processedAt: input.assessedAt,
    })

    let syncRunStatus: GoogleReadinessOperationOutcome['syncRunStatus'] = 'READINESS_RECORDED'
    let reason = row.limitations[0] ?? row.readinessState
    if (persist.outcome === 'IDEMPOTENT_REPLAY') {
      syncRunStatus = 'READINESS_REPLAY'
      reason = 'Idempotent readiness replay; sync run unchanged'
    } else if (persist.outcome === 'BLOCKED_BY_INGESTION_RUN') {
      syncRunStatus = 'INGESTION_RUN_UNTOUCHED'
      reason = 'Existing provider ingestion sync run preserved; readiness not persisted'
    }

    outcomes.push({
      provider,
      readinessState: row.readinessState,
      syncRunStatus,
      idempotencyKey,
      reason,
      externalFetchAttempted: false,
    })
  }

  return { ok: true, value: { outcomes } }
}
