/**
 * Read-only staging boundary check. Does not mutate infrastructure or read production secrets.
 */

export type StagingEnvironmentState = 'NOT_IDENTIFIED' | 'PARTIAL_CONFIG' | 'BOUNDARIES_VERIFIED'

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

export function assessStagingEnvironment(env: NodeJS.ProcessEnv = process.env): StagingEnvironmentAssessment {
  const stagingDb = STAGING_DB_KEYS.some((k) => env[k]?.trim())
  const prodDb = Boolean(env.DATABASE_URL?.trim() && !stagingDb)
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
    'Designate isolated staging Postgres/Supabase (not production DATABASE_URL).',
    'Bind Vercel Preview or staging project to staging DATABASE_URL only.',
    'Owner sign-off on INFRA-02 STAGING-GATE checklist before compose/staging-up on VPS.',
    'No duplicate paid VPS or Supabase projects without owner approval.',
  ]

  if (!stagingDb && !stagingApp) {
    return {
      state: 'NOT_IDENTIFIED',
      isolatedDatabaseConfigured: false,
      isolatedAppUrlConfigured: false,
      productionDatabaseUrlPresent: prodDb,
      summary:
        'No isolated staging database or staging app URL detected in process environment (consistent with Batch 21C). Vercel Preview alone is not an isolated DB.',
      ownerAuthorizationRequired,
      reproducibleArtifacts: artifacts,
    }
  }

  if (stagingDb && stagingApp) {
    return {
      state: 'BOUNDARIES_VERIFIED',
      isolatedDatabaseConfigured: true,
      isolatedAppUrlConfigured: true,
      productionDatabaseUrlPresent: prodDb,
      summary: 'Staging database and app URL variables present — operator must still confirm they do not point at production.',
      ownerAuthorizationRequired: [
        'Verify staging DATABASE_URL host differs from production Supabase/project.',
        ...ownerAuthorizationRequired.slice(1),
      ],
      reproducibleArtifacts: artifacts,
    }
  }

  return {
    state: 'PARTIAL_CONFIG',
    isolatedDatabaseConfigured: stagingDb,
    isolatedAppUrlConfigured: stagingApp,
    productionDatabaseUrlPresent: prodDb,
    summary: 'Partial staging configuration detected; complete DB + app binding before migration rehearsal or pilot.',
    ownerAuthorizationRequired,
    reproducibleArtifacts: artifacts,
  }
}
