import { prisma } from '@/lib/db'
import type { GoogleProviderReadinessState } from '@/lib/platform/google/types'
import type { SeoAnalyticsProvider, SeoDataState } from '@prisma/client'

/** Status values written by analytics ingestion / worker — never overwrite from readiness. */
const INGESTION_SYNC_RUN_STATUSES = new Set([
  'PENDING',
  'SKIPPED',
  'BLOCKED',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
])

export type GoogleReadinessSyncPersistOutcome =
  | 'CREATED'
  | 'UPDATED'
  | 'IDEMPOTENT_REPLAY'
  | 'BLOCKED_BY_INGESTION_RUN'

/**
 * Readiness-only sync run row: status READINESS, dataState NOT_CONNECTED (never implies fetched metrics).
 */
export async function recordGoogleReadinessSyncRun(input: {
  customerAccountId: string
  managedSiteId: string
  provider: SeoAnalyticsProvider
  idempotencyKey: string
  readinessState: GoogleProviderReadinessState
  processedAt?: Date
}): Promise<{ outcome: GoogleReadinessSyncPersistOutcome }> {
  const processedAt = input.processedAt ?? new Date()
  const errorClass = `GOOGLE_READINESS_${input.readinessState}`
  const dataState: SeoDataState = 'NOT_CONNECTED'

  const existing = await prisma.seoProviderSyncRun.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      id: true,
      customerAccountId: true,
      managedSiteId: true,
      status: true,
      errorClass: true,
      dataState: true,
    },
  })

  if (existing) {
    if (
      existing.customerAccountId !== input.customerAccountId ||
      existing.managedSiteId !== input.managedSiteId
    ) {
      throw new Error('Readiness idempotency key tenant mismatch')
    }
    if (existing.status === 'READINESS') {
      if (existing.errorClass === errorClass && existing.dataState === dataState) {
        return { outcome: 'IDEMPOTENT_REPLAY' }
      }
      await prisma.seoProviderSyncRun.update({
        where: { idempotencyKey: input.idempotencyKey },
        data: {
          status: 'READINESS',
          dataState,
          errorClass,
          processedAt,
        },
      })
      return { outcome: 'UPDATED' }
    }
    if (INGESTION_SYNC_RUN_STATUSES.has(existing.status)) {
      return { outcome: 'BLOCKED_BY_INGESTION_RUN' }
    }
    await prisma.seoProviderSyncRun.update({
      where: { idempotencyKey: input.idempotencyKey },
      data: {
        status: 'READINESS',
        dataState,
        errorClass,
        processedAt,
      },
    })
    return { outcome: 'UPDATED' }
  }

  await prisma.seoProviderSyncRun.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: input.provider,
      idempotencyKey: input.idempotencyKey,
      status: 'READINESS',
      dataState,
      errorClass,
      processedAt,
    },
  })
  return { outcome: 'CREATED' }
}
