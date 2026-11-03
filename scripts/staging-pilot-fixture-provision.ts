#!/usr/bin/env tsx
/**
 * Batch 42 — staging pilot fixture provision (default dry-run). Staging writes only when fully authorized.
 *
 * Usage:
 *   pnpm pilot:staging-fixture-provision
 *   pnpm pilot:staging-fixture-provision --json
 *   pnpm pilot:staging-fixture-provision --apply --confirm-staging-provision  (owner gate + staging env)
 */
import { runStagingPilotFixtureProvision } from '@/lib/platform/pilot/staging-pilot-fixture-provision'

function wantsJson(argv: string[]): boolean {
  return argv.includes('--json')
}

function wantsApply(argv: string[]): boolean {
  return argv.includes('--apply')
}

function wantsConfirm(argv: string[]): boolean {
  return argv.includes('--confirm-staging-provision')
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const mode = wantsApply(argv) ? 'apply' : 'dry-run'
  const operatorConfirmApply = wantsConfirm(argv)

  if (mode === 'apply' && !operatorConfirmApply) {
    process.stderr.write(
      'APPLY_CONFIRMATION_REQUIRED: Pass --confirm-staging-provision together with --apply and owner authorization env.\n',
    )
    process.exit(2)
  }

  const result = await runStagingPilotFixtureProvision({
    env: process.env,
    mode,
    operatorConfirmApply,
    inspectDatabase: mode === 'dry-run' ? Boolean(process.env.DATABASE_URL?.trim()) : true,
  })

  if (!result.ok) {
    process.stderr.write(`${result.guard.code}: ${result.guard.message}\n`)
    process.exit(result.guard.code === 'APPLY_CONFIRMATION_REQUIRED' ? 2 : 1)
  }

  if (wantsJson(argv)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  process.stdout.write(`WebXXL staging pilot fixture provision (${result.mode})\n`)
  process.stdout.write(`executionVersion: ${result.executionVersion}\n`)
  process.stdout.write(`inspectedDatabase: ${result.inspected}\n`)
  process.stdout.write(`readyForApply: ${result.report.readyForApply}\n`)
  process.stdout.write(`catalogBlocked: ${result.report.catalogBlocked}\n`)
  if (result.report.conflicts.length) {
    process.stdout.write('\nConflicts:\n')
    for (const c of result.report.conflicts) {
      process.stdout.write(`  - ${c}\n`)
    }
  }
  process.stdout.write('\nActions:\n')
  for (const action of result.report.actions) {
    process.stdout.write(`  - [${action.kind}] ${action.stepId} ${action.entity}: ${action.detail}\n`)
  }
  process.stdout.write(`\n${result.report.authIdentityNote}\n`)

  if (result.execute) {
    process.stdout.write(
      `\nApply result: applied=${result.execute.applied} skipped=${result.execute.skipped} blocked=${result.execute.blocked}\n`,
    )
  } else if (result.mode === 'dry-run') {
    process.stdout.write('\nNo database mutations were performed (dry-run default).\n')
  }

  process.stdout.write('\n--- Operator checklist (summary) ---\n')
  for (const line of result.operatorChecklist.remainingForFirstCrmPilot) {
    process.stdout.write(`  • ${line}\n`)
  }
}

main().catch((err: unknown) => {
  process.stderr.write(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
