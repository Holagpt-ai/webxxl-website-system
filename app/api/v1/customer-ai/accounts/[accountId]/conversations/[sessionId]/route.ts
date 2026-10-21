import { getCustomerAiConversation } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; sessionId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, sessionId } = await params
    const result = await getCustomerAiConversation(prismaCustomerAiStore, toCustomerAiActor(user), accountId, sessionId)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
