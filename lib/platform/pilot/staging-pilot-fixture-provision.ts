import type { PrismaClient } from '@prisma/client'
import { PrismaClient as DefaultPrismaClient } from '@prisma/client'
import { buildStagingPilotFixturePlan } from '@/lib/platform/pilot/staging-pilot-fixture-plan'
import {
  assertStagingPilotFixtureEnvironment,
  type StagingPilotFixtureGuardResult,
} from '@/lib/platform/pilot/staging-pilot-environment-guard'
import { loadStagingPilotFixtureState } from '@/lib/platform/pilot/staging-pilot-fixture-inspect'
import { buildStagingPilotFixtureApplyReport } from '@/lib/platform/pilot/staging-pilot-fixture-reconcile'
import { executeStagingPilotFixtureApply } from '@/lib/platform/pilot/staging-pilot-fixture-execute'
import { STAGING_PILOT_EXECUTION_VERSION } from '@/lib/platform/pilot/staging-pilot-fixture-ids'
import { buildStagingPilotOperatorChecklist } from '@/lib/platform/pilot/staging-pilot-operator-checklist'

export type StagingPilotProvisionMode = 'dry-run' | 'apply'

export type RunStagingPilotFixtureProvisionInput = {
  env?: Record<string, string | undefined>
  mode?: StagingPilotProvisionMode
  /** CLI --confirm-staging-provision — deliberate operator confirmation. */
  operatorConfirmApply?: boolean
  prisma?: PrismaClient
  inspectDatabase?: boolean
}

export type StagingPilotFixtureProvisionResult =
  | {
      ok: true
      executionVersion: typeof STAGING_PILOT_EXECUTION_VERSION
      mode: StagingPilotProvisionMode
      guard: Extract<StagingPilotFixtureGuardResult, { ok: true }>
      report: ReturnType<typeof buildStagingPilotFixtureApplyReport>
      execute?: ReturnType<typeof executeStagingPilotFixtureApply> extends Promise<infer R> ? R : never
      operatorChecklist: ReturnType<typeof buildStagingPilotOperatorChecklist>
      inspected: boolean
    }
  | { ok: false; guard: Extract<StagingPilotFixtureGuardResult, { ok: false }> }

export async function runStagingPilotFixtureProvision(
  input: RunStagingPilotFixtureProvisionInput = {},
): Promise<StagingPilotFixtureProvisionResult> {
  const env = input.env ?? {}
  const mode = input.mode ?? 'dry-run'
  const operatorConfirmApply = input.operatorConfirmApply ?? false

  const guard = assertStagingPilotFixtureEnvironment(env, { mode, operatorConfirmApply })
  if (!guard.ok) {
    return { ok: false, guard }
  }

  const planResult = buildStagingPilotFixturePlan({ env, mode: 'dry-run' })
  if (!planResult.ok) {
    return { ok: false, guard: planResult.guard }
  }

  const shouldInspect =
    input.inspectDatabase !== false && Boolean(env.DATABASE_URL?.trim()) && mode === 'dry-run'
  let state = null
  if (shouldInspect || mode === 'apply') {
    const prisma = input.prisma ?? new DefaultPrismaClient()
    const ownsClient = !input.prisma
    try {
      state = await loadStagingPilotFixtureState(prisma)
    } finally {
      if (ownsClient) await prisma.$disconnect()
    }
  }

  const report = buildStagingPilotFixtureApplyReport({
    plan: planResult.plan,
    state,
    mode,
  })

  let executeResult
  if (mode === 'apply' && report.readyForApply) {
    const prisma = input.prisma ?? new DefaultPrismaClient()
    const ownsClient = !input.prisma
    try {
      const applyState = state ?? (await loadStagingPilotFixtureState(prisma))
      executeResult = await executeStagingPilotFixtureApply(prisma, report, applyState)
    } finally {
      if (ownsClient) await prisma.$disconnect()
    }
  }

  return {
    ok: true,
    executionVersion: STAGING_PILOT_EXECUTION_VERSION,
    mode,
    guard,
    report,
    execute: executeResult,
    operatorChecklist: buildStagingPilotOperatorChecklist(),
    inspected: Boolean(state),
  }
}
