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

type SyncRunSnapshot = {
  id: string
  customerAccountId: string
  managedSiteId: string
  status: string
  errorClass: string | null
  dataState: SeoDataState
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

async function loadSyncRunByKey(idempotencyKey: string): Promise<SyncRunSnapshot | null> {
  return prisma.seoProviderSyncRun.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      customerAccountId: true,
      managedSiteId: true,
      status: true,
      errorClass: true,
      dataState: true,
    },
  })
}

function assertTenantMatch(existing: SyncRunSnapshot, input: { customerAccountId: string; managedSiteId: string }) {
  if (existing.customerAccountId !== input.customerAccountId || existing.managedSiteId !== input.managedSiteId) {
    throw new Error('Readiness idempotency key tenant mismatch')
  }
}

function classifyExistingRow(
  existing: SyncRunSnapshot,
  input: { errorClass: string; dataState: SeoDataState },
): GoogleReadinessSyncPersistOutcome {
  if (INGESTION_SYNC_RUN_STATUSES.has(existing.status)) {
    return 'BLOCKED_BY_INGESTION_RUN'
  }
  if (existing.status === 'READINESS') {
    if (existing.errorClass === input.errorClass && existing.dataState === input.dataState) {
      return 'IDEMPOTENT_REPLAY'
    }
    return 'UPDATED'
  }
  return 'BLOCKED_BY_INGESTION_RUN'
}

async function guardedUpdateReadinessRow(input: {
  idempotencyKey: string
  customerAccountId: string
  managedSiteId: string
  errorClass: string
  dataState: SeoDataState
  processedAt: Date
}): Promise<{ outcome: GoogleReadinessSyncPersistOutcome; existing: SyncRunSnapshot | null }> {
  const updated = await prisma.seoProviderSyncRun.updateMany({
    where: {
      idempotencyKey: input.idempotencyKey,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      status: 'READINESS',
    },
    data: {
      status: 'READINESS',
      dataState: input.dataState,
      errorClass: input.errorClass,
      processedAt: input.processedAt,
    },
  })

  if (updated.count > 0) {
    const row = await loadSyncRunByKey(input.idempotencyKey)
    if (row && row.errorClass === input.errorClass && row.dataState === input.dataState) {
      return { outcome: 'IDEMPOTENT_REPLAY', existing: row }
    }
    return { outcome: 'UPDATED', existing: row }
  }

  const existing = await loadSyncRunByKey(input.idempotencyKey)
  if (!existing) {
    return { outcome: 'UPDATED', existing: null }
  }
  assertTenantMatch(existing, input)
  return { outcome: classifyExistingRow(existing, input), existing }
}

async function reconcileAfterConflict(input: {
  idempotencyKey: string
  customerAccountId: string
  managedSiteId: string
  errorClass: string
  dataState: SeoDataState
  processedAt: Date
}): Promise<{ outcome: GoogleReadinessSyncPersistOutcome }> {
  const existing = await loadSyncRunByKey(input.idempotencyKey)
  if (!existing) {
    return guardedUpdateReadinessRow(input)
  }
  assertTenantMatch(existing, input)

  const classified = classifyExistingRow(existing, input)
  if (classified === 'BLOCKED_BY_INGESTION_RUN' || classified === 'IDEMPOTENT_REPLAY') {
    return { outcome: classified }
  }

  return guardedUpdateReadinessRow(input)
}

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

  const existing = await loadSyncRunByKey(input.idempotencyKey)
  if (existing) {
    assertTenantMatch(existing, input)
    const classified = classifyExistingRow(existing, { errorClass, dataState })
    if (classified === 'IDEMPOTENT_REPLAY' || classified === 'BLOCKED_BY_INGESTION_RUN') {
      return { outcome: classified }
    }
    const guarded = await guardedUpdateReadinessRow({
      idempotencyKey: input.idempotencyKey,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      errorClass,
      dataState,
      processedAt,
    })
    return { outcome: guarded.outcome }
  }

  try {
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
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    return reconcileAfterConflict({
      idempotencyKey: input.idempotencyKey,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      errorClass,
      dataState,
      processedAt,
    })
  }
}
