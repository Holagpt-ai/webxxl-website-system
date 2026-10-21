import { transitionCustomerAiEmployee } from '@/lib/platform/customer-ai-workforce/api'
import { customerAiDisabledResponse, customerAiResultResponse, customerAiRouteError, toCustomerAiActor } from '@/lib/platform/customer-ai-workforce/http'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import type { EmployeeLifecycleStatus } from '@/lib/platform/customer-ai-workforce/types'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; employeeId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const body = (await request.json()) as { status?: EmployeeLifecycleStatus }
    if (!body.status) {
      return customerAiResultResponse({ ok: false, error: 'VALIDATION', message: 'status required' })
    }
    const result = await transitionCustomerAiEmployee(prismaCustomerAiStore, toCustomerAiActor(user), accountId, employeeId, body.status)
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
