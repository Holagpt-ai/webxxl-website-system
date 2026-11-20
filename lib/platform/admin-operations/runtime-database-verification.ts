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

export type DatabaseConnectivityProbe = {
  probeDatabaseUrl: () => Promise<{ ok: boolean; finishedMigrations: number | null }>
  probeDirectUrl: (directUrl: string) => Promise<{ ok: boolean }>
}

async function defaultProbeDatabaseUrl(): Promise<{ ok: boolean; finishedMigrations: number | null }> {
  const { prisma } = await import('@/lib/db')
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`
    const row = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    return { ok: true, finishedMigrations: row[0]?.count ?? null }
  } catch {
    return { ok: false, finishedMigrations: null }
  }
}

async function defaultProbeDirectUrl(directUrl: string): Promise<{ ok: boolean }> {
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

function resolveVerdict(databaseIdentity: string | null, directIdentity: string | null): RuntimeDatabaseVerdict {
  if (!databaseIdentity || !directIdentity) return 'UNVERIFIED'
  if (databaseIdentity !== directIdentity) return 'MISMATCH'
  if (databaseIdentity === PRODUCTION_IDENTITY) return 'VERIFIED_PRODUCTION'
  if (databaseIdentity === STAGING_IDENTITY) return 'VERIFIED_STAGING'
  return 'UNVERIFIED'
}

/**
 * Staff-only runtime check: derive verdict from live env URLs (never logged) + read-only connectivity.
 * Response must remain minimal — no hostnames, refs, or customer data.
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

  const verdict = resolveVerdict(databaseIdentity, directIdentity)

  let databaseUrlConnectivity: ConnectivityState = 'SKIPPED'
  let directUrlConnectivity: ConnectivityState = 'SKIPPED'
  let migrationLedgerFinished: number | null = null

  if (databaseUrl && verdict !== 'MISMATCH') {
    const dbProbe = await probe.probeDatabaseUrl()
    databaseUrlConnectivity = dbProbe.ok ? 'OK' : 'FAIL'
    migrationLedgerFinished = dbProbe.finishedMigrations
  } else if (databaseUrl) {
    databaseUrlConnectivity = 'SKIPPED'
  }

  if (directUrl && urlsAligned) {
    const directProbe = await probe.probeDirectUrl(directUrl)
    directUrlConnectivity = directProbe.ok ? 'OK' : 'FAIL'
  }

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