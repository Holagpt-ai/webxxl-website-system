import { parsePageParams } from '@/lib/platform/commerce/pagination'
import { createCustomerAiEmployee, listCustomerAiEmployees } from '@/lib/platform/customer-ai-workforce/api'
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
    const result = await listCustomerAiEmployees(prismaCustomerAiStore, toCustomerAiActor(user), accountId, parsePageParams(new URL(request.url).searchParams))
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
    const result = await createCustomerAiEmployee(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      displayName: String(body.displayName ?? ''),
      roleTitle: String(body.roleTitle ?? ''),
      description: body.description != null ? String(body.description) : null,
      managedSiteId: body.managedSiteId != null ? String(body.managedSiteId) : null,
      projectId: body.projectId != null ? String(body.projectId) : null,
      primaryLocale: body.primaryLocale != null ? String(body.primaryLocale) : undefined,
      secondaryLocales: Array.isArray(body.secondaryLocales) ? body.secondaryLocales.map(String) : undefined,
      config: typeof body.config === 'object' && body.config ? (body.config as Record<string, unknown>) : undefined,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
