import { describe, expect, it } from 'vitest'
import {
  authorizedDatabaseIdentityFromUrl,
  normalizeDatabaseIdentityEvidence,
  verifyStagingDatabaseConnectionPair,
} from '@/lib/platform/pilot/staging-database-preflight'

const STAGING_REF = 'vcgibefnhneaqhcguhnt'
const PRODUCTION_REF = 'txfxeehglqfszletuumn'
const POOLER_HOST = 'aws-0-us-east-1.pooler.supabase.com:5432'

function poolerUrl(projectRef: string): string {
  return `postgresql://postgres.${projectRef}:PLACEHOLDER@${POOLER_HOST}/postgres?sslmode=require`
}

describe('Supabase session pooler staging preflight', () => {
  const stagingIdentity = `supabase:${STAGING_REF}/postgres`
  const productionIdentity = `supabase:${PRODUCTION_REF}/postgres`

  it('accepts matching session pooler DATABASE_URL and DIRECT_URL for staging project ref', () => {
    const url = poolerUrl(STAGING_REF)
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: url,
      DIRECT_URL: url,
      WEBXXL_STAGING_DATABASE_IDENTITY: stagingIdentity,
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: productionIdentity,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.identity).toBe(stagingIdentity)
  })

  it('accepts legacy direct-host identity evidence with pooler URLs', () => {
    const url = poolerUrl(STAGING_REF)
    const legacyEvidence = `db.${STAGING_REF}.supabase.co:5432/postgres`
    expect(normalizeDatabaseIdentityEvidence(legacyEvidence)).toBe(stagingIdentity)
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: url,
      DIRECT_URL: url,
      WEBXXL_STAGING_DATABASE_IDENTITY: legacyEvidence,
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: `db.${PRODUCTION_REF}.supabase.co:5432/postgres`,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects production session pooler URLs when staging identity is configured', () => {
    const prodUrl = poolerUrl(PRODUCTION_REF)
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: prodUrl,
      DIRECT_URL: prodUrl,
      WEBXXL_STAGING_DATABASE_IDENTITY: stagingIdentity,
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: productionIdentity,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('IDENTITY_MISMATCH')
  })

  it('rejects mismatched Supabase project refs on the shared pooler hostname', () => {
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: poolerUrl(STAGING_REF),
      DIRECT_URL: poolerUrl(PRODUCTION_REF),
      WEBXXL_STAGING_DATABASE_IDENTITY: stagingIdentity,
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: productionIdentity,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MISMATCHED_TARGETS')
  })

  it('rejects pooler host without postgres.{project-ref} username', () => {
    const bare = `postgresql://postgres:PLACEHOLDER@${POOLER_HOST}/postgres`
    expect(authorizedDatabaseIdentityFromUrl(bare)).toBeNull()
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: bare,
      DIRECT_URL: bare,
      WEBXXL_STAGING_DATABASE_IDENTITY: stagingIdentity,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNPARSEABLE_URL')
  })

  it('keeps production collision guard when env identities match', () => {
    const url = poolerUrl(STAGING_REF)
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: url,
      DIRECT_URL: url,
      WEBXXL_STAGING_DATABASE_IDENTITY: stagingIdentity,
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: stagingIdentity,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('PRODUCTION_IDENTITY_COLLISION')
  })
})
