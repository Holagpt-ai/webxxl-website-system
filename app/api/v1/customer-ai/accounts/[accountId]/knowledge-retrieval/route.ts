import { getCustomerAiKnowledgeRetrievalContract } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId } = await params
    const search = new URL(request.url).searchParams
    const result = await getCustomerAiKnowledgeRetrievalContract(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      employeeId: search.get('employeeId'),
      locale: search.get('locale') ?? 'en',
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
