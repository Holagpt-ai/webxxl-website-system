import { requestCustomerAiHandoff } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; sessionId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, sessionId } = await params
    const body = (await request.json()) as Record<string, unknown>
    const result = await requestCustomerAiHandoff(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      sessionId,
      reason: body.reason != null ? String(body.reason) : undefined,
      assignedUserId: body.assignedUserId != null ? String(body.assignedUserId) : null,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
