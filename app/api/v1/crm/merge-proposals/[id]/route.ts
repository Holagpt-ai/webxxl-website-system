import { NextResponse } from 'next/server'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { approveMergeProposal, rejectMergeProposal } from '@/lib/platform/crm/dedup-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireCrmApiActor('crm.admin')
    const { id } = await context.params
    const body = (await request.json()) as { action?: 'approve' | 'reject' }
    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'action must be approve or reject' }, { status: 400 })
    }
    const result =
      body.action === 'approve'
        ? await approveMergeProposal({
            customerAccountId: actor.customerAccountId,
            proposalId: id,
            actorUserId: actor.userId,
          })
        : await rejectMergeProposal({
            customerAccountId: actor.customerAccountId,
            proposalId: id,
            actorUserId: actor.userId,
          })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: crmResultHttpStatus(result.code) })
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to resolve merge proposal' }, { status: 500 })
  }
}
