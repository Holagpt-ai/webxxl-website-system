import { describe, expect, it } from 'vitest'
import { evaluateRuntimeDatabaseVerification } from '@/lib/platform/admin-operations/runtime-database-verification'

const PROD_POOLER =
  'postgresql://postgres.txfxeehglqfszletuumn:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
const PROD_DIRECT =
  'postgresql://postgres:secret@db.txfxeehglqfszletuumn.supabase.co:5432/postgres'
const STG_POOLER =
  'postgresql://postgres.vcgibefnhneaqhcguhnt:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'

const okProbe = {
  probeDatabaseUrl: async () => ({ ok: true, finishedMigrations: 40 }),
  probeDirectUrl: async () => ({ ok: true }),
}

describe('evaluateRuntimeDatabaseVerification', () => {
  it('returns VERIFIED_PRODUCTION when DATABASE_URL and DIRECT_URL target txfx', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_DIRECT },
      okProbe,
    )
    expect(result.verdict).toBe('VERIFIED_PRODUCTION')
    expect(result.configuration.urlsAligned).toBe(true)
    expect(result.connectivity.databaseUrl).toBe('OK')
    expect(result.connectivity.directUrl).toBe('OK')
    expect(result.connectivity.migrationLedgerFinished).toBe(40)
  })

  it('returns VERIFIED_STAGING when both URLs target vcgib', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: STG_POOLER, DIRECT_URL: STG_POOLER },
      okProbe,
    )
    expect(result.verdict).toBe('VERIFIED_STAGING')
    expect(result.configuration.urlsAligned).toBe(true)
  })

  it('returns MISMATCH when DATABASE_URL and DIRECT_URL disagree', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: STG_POOLER },
      okProbe,
    )
    expect(result.verdict).toBe('MISMATCH')
    expect(result.configuration.urlsAligned).toBe(false)
    expect(result.connectivity.directUrl).toBe('SKIPPED')
  })

  it('returns UNVERIFIED when URLs are missing', async () => {
    const result = await evaluateRuntimeDatabaseVerification({}, okProbe)
    expect(result.verdict).toBe('UNVERIFIED')
    expect(result.configuration.urlsConfigured).toBe(false)
  })

  it('returns UNVERIFIED for unknown Supabase ref', async () => {
    const unknown =
      'postgresql://postgres.zzzzzzzzzzzzzzzzzzzz@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: unknown, DIRECT_URL: unknown },
      okProbe,
    )
    expect(result.verdict).toBe('UNVERIFIED')
  })

  it('marks connectivity FAIL when probe fails', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_POOLER },
      {
        probeDatabaseUrl: async () => ({ ok: false, finishedMigrations: null }),
        probeDirectUrl: async () => ({ ok: false }),
      },
    )
    expect(result.verdict).toBe('VERIFIED_PRODUCTION')
    expect(result.connectivity.databaseUrl).toBe('FAIL')
    expect(result.connectivity.directUrl).toBe('FAIL')
  })
})