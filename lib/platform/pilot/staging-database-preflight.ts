/**
 * Fail-closed checks before migration-capable DB operations (probe only in this repo).
 * Never logs passwords or full connection strings.
 *
 * Supabase Session Pooler shares a regional hostname; authorized identity uses the
 * project ref in `postgres.{ref}` (pooler) or `db.{ref}.supabase.co` (direct).
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

const SUPABASE_PROJECT_REF = /^[a-z0-9]{15,25}$/i

type ParsedPostgresUrl = {
  hostPort: string
  database: string
  username: string | null
}

function parsePostgresUrl(connectionUrl: string): ParsedPostgresUrl | null {
  const trimmed = connectionUrl.trim()
  if (!trimmed) return null
  const withoutQuery = trimmed.split('?')[0]!
  const match = withoutQuery.match(/^postgres(?:ql)?:\/\/([^@]*@)?([^/]+)\/([^/]+)?$/i)
  if (!match) return null
  const userinfo = match[1]?.replace(/@$/, '') ?? ''
  const username = userinfo ? decodeURIComponent(userinfo.split(':')[0] ?? '') : null
  const hostPort = match[2]!.toLowerCase()
  const database = (match[3] ?? 'postgres').toLowerCase()
  return { hostPort, database, username }
}

function supabaseProjectRefFromHost(hostPort: string): string | null {
  const host = hostPort.split(':')[0] ?? hostPort
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  if (direct?.[1] && SUPABASE_PROJECT_REF.test(direct[1])) return direct[1]!.toLowerCase()
  return null
}

function supabaseProjectRefFromUsername(username: string | null): string | null {
  if (!username) return null
  const poolerUser = username.match(/^postgres\.([a-z0-9]+)$/i)
  if (poolerUser?.[1] && SUPABASE_PROJECT_REF.test(poolerUser[1])) return poolerUser[1]!.toLowerCase()
  return null
}

function isSupabasePoolerHost(hostPort: string): boolean {
  const host = hostPort.split(':')[0] ?? hostPort
  return host.endsWith('.pooler.supabase.com')
}

/** Stable host/database fingerprint — no credentials (legacy display). */
export function databaseIdentityFromUrl(connectionUrl: string): string | null {
  const parsed = parsePostgresUrl(connectionUrl)
  if (!parsed) return null
  return `${parsed.hostPort}/${parsed.database}`
}

/**
 * Authorized target identity for staging preflight.
 * Supabase: `supabase:{projectRef}/{database}`; otherwise host:port/database.
 */
export function authorizedDatabaseIdentityFromUrl(connectionUrl: string): string | null {
  const parsed = parsePostgresUrl(connectionUrl)
  if (!parsed) return null

  const refFromUser = supabaseProjectRefFromUsername(parsed.username)
  const refFromHost = supabaseProjectRefFromHost(parsed.hostPort)

  if (refFromUser) {
    return `supabase:${refFromUser}/${parsed.database}`
  }
  if (refFromHost) {
    return `supabase:${refFromHost}/${parsed.database}`
  }
  if (isSupabasePoolerHost(parsed.hostPort)) {
    return null
  }
  return `${parsed.hostPort}/${parsed.database}`
}

/** Normalize WEBXXL_*_DATABASE_IDENTITY env values to the same canonical form as URLs. */
export function normalizeDatabaseIdentityEvidence(evidence: string): string | null {
  const trimmed = evidence.trim().toLowerCase()
  if (!trimmed) return null

  const explicit = trimmed.match(/^supabase:([a-z0-9]+)\/([^/]+)$/)
  if (explicit?.[1] && SUPABASE_PROJECT_REF.test(explicit[1])) {
    return `supabase:${explicit[1]}/${explicit[2]}`
  }

  const directHost = trimmed.match(/^db\.([a-z0-9]+)\.supabase\.co:5432\/([^/]+)$/)
  if (directHost?.[1] && SUPABASE_PROJECT_REF.test(directHost[1])) {
    return `supabase:${directHost[1]}/${directHost[2]}`
  }

  if (trimmed.includes('/') && !trimmed.startsWith('supabase:')) {
    return trimmed
  }

  return null
}

export function redactDatabaseTarget(connectionUrl: string): string {
  const id = authorizedDatabaseIdentityFromUrl(connectionUrl) ?? databaseIdentityFromUrl(connectionUrl)
  return id ? `postgres://***@${id}` : 'postgres://***(unparseable)'
}

const STAGING_IDENTITY_KEYS = ['WEBXXL_STAGING_DATABASE_IDENTITY', 'STAGING_DATABASE_IDENTITY'] as const
const PRODUCTION_IDENTITY_KEYS = ['WEBXXL_PRODUCTION_DATABASE_IDENTITY', 'PRODUCTION_DATABASE_IDENTITY'] as const

function readStagingIdentity(env: Record<string, string | undefined>): string | null {
  for (const key of STAGING_IDENTITY_KEYS) {
    const v = env[key]?.trim()
    if (v) return normalizeDatabaseIdentityEvidence(v) ?? v.toLowerCase()
  }
  return null
}

function readProductionIdentity(env: Record<string, string | undefined>): string | null {
  for (const key of PRODUCTION_IDENTITY_KEYS) {
    const v = env[key]?.trim()
    if (v) return normalizeDatabaseIdentityEvidence(v) ?? v.toLowerCase()
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

  const dbIdentity = authorizedDatabaseIdentityFromUrl(databaseUrl)
  const directIdentity = authorizedDatabaseIdentityFromUrl(directUrl)
  if (!dbIdentity || !directIdentity) {
    return {
      ok: false,
      code: 'UNPARSEABLE_URL',
      message:
        'DATABASE_URL or DIRECT_URL is not a recognizable Postgres URL, or Supabase pooler URL is missing postgres.{project-ref} in the username (credentials not logged).',
    }
  }
  if (dbIdentity !== directIdentity) {
    return {
      ok: false,
      code: 'MISMATCHED_TARGETS',
      message:
        'DATABASE_URL and DIRECT_URL must reference the same authorized staging database (Supabase project ref or host/database).',
    }
  }

  const expectedStaging = readStagingIdentity(env)
  if (!expectedStaging) {
    return {
      ok: false,
      code: 'MISSING_STAGING_IDENTITY',
      message:
        'Set WEBXXL_STAGING_DATABASE_IDENTITY to the authorized staging fingerprint (supabase:{project-ref}/postgres or host:port/database, no secrets).',
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
