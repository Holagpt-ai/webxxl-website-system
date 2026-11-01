import { prepareCustomerAiPilotTaskApi } from '@/lib/platform/customer-ai-workforce/pilot-api'
import {
  customerAiPilotHttpDisabledResponse,
  customerAiResultResponse,
  customerAiRouteError,
  toCustomerAiActor,
} from '@/lib/platform/customer-ai-workforce/http'
import type { CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string; employeeId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = customerAiPilotHttpDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const body = (await request.json()) as {
      workflowKind?: CustomerAiPilotWorkflowKind
      idempotencyKey?: string
      prepareConsequentialDraft?: boolean
      locale?: string
    }
    if (!body.workflowKind || !body.idempotencyKey) {
      return customerAiResultResponse({ ok: false, error: 'VALIDATION', message: 'workflowKind and idempotencyKey required' })
    }
    const employee = await prismaCustomerAiStore.findEmployeeById(employeeId)
    if (!employee || employee.customerAccountId !== accountId) {
      return customerAiResultResponse({ ok: false, error: 'NOT_FOUND', message: 'Employee not found' })
    }
    const result = await prepareCustomerAiPilotTaskApi(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      employeeId,
      managedSiteId: employee.managedSiteId,
      workflowKind: body.workflowKind,
      idempotencyKey: body.idempotencyKey,
      prepareConsequentialDraft: body.prepareConsequentialDraft ?? false,
      context: {
        locale: body.locale ?? employee.primaryLocale ?? 'en',
        managedSiteId: employee.managedSiteId,
        trustedDataSource: 'SERVER',
      },
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
