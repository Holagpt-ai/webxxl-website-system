import { issueCustomerAiPilotApprovalApi } from '@/lib/platform/customer-ai-workforce/pilot-api'
import {
  customerAiPilotHttpDisabledResponse,
  customerAiResultResponse,
  customerAiRouteError,
  toCustomerAiActor,
} from '@/lib/platform/customer-ai-workforce/http'
import { findPilotTaskById } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; taskId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiPilotHttpDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, taskId } = await params
    const task = findPilotTaskById(taskId)
    if (!task || task.customerAccountId !== accountId) {
      return customerAiResultResponse({ ok: false, error: 'NOT_FOUND', message: 'Task not found' })
    }
    const body = (await request.json()) as {
      allowedAction?: string
      destinationRef?: string | null
      maxCostUnits?: number | null
      ttlSeconds?: number
    }
    const result = await issueCustomerAiPilotApprovalApi(prismaCustomerAiStore, toCustomerAiActor(user), {
      preparedTaskId: taskId,
      customerAccountId: accountId,
      allowedAction: body.allowedAction ?? 'execute_prepared_draft',
      destinationRef: body.destinationRef ?? null,
      maxCostUnits: body.maxCostUnits ?? task.estimatedCostUnits,
      ttlSeconds: body.ttlSeconds ?? 3600,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
