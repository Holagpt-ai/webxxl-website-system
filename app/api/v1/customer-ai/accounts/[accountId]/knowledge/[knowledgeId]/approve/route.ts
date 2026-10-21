import { approveCustomerAiKnowledge } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; knowledgeId: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, knowledgeId } = await params
    const result = await approveCustomerAiKnowledge(prismaCustomerAiStore, toCustomerAiActor(user), accountId, knowledgeId)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
