import {
  isWorkflowDurableExecutionAllowed,
  isWorkflowEnqueueEnabled,
} from '@/config/workflow-backend'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import type { EnqueueWorkflowJobInput, WorkflowJobSnapshot, WorkflowResult } from '@/lib/platform/workflow/types'

export async function enqueueWorkflowJob(input: EnqueueWorkflowJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
  if (!isWorkflowDurableExecutionAllowed()) {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Workflow backend disabled' }
  }
  if (!isWorkflowEnqueueEnabled()) {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Workflow enqueue disabled' }
  }
  return prismaWorkflowProvider.enqueue(input)
}
