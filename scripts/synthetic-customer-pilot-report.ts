#!/usr/bin/env tsx
/** Read-only synthetic pilot workflow summary for operators. */
import { execSync } from 'node:child_process'
import { buildFeatureReadinessMatrix } from '@/lib/platform/pilot/feature-readiness-matrix'
import {
  summarizeSyntheticPilotWorkflow,
  SYNTHETIC_CUSTOMER_PILOT_STEPS,
} from '@/lib/platform/pilot/synthetic-customer-pilot-workflow'
import { assessStagingEnvironment } from '@/lib/platform/pilot/staging-environment-assess'

function resolveSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function main() {
  const staging = assessStagingEnvironment()
  process.stdout.write(`WebXXL synthetic customer pilot outline @ ${resolveSha().slice(0, 7)}\n\n`)
  process.stdout.write('## Staging\n')
  process.stdout.write(`${staging.summary}\n`)
  process.stdout.write(`State: ${staging.state}\n\n`)

  process.stdout.write('## Workflow\n')
  process.stdout.write(`${summarizeSyntheticPilotWorkflow()}\n\n`)

  process.stdout.write('## Feature readiness (this process environment)\n')
  for (const row of buildFeatureReadinessMatrix()) {
    process.stdout.write(
      `  ${row.label}: flag=${row.flagEnabled ? 'ON' : 'OFF'} → ${row.typicalCustomerState} — ${row.notes}\n`,
    )
  }

  process.stdout.write(`\nAutomated step count: ${SYNTHETIC_CUSTOMER_PILOT_STEPS.length}\n`)
  process.stdout.write('Run focused Vitest: batch31-staging-pilot-readiness + pilot21a + batch28a/30a regressions.\n')
}

main()
