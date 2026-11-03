import {
  authorizedDatabaseIdentityFromUrl,
  verifyStagingDatabaseConnectionPair,
  verifyStagingDatabaseConnections,
} from '@/lib/platform/pilot/staging-database-preflight'
import {
  STAGING_PILOT_APPLY_AUTHORIZATION_ENV,
  WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF,
  WEBXXL_RECORDED_STAGING_SUPABASE_REF,
} from '@/lib/platform/pilot/staging-pilot-fixture-ids'

export type StagingPilotFixtureGuardCode =
  | 'APPLY_CONFIRMATION_REQUIRED'
  | 'APPLY_NOT_AUTHORIZED'
  | 'PRODUCTION_APPLY_FORBIDDEN'
  | 'PRODUCTION_DATABASE_URL'
  | 'PRODUCTION_IDENTITY_COLLISION'
  | 'PRODUCTION_REF_IN_TARGET'
  | 'STAGING_APPLY_NOT_AUTHORIZED'
  | 'STAGING_PREFLIGHT_BLOCKED'
  | 'UNKNOWN_DATABASE_REF'

export type StagingPilotFixtureGuardResult =
  | { ok: true; mode: 'dry-run' | 'apply'; stagingIntent: true }
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

function stagingPreflightForMode(
  env: Record<string, string | undefined>,
  mode: 'dry-run' | 'apply',
): StagingPilotFixtureGuardResult | null {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    if (mode === 'apply') {
      return {
        ok: false,
        code: 'STAGING_PREFLIGHT_BLOCKED',
        message: 'Apply requires DATABASE_URL bound to authorized staging Supabase only.',
      }
    }
    return null
  }

  if (connectionTargetsProductionRef(databaseUrl)) {
    return {
      ok: false,
      code: mode === 'apply' ? 'PRODUCTION_APPLY_FORBIDDEN' : 'PRODUCTION_REF_IN_TARGET',
      message:
        mode === 'apply'
          ? `Production Supabase ref ${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF} is never eligible for pilot fixture apply, even with operator confirmation.`
          : 'DATABASE_URL targets the recorded production database identity.',
    }
  }

  const preflight =
    mode === 'apply' ? verifyStagingDatabaseConnections(env) : verifyStagingDatabaseConnectionPair(env)

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
      message: `${mode} with DATABASE_URL set requires staging preflight (${preflight.code}): ${preflight.message}`,
    }
  }

  if (!preflight.identity.includes(WEBXXL_RECORDED_STAGING_SUPABASE_REF)) {
    return {
      ok: false,
      code: 'UNKNOWN_DATABASE_REF',
      message: `DATABASE_URL identity must match authorized staging ref ${WEBXXL_RECORDED_STAGING_SUPABASE_REF}; unknown or unlisted targets are rejected.`,
    }
  }

  return null
}

export type AssertStagingPilotFixtureEnvironmentOptions = {
  mode: 'dry-run' | 'apply'
  /** CLI --confirm-staging-provision — deliberate operator confirmation (apply only). */
  operatorConfirmApply?: boolean
}

/**
 * Fail-closed guard for staging pilot fixture planning and apply.
 * Apply never runs from env alone; production is always refused.
 */
export function assertStagingPilotFixtureEnvironment(
  env: Record<string, string | undefined>,
  options: AssertStagingPilotFixtureEnvironmentOptions,
): StagingPilotFixtureGuardResult {
  const operatorConfirmApply = options.operatorConfirmApply ?? false

  if (envDeclaresProductionTarget(env)) {
    return {
      ok: false,
      code: options.mode === 'apply' ? 'PRODUCTION_APPLY_FORBIDDEN' : 'PRODUCTION_DATABASE_URL',
      message: `Refusing pilot fixture ${options.mode} while environment targets production Supabase ref ${WEBXXL_RECORDED_PRODUCTION_SUPABASE_REF}.`,
    }
  }

  if (options.mode === 'apply') {
    if (!operatorConfirmApply) {
      return {
        ok: false,
        code: 'APPLY_CONFIRMATION_REQUIRED',
        message:
          'Apply requires explicit CLI flag --confirm-staging-provision in addition to owner authorization env.',
      }
    }
    const authorized = env[STAGING_PILOT_APPLY_AUTHORIZATION_ENV]?.trim()
    if (authorized !== '1') {
      return {
        ok: false,
        code: 'STAGING_APPLY_NOT_AUTHORIZED',
        message: `Set ${STAGING_PILOT_APPLY_AUTHORIZATION_ENV}=1 after separate owner authorization before staging apply.`,
      }
    }
  }

  const preflightBlock = stagingPreflightForMode(env, options.mode)
  if (preflightBlock) {
    return preflightBlock
  }

  return {
    ok: true,
    mode: options.mode,
    stagingIntent: true,
  }
}
