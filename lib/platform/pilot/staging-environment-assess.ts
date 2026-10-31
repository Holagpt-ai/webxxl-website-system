/**
 * Read-only staging boundary check. Does not mutate infrastructure or read production secrets.
 */

import {
  verifyStagingDatabaseConnectionPair,
  verifyStagingDatabaseConnections,
} from '@/lib/platform/pilot/staging-database-preflight'

export type StagingEnvironmentState =
  | 'NOT_IDENTIFIED'
  | 'PARTIAL_CONFIG'
  | 'CONFIG_PRESENT_UNVERIFIED'
  | 'BOUNDARIES_VERIFIED'

export type StagingEnvironmentAssessment = {
  state: StagingEnvironmentState
  isolatedDatabaseConfigured: boolean
  isolatedAppUrlConfigured: boolean
  productionDatabaseUrlPresent: boolean
  summary: string
  ownerAuthorizationRequired: string[]
  reproducibleArtifacts: string[]
}

const STAGING_DB_KEYS = ['STAGING_DATABASE_URL', 'WEBXXL_STAGING_DATABASE_URL', 'DATABASE_URL_STAGING'] as const
const STAGING_APP_KEYS = ['WEBXXL_STAGING_APP_URL', 'WEBXXL_APP_BASE_URL'] as const

function hasStagingDbHints(env: Record<string, string | undefined>): boolean {
  return STAGING_DB_KEYS.some((k) => env[k]?.trim()) || Boolean(env.WEBXXL_STAGING_DATABASE_IDENTITY?.trim())
}

function hasBoundDatabasePair(env: Record<string, string | undefined>): boolean {
  return Boolean(env.DATABASE_URL?.trim() && env.DIRECT_URL?.trim())
}

export function assessStagingEnvironment(
  env: Record<string, string | undefined> = process.env,
): StagingEnvironmentAssessment {
  const stagingDbHints = hasStagingDbHints(env)
  const boundPair = hasBoundDatabasePair(env)
  const prodDb = Boolean(env.DATABASE_URL?.trim() && !stagingDbHints && !env.WEBXXL_STAGING_DATABASE_IDENTITY?.trim())
  const stagingApp = STAGING_APP_KEYS.some((k) => {
    const v = env[k]?.trim()
    return Boolean(v && /staging|preview|internal/i.test(v))
  })

  const artifacts = [
    'infra/services/shared/webxxl-staging.env.example',
    'infra/services/shared/STAGING-GATE.md',
    'docs/PILOT-21C-STAGING-PREFLIGHT.md',
    'docs/BATCH31-CONTROLLED-STAGING-PILOT.md',
    'docs/STAGING-ENVIRONMENT-31.md',
  ]

  const ownerAuthorizationRequired = [
    'Record WEBXXL_STAGING_DATABASE_IDENTITY (host/database fingerprint, no secrets).',
    'Bind DATABASE_URL and DIRECT_URL to the same staging target.',
    'Set WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1 only after independent staging vs production verification.',
    'Owner sign-off on INFRA-02 STAGING-GATE checklist before compose/staging-up on VPS.',
    'No duplicate paid VPS or Supabase projects without owner approval.',
  ]

  const migrationReady = verifyStagingDatabaseConnections(env)
  if (migrationReady.ok) {
    return {
      state: 'BOUNDARIES_VERIFIED',
      isolatedDatabaseConfigured: true,
      isolatedAppUrlConfigured: stagingApp,
      productionDatabaseUrlPresent: prodDb,
      summary: `Staging database identity verified (${migrationReady.identity}) with operator confirmation.`,
      ownerAuthorizationRequired: [],
      reproducibleArtifacts: artifacts,
    }
  }

  const pairReady = verifyStagingDatabaseConnectionPair(env)
  if (pairReady.ok && env.WEBXXL_STAGING_BOUNDARIES_CONFIRMED !== '1') {
    return {
      state: 'CONFIG_PRESENT_UNVERIFIED',
      isolatedDatabaseConfigured: true,
      isolatedAppUrlConfigured: stagingApp,
      productionDatabaseUrlPresent: prodDb,
      summary:
        'Staging connection pair matches WEBXXL_STAGING_DATABASE_IDENTITY, but operator confirmation (WEBXXL_STAGING_BOUNDARIES_CONFIRMED=1) is missing — isolation not verified.',
      ownerAuthorizationRequired,
      reproducibleArtifacts: artifacts,
    }
  }

  if (stagingDbHints || boundPair || stagingApp) {
    return {
      state: 'CONFIG_PRESENT_UNVERIFIED',
      isolatedDatabaseConfigured: stagingDbHints || boundPair,
      isolatedAppUrlConfigured: stagingApp,
      productionDatabaseUrlPresent: prodDb,
      summary:
        'Staging-related configuration is present, but database isolation is not verified (missing identity evidence, mismatched URLs, or operator confirmation).',
      ownerAuthorizationRequired,
      reproducibleArtifacts: artifacts,
    }
  }

  if (!stagingDbHints && !stagingApp) {
    return {
      state: 'NOT_IDENTIFIED',
      isolatedDatabaseConfigured: false,
      isolatedAppUrlConfigured: false,
      productionDatabaseUrlPresent: prodDb,
      summary:
        'No verified staging database or staging app configuration (consistent with Batch 21C). Vercel Preview alone is not an isolated DB.',
      ownerAuthorizationRequired,
      reproducibleArtifacts: artifacts,
    }
  }

  return {
    state: 'PARTIAL_CONFIG',
    isolatedDatabaseConfigured: stagingDbHints,
    isolatedAppUrlConfigured: stagingApp,
    productionDatabaseUrlPresent: prodDb,
    summary: 'Partial staging configuration detected; complete verified DB binding before migration rehearsal or pilot.',
    ownerAuthorizationRequired,
    reproducibleArtifacts: artifacts,
  }
}
