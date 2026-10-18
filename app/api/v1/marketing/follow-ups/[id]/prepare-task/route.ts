import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { prepareFollowUpCallbackTask } from '@/lib/platform/marketing/follow-up-task-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.followup.manage')
    const { id } = await params
    const body = (await request.json()) as { assignedUserId?: string; idempotencyKey?: string }
    if (!body.assignedUserId || !body.idempotencyKey) {
      return NextResponse.json({ code: 'VALIDATION', message: 'assignedUserId and idempotencyKey required' }, { status: 400 })
    }
    const evaluation = await prisma.marketingLeadFollowUpEvaluation.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
    })
    if (!evaluation) return NextResponse.json({ code: 'NOT_FOUND', message: 'Evaluation not found' }, { status: 404 })
    const prepared = await prepareFollowUpCallbackTask({
      customerAccountId: actor.customerAccountId,
      contactId: evaluation.crmContactId,
      assignedUserId: body.assignedUserId,
      idempotencyKey: body.idempotencyKey,
      dueAt: evaluation.dueAt ?? undefined,
    })
    if (prepared.ok && prepared.value.created) {
      await prisma.marketingLeadFollowUpEvaluation.update({
        where: { id: evaluation.id },
        data: { resolutionState: 'TASK_PREPARED', responsibleUserId: body.assignedUserId },
      })
    }
    return mktServiceResponse(prepared, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}
