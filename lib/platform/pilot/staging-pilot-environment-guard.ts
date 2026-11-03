import {
  authorizedDatabaseIdentityFromUrl,
  verifyStagingDatabaseConnectionPair,
} from '@/lib/platform/pilot/staging-database-preflight'
import {
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type StagingPilotFixtureGuardCode =
  | 'APPLY_NOT_AUTHORIZED'
  | 'PRODUCTION_DATABASE_URL'
  | 'PRODUCTION_IDENTITY_COLLISION'
  | 'PRODUCTION_REF_IN_TARGET'
  | 'STAGING_PREFLIGHT_BLOCKED'

export type StagingPilotFixtureGuardResult =
  | { ok: true; mode: 'dry-run'; stagingIntent: true }
  | { ok: false; code: StagingPilotFixtureGuardCode; message: string }

function connectionTargetsProductionRef(connectionUrl: string): boolean {
  const identity = authorizedDatabaseIdentityFromUrl(connectionUrl)?.toLowerCase() ?? ''
  const legacy = connectionUrl.toLowerCase()
  return (
    identity.includes(WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF) ||
    legacy.includes(WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF) ||
    legacy.includes(`db.${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}.supabase.co`) ||
    legacy.includes(`postgres.${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}`)
  )
}

function envDeclaresProductionTarget(env: Record<string, string | undefined>): boolean {
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const raw = env[key]?.trim()
    if (!raw) continue
    if (connectionTargetsProductionRef(raw)) return true
  }
  return false
}

/**
 * Fail-closed guard for staging pilot fixture planning.
 * Batch 41 supports dry-run only; apply mode is always refused.
 */
export function assertStagingPilotFixtureEnvironment(
  env: Record<string, string | undefined>,
  options: { mode: 'dry-run' | 'apply' },
): StagingPilotFixtureGuardResult {
  if (options.mode === 'apply') {
    return {
      ok: false,
      code: 'APPLY_NOT_AUTHORIZED',
      message:
        'Staging pilot fixture apply is not authorized in Batch 41. Use dry-run planning only; owner must authorize a separate staging apply gate.',
    }
  }

  if (envDeclaresProductionTarget(env)) {
    return {
      ok: false,
      code: 'PRODUCTION_DATABASE_URL',
      message: `Refusing pilot fixture planning while environment targets production Supabase ref ${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}.`,
    }
  }

  const databaseUrl = env.DATABASE_URL?.trim()
  if (databaseUrl && connectionTargetsProductionRef(databaseUrl)) {
    return {
      ok: false,
      code: 'PRODUCTION_REF_IN_TARGET',
      message: 'DATABASE_URL targets the recorded production database identity.',
    }
  }

  if (databaseUrl) {
    const preflight = verifyStagingDatabaseConnectionPair(env)
    if (!preflight.ok) {
      if (preflight.code === 'PRODUCTION_IDENTITY_COLLISION') {
        return {
          ok: false,
          code: 'PRODUCTION_IDENTITY_COLLISION',
          message: preflight.message,
        }
      }
      return {
        ok: false,
        code: 'STAGING_PREFLIGHT_BLOCKED',
        message: `Dry-run with DATABASE_URL set requires staging preflight (${preflight.code}): ${preflight.message}`,
      }
    }
    if (!preflight.identity.includes(WEBXXL_RECORDED_STAGING_SUPABASE_REF)) {
      return {
        ok: false,
        code: 'STAGING_PREFLIGHT_BLOCKED',
        message: `DATABASE_URL identity must match authorized staging ref ${WEBXXL_RECORDED_STAGING_SUPABASE_REF} when bound.`,
      }
    }
  }

  return { ok: true, mode: 'dry-run', stagingIntent: true }
}
