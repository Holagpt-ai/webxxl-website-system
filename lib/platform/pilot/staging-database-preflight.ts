/**
 * Fail-closed checks before migration-capable DB operations (probe only in this repo).
 * Never logs passwords or full connection strings.
 */

export type StagingDbPreflightCode =
  | 'MISSING_DATABASE_URL'
  | 'MISSING_DIRECT_URL'
  | 'MISMATCHED_TARGETS'
  | 'UNPARSEABLE_URL'
  | 'MISSING_STAGING_IDENTITY'
  | 'IDENTITY_MISMATCH'
  | 'PRODUCTION_IDENTITY_COLLISION'
  | 'BOUNDARIES_NOT_CONFIRMED'

export type StagingDbPreflightResult =
  | { ok: true; identity: string }
  | { ok: false; code: StagingDbPreflightCode; message: string }

/** Stable host/database fingerprint — no credentials. */
export function databaseIdentityFromUrl(connectionUrl: string): string | null {
  const trimmed = connectionUrl.trim()
  if (!trimmed) return null
  const withoutQuery = trimmed.split('?')[0]!
  const match = withoutQuery.match(/^postgres(?:ql)?:\/\/(?:[^@]*@)?([^/]+)\/([^/]+)?$/i)
  if (!match) return null
  const hostPort = match[1]!.toLowerCase()
  const database = (match[2] ?? 'postgres').toLowerCase()
  return `${hostPort}/${database}`
}

export function redactDatabaseTarget(connectionUrl: string): string {
  const id = databaseIdentityFromUrl(connectionUrl)
  return id ? `postgres://***@${id}` : 'postgres://***(unparseable)'
}

const STAGING_IDENTITY_KEYS = ['WEBXXL_STAGING_DATABASE_IDENTITY', 'STAGING_DATABASE_IDENTITY'] as const
const PRODUCTION_IDENTITY_KEYS = ['WEBXXL_PRODUCTION_DATABASE_IDENTITY', 'PRODUCTION_DATABASE_IDENTITY'] as const

function readStagingIdentity(env: Record<string, string | undefined>): string | null {
  for (const key of STAGING_IDENTITY_KEYS) {
    const v = env[key]?.trim()
    if (v) return v.toLowerCase()
  }
  return null
}

function readProductionIdentity(env: Record<string, string | undefined>): string | null {
  for (const key of PRODUCTION_IDENTITY_KEYS) {
    const v = env[key]?.trim()
    if (v) return v.toLowerCase()
  }
  return null
}

/** Shared URL + identity checks for probes and migration rehearsal verification. */
export function verifyStagingDatabaseConnectionPair(
  env: Record<string, string | undefined>,
): StagingDbPreflightResult {
  const databaseUrl = env.DATABASE_URL?.trim()
  const directUrl = env.DIRECT_URL?.trim()

  if (!databaseUrl) {
    return { ok: false, code: 'MISSING_DATABASE_URL', message: 'DATABASE_URL is not set for staging preflight.' }
  }
  if (!directUrl) {
    return {
      ok: false,
      code: 'MISSING_DIRECT_URL',
      message: 'DIRECT_URL is not set — bind both URLs to the same authorized staging target.',
    }
  }

  const dbIdentity = databaseIdentityFromUrl(databaseUrl)
  const directIdentity = databaseIdentityFromUrl(directUrl)
  if (!dbIdentity || !directIdentity) {
    return {
      ok: false,
      code: 'UNPARSEABLE_URL',
      message: 'DATABASE_URL or DIRECT_URL is not a recognizable Postgres URL (credentials not logged).',
    }
  }
  if (dbIdentity !== directIdentity) {
    return {
      ok: false,
      code: 'MISMATCHED_TARGETS',
      message: 'DATABASE_URL and DIRECT_URL must reference the same staging host and database.',
    }
  }

  const expectedStaging = readStagingIdentity(env)
  if (!expectedStaging) {
    return {
      ok: false,
      code: 'MISSING_STAGING_IDENTITY',
      message:
        'Set WEBXXL_STAGING_DATABASE_IDENTITY to the authorized staging host/database fingerprint (no secrets).',
    }
  }

  if (dbIdentity !== expectedStaging) {
    return {
      ok: false,
      code: 'IDENTITY_MISMATCH',
      message: 'Connection targets do not match WEBXXL_STAGING_DATABASE_IDENTITY.',
    }
  }

  const productionIdentity = readProductionIdentity(env)
  if (productionIdentity && (productionIdentity === dbIdentity || productionIdentity === expectedStaging)) {
    return {
      ok: false,
      code: 'PRODUCTION_IDENTITY_COLLISION',
      message: 'Staging database identity matches recorded production identity — abort.',
    }
  }

  return { ok: true, identity: dbIdentity }
}

/** Migration deploy runbook / operator verification — requires explicit operator confirmation. */
export function verifyStagingDatabaseConnections(
  env: Record<string, string | undefined>,
): StagingDbPreflightResult {
  const pair = verifyStagingDatabaseConnectionPair(env)
  if (!pair.ok) return pair
  if (env.WEBXXL_STAGING_BOUNDARIES_CONFIRMED !== '1') {
    return {
      ok: false,
      code: 'BOUNDARIES_NOT_CONFIRMED',
      message:
        'Set WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1 after independent verification that this identity is staging-only.',
    }
  }
  return pair
}
