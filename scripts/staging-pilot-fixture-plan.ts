#!/usr/bin/env tsx
/**
 * Batch 41 — dry-run staging pilot tenant fixture planner. No database writes.
 *
 * Usage:
 *   pnpm pilot:staging-fixture-plan
 *   pnpm pilot:staging-fixture-plan --json
 *
 * Apply mode is refused in Batch 41.
 */
import { assertStagingPilotFixtureEnvironment } from '@/lib/platform/pilot/staging-pilot-environment-guard'
import { buildStagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'

function wantsJson(argv: string[]): boolean {
  return argv.includes('--json')
}

function wantsApply(argv: string[]): boolean {
  return argv.includes('--apply') || process.env.WEBXXL_STAGING_PILOT_FIXTURE_APPLY === '1'
}

function main(): void {
  if (wantsApply(process.argv.slice(2))) {
    const guard = assertStagingPilotFixtureEnvironment(process.env, { mode: 'apply' })
    if (!guard.ok) {
      process.stderr.write(`${guard.code}: ${guard.message}\n`)
      process.exit(guard.code === 'APPLY_NOT_AUTHORIZED' ? 2 : 1)
    }
    process.exit(0)
  }

  const result = buildStagingPilotFixturePlan({ env: process.env })
  if (!result.ok) {
    process.stderr.write(`${result.guard.code}: ${result.guard.message}\n`)
    process.exit(1)
  }

  const { plan } = result
  if (wantsJson(process.argv.slice(2))) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    return
  }

  process.stdout.write('WebXXL staging pilot fixture plan (dry-run only)\n')
  process.stdout.write(`planVersion: ${plan.planVersion}\n`)
  process.stdout.write(`idempotencyKey: ${plan.idempotencyKey}\n`)
  process.stdout.write(`authorizedStagingRef: ${plan.authorizedStagingRef}\n`)
  process.stdout.write(`writesEnabled: ${plan.writesEnabled}\n`)
  process.stdout.write('\nAccounts:\n')
  process.stdout.write(
    `  A ${plan.accounts.subscriber.customerAccountId} — website.subscription ACTIVE on same account\n`,
  )
  process.stdout.write(
    `  B ${plan.accounts.nonSubscriber.customerAccountId} — membership only (no subscription rows)\n`,
  )
  process.stdout.write('\nOPEN-001 eligibility preview (synthetic evidence):\n')
  process.stdout.write(
    `  A: ${plan.eligibilityPreview.subscriber.outcome} (${plan.eligibilityPreview.subscriber.reasonCode})\n`,
  )
  process.stdout.write(
    `  B: ${plan.eligibilityPreview.nonSubscriber.outcome} (${plan.eligibilityPreview.nonSubscriber.reasonCode})\n`,
  )
  process.stdout.write('\nPlanned steps (not executed):\n')
  for (const step of plan.steps) {
    process.stdout.write(`  - ${step.stepId} ${step.entity} ${step.payloadSummary}\n`)
  }
  process.stdout.write('\nNo database mutations were performed.\n')
}

main()
