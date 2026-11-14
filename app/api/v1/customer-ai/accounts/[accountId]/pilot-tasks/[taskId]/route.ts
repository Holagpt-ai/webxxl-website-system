import { getCustomerAiPilotTask } from '@/lib/platform/customer-ai-workforce/pilot-api'
import {
  customerAiPilotHttpDisabledResponse,
  customerAiResultResponse,
  customerAiRouteError,
  toCustomerAiActor,
} from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; taskId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const disabled = customerAiPilotHttpDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, taskId } = await params
    const result = await getCustomerAiPilotTask(prismaCustomerAiStore, toCustomerAiActor(user), accountId, taskId)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}