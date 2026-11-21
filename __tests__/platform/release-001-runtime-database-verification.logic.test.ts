import { describe, expect, it, vi } from 'vitest'
import {
  DATABASE_PROBE_TIMEOUT_MS,
  evaluateRuntimeDatabaseVerification,
  withProbeTimeout,
} from '@/lib/platform/admin-operations/runtime-database-verification'

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
  it('returns VERIFIED_PRODUCTION when production config, connectivity, and migration count pass', async () => {
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

  it('returns VERIFIED_STAGING when both URLs target vcgib and connectivity passes', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: STG_POOLER, DIRECT_URL: STG_POOLER },
      okProbe,
    )
    expect(result.verdict).toBe('VERIFIED_STAGING')
    expect(result.configuration.urlsAligned).toBe(true)
  })

  it('returns UNVERIFIED when staging config but connectivity fails', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: STG_POOLER, DIRECT_URL: STG_POOLER },
      {
        probeDatabaseUrl: async () => ({ ok: false, finishedMigrations: null }),
        probeDirectUrl: async () => ({ ok: false }),
      },
    )
    expect(result.verdict).toBe('UNVERIFIED')
    expect(result.connectivity.databaseUrl).toBe('FAIL')
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

  it('returns UNVERIFIED when production config but connectivity fails (not VERIFIED_PRODUCTION)', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_POOLER },
      {
        probeDatabaseUrl: async () => ({ ok: false, finishedMigrations: null }),
        probeDirectUrl: async () => ({ ok: false }),
      },
    )
    expect(result.verdict).toBe('UNVERIFIED')
    expect(result.connectivity.databaseUrl).toBe('FAIL')
    expect(result.connectivity.directUrl).toBe('FAIL')
  })

  it('returns UNVERIFIED when migration ledger count is not 40', async () => {
    const result = await evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_POOLER },
      {
        probeDatabaseUrl: async () => ({ ok: true, finishedMigrations: 39 }),
        probeDirectUrl: async () => ({ ok: true }),
      },
    )
    expect(result.verdict).toBe('UNVERIFIED')
    expect(result.connectivity.migrationLedgerFinished).toBe(39)
    expect(result.connectivity.databaseUrl).toBe('OK')
  })

  it('withProbeTimeout resolves TIMEOUT for hung probes', async () => {
    vi.useFakeTimers()
    const pending = withProbeTimeout(new Promise<string>(() => {}), 50)
    const tick = vi.advanceTimersByTimeAsync(60)
    await expect(pending).resolves.toBe('TIMEOUT')
    await tick
    vi.useRealTimers()
  })

  it('treats timed-out direct probe as UNVERIFIED production', async () => {
    vi.useFakeTimers()
    const pending = evaluateRuntimeDatabaseVerification(
      { DATABASE_URL: PROD_POOLER, DIRECT_URL: PROD_POOLER },
      {
        probeDatabaseUrl: async () => ({ ok: true, finishedMigrations: 40 }),
        probeDirectUrl: () => new Promise(() => {}),
      },
    )
    const advance = vi.advanceTimersByTimeAsync(DATABASE_PROBE_TIMEOUT_MS + 1)
    const result = await pending
    await advance
    expect(result.verdict).toBe('UNVERIFIED')
    expect(result.connectivity.directUrl).toBe('FAIL')
    vi.useRealTimers()
  })
})