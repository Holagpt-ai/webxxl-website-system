import { parsePageParams } from '@/lib/platform/commerce/pagination'
import { listCustomerAiKnowledge, upsertCustomerAiKnowledge } from '@/lib/platform/customer-ai-workforce/api'
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
    const result = await listCustomerAiKnowledge(prismaCustomerAiStore, toCustomerAiActor(user), accountId, parsePageParams(new URL(request.url).searchParams))
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId } = await params
    const body = (await request.json()) as Record<string, unknown>
    const result = await upsertCustomerAiKnowledge(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      knowledgeId: body.knowledgeId != null ? String(body.knowledgeId) : undefined,
      kind: String(body.kind ?? 'FAQ'),
      title: String(body.title ?? ''),
      summary: body.summary != null ? String(body.summary) : null,
      languageTag: body.languageTag != null ? String(body.languageTag) : undefined,
      classification: body.classification != null ? String(body.classification) : undefined,
      content: typeof body.content === 'object' && body.content ? (body.content as Record<string, unknown>) : {},
      status: body.status === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT',
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
