import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { prisma } from '@/lib/db'
import { ensureDefaultPipeline } from '@/lib/platform/crm/pipeline-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET() {
  try {
    const actor = await requireCrmApiActor('crm.read')
    await ensureDefaultPipeline(actor.customerAccountId)
    const pipelines = await prisma.crmPipeline.findMany({
      where: { customerAccountId: actor.customerAccountId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
    return NextResponse.json({ pipelines })
  } catch (error) {
    return crmRouteError(error)
  }
}
