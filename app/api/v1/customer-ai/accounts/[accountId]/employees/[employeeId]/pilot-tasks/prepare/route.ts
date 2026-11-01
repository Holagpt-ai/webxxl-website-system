import { prepareCustomerAiPilotTaskApi } from '@/lib/platform/customer-ai-workforce/pilot-api'
import {
  customerAiPilotPrepDisabledResponse,
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
    const disabled = customerAiPilotPrepDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId, employeeId } = await params
    const body = (await request.json()) as {
      workflowKind?: CustomerAiPilotWorkflowKind
      idempotencyKey?: string
      managedSiteId?: string | null
      prepareConsequentialDraft?: boolean
      locale?: string
      scopedSnapshot?: Record<string, unknown>
      snapshotAccountId?: string
      dataClassification?: string
    }
    if (!body.workflowKind || !body.idempotencyKey) {
      return customerAiResultResponse({ ok: false, error: 'VALIDATION', message: 'workflowKind and idempotencyKey required' })
    }
    const result = await prepareCustomerAiPilotTaskApi(prismaCustomerAiStore, toCustomerAiActor(user), {
      customerAccountId: accountId,
      employeeId,
      managedSiteId: body.managedSiteId ?? null,
      workflowKind: body.workflowKind,
      idempotencyKey: body.idempotencyKey,
      prepareConsequentialDraft: body.prepareConsequentialDraft ?? false,
      context: {
        locale: body.locale ?? 'en',
        managedSiteId: body.managedSiteId ?? null,
        scopedSnapshot: body.scopedSnapshot,
      },
      snapshotAccountId: body.snapshotAccountId,
      dataClassification: body.dataClassification,
    })
    return customerAiResultResponse(result)
  } catch (error) {
    return customerAiRouteError(error)
  }
}
