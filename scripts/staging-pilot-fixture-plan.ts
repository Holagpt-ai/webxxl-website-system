#!/usr/bin/env tsx
/**
 * Batch 41 — dry-run staging pilot tenant fixture planner. No database writes.
 *
 * Usage:
 *   pnpm pilot:staging-fixture-plan
 *   pnpm pilot:staging-fixture-plan --json
 *
 * For apply / inventory use pnpm pilot:staging-fixture-provision (Batch 42).
 */
import { buildStagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'

function wantsJson(argv: string[]): boolean {
  return argv.includes('--json')
}

function main(): void {
  if (process.argv.slice(2).includes('--apply')) {
    process.stderr.write(
      'Use pnpm pilot:staging-fixture-provision --apply --confirm-staging-provision for Batch 42 apply gate.\n',
    )
    process.exit(2)
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
