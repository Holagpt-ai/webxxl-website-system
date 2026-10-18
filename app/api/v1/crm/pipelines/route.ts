import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ensureDefaultPipeline } from '@/lib/platform/crm/pipeline-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET() {
  try {
    const actor = await requireCrmApiActor()
    await ensureDefaultPipeline(actor.customerAccountId)
    const pipelines = await prisma.crmPipeline.findMany({
      where: { customerAccountId: actor.customerAccountId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json({ pipelines })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load pipelines' }, { status: 500 })
  }
}
