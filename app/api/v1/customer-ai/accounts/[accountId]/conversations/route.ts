import { parsePageParams } from '@/lib/platform/commerce/pagination'
import { createCustomerAiConversation, listCustomerAiConversations } from '@/lib/platform/customer-ai-workforce/api'
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
    const result = await listCustomerAiConversations(prismaCustomerAiStore, toCustomerAiActor(user), accountId, parsePageParams(new URL(request.url).searchParams))
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
    const result = await createCustomerAiConversation(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      employeeId: body.employeeId != null ? String(body.employeeId) : null,
      managedSiteId: body.managedSiteId != null ? String(body.managedSiteId) : null,
      visitorRef: body.visitorRef != null ? String(body.visitorRef) : null,
      visitorLocale: body.visitorLocale != null ? String(body.visitorLocale) : null,
      dataClassification: body.dataClassification != null ? String(body.dataClassification) : undefined,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
