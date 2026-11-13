import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildReleaseReadinessReport } from '@/lib/platform/pilot/release-readiness-assess'

describe('Batch 8A release baseline hooks', () => {
  it('release readiness assess runs without throwing', () => {
    const report = buildReleaseReadinessReport({
      repositorySha: 'local',
      migrationProbe: { state: 'BLOCKED', reason: 'Batch 8A unit harness — no DB probe' },
    })
    expect(report.checks.length).toBeGreaterThan(10)
    expect(report.migrationOrderingOk).toBe(true)
  })

  it('vitest config inlines next-auth for SOCIAL-04A dynamic imports', () => {
    const config = readFileSync(resolve('vitest.config.ts'), 'utf8')
    expect(config).toContain("inline: ['next-auth']")
  })

  it('staging database example uses PLACEHOLDER password token', () => {
    const example = readFileSync(resolve('infra/services/shared/webxxl-staging-database.env.example'), 'utf8')
    expect(example).toContain('PLACEHOLDER_STAGING_DB_PASSWORD')
    expect(example).not.toContain('YOUR_STAGING_DB_PASSWORD')
  })
})
