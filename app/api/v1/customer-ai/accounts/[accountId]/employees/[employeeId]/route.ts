import { getCustomerAiEmployee, updateCustomerAiEmployee } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; employeeId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const result = await getCustomerAiEmployee(prismaCustomerAiStore, toCustomerAiActor(user), accountId, employeeId)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const body = (await request.json()) as Record<string, unknown>
    const result = await updateCustomerAiEmployee(prismaCustomerAiStore, toCustomerAiActor(user), accountId, employeeId, {
      displayName: body.displayName != null ? String(body.displayName) : undefined,
      roleTitle: body.roleTitle != null ? String(body.roleTitle) : undefined,
      description: body.description !== undefined ? (body.description != null ? String(body.description) : null) : undefined,
      managedSiteId: body.managedSiteId !== undefined ? (body.managedSiteId != null ? String(body.managedSiteId) : null) : undefined,
      projectId: body.projectId !== undefined ? (body.projectId != null ? String(body.projectId) : null) : undefined,
      primaryLocale: body.primaryLocale != null ? String(body.primaryLocale) : undefined,
      secondaryLocales: Array.isArray(body.secondaryLocales) ? body.secondaryLocales.map(String) : undefined,
      config: typeof body.config === 'object' && body.config ? (body.config as Record<string, unknown>) : undefined,
      emergencyPaused: typeof body.emergencyPaused === 'boolean' ? body.emergencyPaused : undefined,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
