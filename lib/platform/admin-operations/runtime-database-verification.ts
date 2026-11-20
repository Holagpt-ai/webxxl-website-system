import { PrismaClient } from '@prisma/client'
import { authorizedDatabaseIdentityFromUrl } from '@/lib/platform/pilot/staging-database-preflight'
import {
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type RuntimeDatabaseVerdict =
  | 'VERIFIED_PRODUCTION'
  | 'VERIFIED_STAGING'
  | 'MISMATCH'
  | 'UNVERIFIED'

export type ConnectivityState = 'OK' | 'FAIL' | 'SKIPPED'

/** Production release gate (Step 6A): finished ledger rows must match repo chain. */
export const EXPECTED_PRODUCTION_FINISHED_MIGRATIONS = 40

/** Bound probe wait (direct IPv6 / pooler stalls must not hang staff requests). */
export const DATABASE_PROBE_TIMEOUT_MS = 12_000

export type RuntimeDatabaseVerificationResult = {
  verdict: RuntimeDatabaseVerdict
  configuration: {
    urlsConfigured: boolean
    urlsAligned: boolean
  }
  connectivity: {
    databaseUrl: ConnectivityState
    directUrl: ConnectivityState
    migrationLedgerFinished: number | null
  }
}

const PRODUCTION_IDENTITY = `supabase:${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}/postgres` as const
const STAGING_IDENTITY = `supabase:${WEBXXL_RECORDED_STAGING_SUPABASE_REF}/postgres` as const

type ConfigurationTarget = 'PRODUCTION' | 'STAGING' | 'MISMATCH' | 'UNVERIFIED'

export type DatabaseConnectivityProbe = {
  probeDatabaseUrl: () => Promise<{ ok: boolean; finishedMigrations: number | null }>
  probeDirectUrl: (directUrl: string) => Promise<{ ok: boolean }>
}

export async function withProbeTimeout<T>(
  work: Promise<T>,
  timeoutMs: number = DATABASE_PROBE_TIMEOUT_MS,
): Promise<T | 'TIMEOUT'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<'TIMEOUT'>((resolve) => {
        timer = setTimeout(() => resolve('TIMEOUT'), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function probeDatabaseUrlInner(): Promise<{ ok: boolean; finishedMigrations: number | null }> {
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.$queryRaw`SELECT 1 AS ok`
    const row = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    return { ok: true, finishedMigrations: row[0]?.count ?? null }
  } catch {
    return { ok: false, finishedMigrations: null }
  }
}

async function defaultProbeDatabaseUrl(): Promise<{ ok: boolean; finishedMigrations: number | null }> {
  return probeDatabaseUrlInner()
}

async function probeDirectUrlInner(directUrl: string): Promise<{ ok: boolean }> {
  const client = new PrismaClient({ datasourceUrl: directUrl })
  try {
    await client.$queryRaw`SELECT 1 AS ok`
    return { ok: true }
  } catch {
    return { ok: false }
  } finally {
    await client.$disconnect()
  }
}

async function defaultProbeDirectUrl(directUrl: string): Promise<{ ok: boolean }> {
  return probeDirectUrlInner(directUrl)
}

function resolveConfigurationTarget(
  databaseIdentity: string | null,
  directIdentity: string | null,
): ConfigurationTarget {
  if (!databaseIdentity || !directIdentity) return 'UNVERIFIED'
  if (databaseIdentity !== directIdentity) return 'MISMATCH'
  if (databaseIdentity === PRODUCTION_IDENTITY) return 'PRODUCTION'
  if (databaseIdentity === STAGING_IDENTITY) return 'STAGING'
  return 'UNVERIFIED'
}

function finalizeVerdict(
  config: ConfigurationTarget,
  databaseUrlConnectivity: ConnectivityState,
  directUrlConnectivity: ConnectivityState,
  migrationLedgerFinished: number | null,
): RuntimeDatabaseVerdict {
  if (config === 'MISMATCH') return 'MISMATCH'
  if (config === 'UNVERIFIED') return 'UNVERIFIED'

  const connectivityPass =
    databaseUrlConnectivity === 'OK' && directUrlConnectivity === 'OK'
  if (!connectivityPass) return 'UNVERIFIED'

  if (config === 'STAGING') return 'VERIFIED_STAGING'

  if (migrationLedgerFinished !== EXPECTED_PRODUCTION_FINISHED_MIGRATIONS) return 'UNVERIFIED'

  return 'VERIFIED_PRODUCTION'
}

/**
 * Staff-only runtime check: live env URLs (never logged) + bounded read-only connectivity.
 * Configuration identity alone never yields VERIFIED_PRODUCTION.
 */
export async function evaluateRuntimeDatabaseVerification(
  env: Record<string, string | undefined>,
  probe: DatabaseConnectivityProbe = {
    probeDatabaseUrl: defaultProbeDatabaseUrl,
    probeDirectUrl: defaultProbeDirectUrl,
  },
): Promise<RuntimeDatabaseVerificationResult> {
  const databaseUrl = env.DATABASE_URL?.trim()
  const directUrl = env.DIRECT_URL?.trim()
  const urlsConfigured = Boolean(databaseUrl && directUrl)

  const databaseIdentity = databaseUrl ? authorizedDatabaseIdentityFromUrl(databaseUrl) : null
  const directIdentity = directUrl ? authorizedDatabaseIdentityFromUrl(directUrl) : null
  const urlsAligned = Boolean(databaseIdentity && directIdentity && databaseIdentity === directIdentity)

  const configTarget = resolveConfigurationTarget(databaseIdentity, directIdentity)

  let databaseUrlConnectivity: ConnectivityState = 'SKIPPED'
  let directUrlConnectivity: ConnectivityState = 'SKIPPED'
  let migrationLedgerFinished: number | null = null

  if (databaseUrl && configTarget !== 'MISMATCH') {
    const raced = await withProbeTimeout(probe.probeDatabaseUrl())
    const dbProbe =
      raced === 'TIMEOUT' ? { ok: false, finishedMigrations: null as number | null } : raced
    databaseUrlConnectivity = dbProbe.ok ? 'OK' : 'FAIL'
    migrationLedgerFinished = dbProbe.finishedMigrations
  }

  if (directUrl && urlsAligned) {
    const raced = await withProbeTimeout(probe.probeDirectUrl(directUrl))
    const directOk = raced === 'TIMEOUT' ? false : raced.ok
    directUrlConnectivity = directOk ? 'OK' : 'FAIL'
  }

  const verdict = finalizeVerdict(
    configTarget,
    databaseUrlConnectivity,
    directUrlConnectivity,
    migrationLedgerFinished,
  )

  return {
    verdict,
    configuration: { urlsConfigured, urlsAligned },
    connectivity: {
      databaseUrl: databaseUrlConnectivity,
      directUrl: directUrlConnectivity,
      migrationLedgerFinished,
    },
  }
}