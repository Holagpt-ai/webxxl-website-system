import { listCustomerAiToolPermissions, setCustomerAiToolPermission } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import type { ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; employeeId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const result = await listCustomerAiToolPermissions(prismaCustomerAiStore, toCustomerAiActor(user), accountId, employeeId)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const body = (await request.json()) as { toolKey?: string; accessMode?: ToolAccessMode; granted?: boolean }
    if (!body.toolKey || !body.accessMode || typeof body.granted !== 'boolean') {
      return customerAiResultResponse({ ok: false, error: 'VALIDATION', message: 'toolKey, accessMode, granted required' })
    }
    const result = await setCustomerAiToolPermission(
      prismaCustomerAiStore,
      toCustomerAiActor(user),
      accountId,
      employeeId,
      body.toolKey,
      body.accessMode,
      body.granted,
    )
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
