import { WORKFLOW_PER_ACCOUNT_ACTIVE_CAP } from '@/config/workflow-backend'
import type { WorkflowJobSnapshot } from '@/lib/platform/workflow/types'

/** Best-effort cap so one account cannot consume an entire claim batch. */
export function applyPerAccountClaimFairness(
  jobs: WorkflowJobSnapshot[],
  perAccountCap = WORKFLOW_PER_ACCOUNT_ACTIVE_CAP,
): WorkflowJobSnapshot[] {
  const counts = new Map<string, number>()
  const selected: WorkflowJobSnapshot[] = []
  for (const job of jobs) {
    const key = job.customerAccountId ?? '__platform__'
    const used = counts.get(key) ?? 0
    if (used >= perAccountCap) continue
    counts.set(key, used + 1)
    selected.push(job)
  }
  return selected
}
