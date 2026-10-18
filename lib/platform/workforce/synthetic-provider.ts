import type { WorkforceProvider } from '@/lib/platform/providers/types'

/** @internal TEST-ONLY / disabled-runtime deterministic provider — not production execution. */
export function createSyntheticWorkforceProvider(): WorkforceProvider {
  return {
    kind: 'workforce',
    key: 'synthetic',
    displayName: 'Synthetic internal workforce',
    availability: 'EXISTING_ADAPTER',
    replaceable: true,
    installed: true,
    async listAgents() {
      return {
        ok: true,
        value: [] as never[],
      }
    },
  }
}

export type SyntheticProviderRun = {
  externalRunId: string
  accepted: boolean
  phase: string
}

export function syntheticAcceptTask(taskId: string): SyntheticProviderRun {
  return {
    externalRunId: `syn_run_${taskId}`,
    accepted: true,
    phase: 'PROVIDER_ACCEPTED',
  }
}

export function syntheticCompleteTask(taskId: string, artifactRef: string): { externalRunId: string; artifactRef: string } {
  return { externalRunId: `syn_run_${taskId}`, artifactRef }
}
