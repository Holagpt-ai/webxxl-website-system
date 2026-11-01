import { attemptCustomerAiPilotExecutionApi } from '@/lib/platform/customer-ai-workforce/pilot-api'
import {
  customerAiPilotPrepDisabledResponse,
  customerAiResultResponse,
  customerAiRouteError,
  toCustomerAiActor,
} from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; taskId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiPilotPrepDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, taskId } = await params
    const body = (await request.json().catch(() => ({}))) as { approvalId?: string }
    const result = await attemptCustomerAiPilotExecutionApi(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      taskId,
      approvalId: body.approvalId,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
