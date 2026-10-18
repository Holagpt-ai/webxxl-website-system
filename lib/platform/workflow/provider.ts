import type { WorkflowErrorClass, WorkflowJobStatus } from '@prisma/client'
import type {
  EnqueueWorkflowJobInput,
  WorkflowJobSnapshot,
  WorkflowResult,
} from '@/lib/platform/workflow/types'

export type ClaimBatchInput = {
  workerId: string
  limit: number
  now?: Date
  leaseTtlMs?: number
}

export type CompleteJobInput = {
  jobId: string
  leaseToken: string
  leaseFence: number
  resultRef?: string
}

export type FailJobInput = {
  jobId: string
  leaseToken: string
  leaseFence: number
  errorCode: string
  errorClass: WorkflowErrorClass
  terminal?: boolean
}

export type RetryJobInput = {
  jobId: string
  leaseToken: string
  leaseFence: number
  errorCode: string
  errorClass: WorkflowErrorClass
  nextAttemptAt: Date
}

export interface WorkflowProvider {
  enqueue(input: EnqueueWorkflowJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>>
  claim(input: ClaimBatchInput): Promise<WorkflowJobSnapshot[]>
  heartbeat(input: { jobId: string; leaseToken: string; leaseFence: number; leaseTtlMs?: number }): Promise<WorkflowResult<void>>
  complete(input: CompleteJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>>
  fail(input: FailJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>>
  retry(input: RetryJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>>
  cancel(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>>
  pause(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>>
  resume(input: { jobId: string }): Promise<WorkflowResult<WorkflowJobSnapshot>>
  reconcile(input: { jobId: string; decision: 'COMPLETE' | 'DEAD_LETTER'; resultRef?: string }): Promise<WorkflowResult<WorkflowJobSnapshot>>
  getStatus(jobId: string): Promise<WorkflowJobSnapshot | null>
}

/** Future Hatchet adapter — not registered in AUTO-10 runtime. */
export type HatchetWorkflowProvider = WorkflowProvider
