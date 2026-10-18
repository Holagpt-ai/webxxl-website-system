import type { WorkflowProvider } from '@/lib/platform/workflow/provider'
import type { EnqueueWorkflowJobInput, WorkflowJobSnapshot, WorkflowResult } from '@/lib/platform/workflow/types'

/**
 * Placeholder adapter seam for a future HatchetWorkflowProvider.
 * Not registered — AUTO-10 uses PrismaWorkflowProvider only.
 */
export class HatchetWorkflowProviderSeam implements WorkflowProvider {
  async enqueue(_input: EnqueueWorkflowJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Hatchet adapter not provisioned' }
  }
  async claim(): Promise<WorkflowJobSnapshot[]> {
    return []
  }
  async heartbeat(): Promise<WorkflowResult<void>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async complete(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async fail(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async retry(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async cancel(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async pause(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async resume(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async reconcile(): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  async getStatus(): Promise<WorkflowJobSnapshot | null> {
    return null
  }
}
