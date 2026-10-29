import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { moveDealStage } from '@/lib/platform/crm/pipeline-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: dealId } = await params
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as { stageId?: string; toStageId?: string }
    const toStageId = body.stageId ?? body.toStageId
    if (!toStageId) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'stageId required' }, { status: 400 })
    }
    const moved = await moveDealStage({
      customerAccountId: actor.customerAccountId,
      dealId,
      toStageId,
      changedByUserId: actor.userId,
    })
    if (!moved.ok) {
      return NextResponse.json({ code: moved.code, message: moved.message }, { status: crmResultHttpStatus(moved.code) })
    }
    const deal = await prisma.crmDeal.findFirst({
      where: { id: moved.value.id, customerAccountId: actor.customerAccountId },
    })
    return NextResponse.json({ deal })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to update deal stage' }, { status: 500 })
  }
}
