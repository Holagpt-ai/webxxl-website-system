import {
  WORKFLOW_GLOBAL_CONCURRENCY,
  WORKFLOW_PER_ACCOUNT_ACTIVE_CAP,
  WORKFLOW_PER_KIND_ACTIVE_CAP,
  validatedWorkflowClaimBatchLimit,
} from '@/config/workflow-backend'
import type { WorkflowJobSnapshot } from '@/lib/platform/workflow/types'

export type FairClaimPartition = {
  selected: WorkflowJobSnapshot[]
  rejected: WorkflowJobSnapshot[]
}

/** Admission control at claim time; rejected jobs must be released back to the queue. */
export function partitionFairClaims(
  jobs: WorkflowJobSnapshot[],
  options?: {
    perAccountCap?: number
    perKindCap?: number
    maxBatch?: number
  },
): FairClaimPartition {
  const perAccountCap = options?.perAccountCap ?? WORKFLOW_PER_ACCOUNT_ACTIVE_CAP
  const perKindCap = options?.perKindCap ?? WORKFLOW_PER_KIND_ACTIVE_CAP
  const maxBatch = options?.maxBatch ?? validatedWorkflowClaimBatchLimit()

  const accountCounts = new Map<string, number>()
  const kindCounts = new Map<string, number>()
  const selected: WorkflowJobSnapshot[] = []
  const rejected: WorkflowJobSnapshot[] = []

  for (const job of jobs) {
    if (selected.length >= maxBatch) {
      rejected.push(job)
      continue
    }
    const accountKey = job.customerAccountId ?? '__platform__'
    const accountUsed = accountCounts.get(accountKey) ?? 0
    if (accountUsed >= perAccountCap) {
      rejected.push(job)
      continue
    }
    const kindUsed = kindCounts.get(job.jobKind) ?? 0
    if (kindUsed >= perKindCap) {
      rejected.push(job)
      continue
    }
    accountCounts.set(accountKey, accountUsed + 1)
    kindCounts.set(job.jobKind, kindUsed + 1)
    selected.push(job)
  }

  return { selected, rejected }
}

/** @deprecated Use partitionFairClaims + release for DB-backed claims. */
export function applyPerAccountClaimFairness(
  jobs: WorkflowJobSnapshot[],
  perAccountCap = WORKFLOW_PER_ACCOUNT_ACTIVE_CAP,
): WorkflowJobSnapshot[] {
  return partitionFairClaims(jobs, { perAccountCap }).selected
}

export function computeClaimHeadroom(globalActiveCount: number): number {
  const headroom = WORKFLOW_GLOBAL_CONCURRENCY - globalActiveCount
  return Math.max(0, headroom)
}
