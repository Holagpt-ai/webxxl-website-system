import { ingestCustomerAiMessage } from '@/lib/platform/customer-ai-workforce/api'
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
    const role = String(body.role ?? 'VISITOR') as 'VISITOR' | 'ASSISTANT' | 'SYSTEM' | 'OPERATOR'
    const result = await ingestCustomerAiMessage(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      sessionId,
      idempotencyKey: String(body.idempotencyKey ?? ''),
      role,
      bodyText: String(body.bodyText ?? ''),
      content: typeof body.content === 'object' && body.content ? (body.content as Record<string, unknown>) : undefined,
      ingestionSource: body.ingestionSource != null ? String(body.ingestionSource) : undefined,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
