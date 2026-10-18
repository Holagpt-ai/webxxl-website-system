import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createCrmDeal, ensureDefaultPipeline } from '@/lib/platform/crm/pipeline-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET() {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const deals = await prisma.crmDeal.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ deals })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load deals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as { title?: string; contactId?: string; companyId?: string; amountMinorUnits?: number }
    if (!body.title) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'title required' }, { status: 400 })
    const pipeline = await ensureDefaultPipeline(actor.customerAccountId)
    if (!pipeline.ok) {
      return NextResponse.json({ code: pipeline.code, message: pipeline.message }, { status: crmResultHttpStatus(pipeline.code) })
    }
    const created = await createCrmDeal({
      customerAccountId: actor.customerAccountId,
      pipelineId: pipeline.value.pipelineId,
      stageId: pipeline.value.stageIds[0]!,
      title: body.title,
      contactId: body.contactId,
      companyId: body.companyId,
      amountMinorUnits: body.amountMinorUnits,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    const deal = await prisma.crmDeal.findUnique({ where: { id: created.value.id } })
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create deal' }, { status: 500 })
  }
}
