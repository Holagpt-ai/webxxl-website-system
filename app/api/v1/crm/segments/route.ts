import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { prisma } from '@/lib/db'
import { createDynamicSegment, evaluateSegmentForAccount } from '@/lib/platform/crm/segment-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'
import type { SegmentFilterGroup } from '@/lib/platform/crm/segment-engine'

export async function GET() {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const segments = await prisma.crmSegment.findMany({ where: { customerAccountId: actor.customerAccountId } })
    return NextResponse.json({ segments })
  } catch (error) {
    return crmRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; filterDefinition?: SegmentFilterGroup; evaluateOnly?: boolean }
    if (!body.filterDefinition) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'filterDefinition required' }, { status: 400 })
    }
    if (body.evaluateOnly) {
      const actor = await requireCrmApiActor('crm.read')
      const evaluated = await evaluateSegmentForAccount(actor.customerAccountId, body.filterDefinition)
      if (!evaluated.ok) {
        return NextResponse.json({ code: evaluated.code, message: evaluated.message }, { status: crmResultHttpStatus(evaluated.code) })
      }
      return NextResponse.json(evaluated.value)
    }
    if (!body.name) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'name required' }, { status: 400 })
    const actor = await requireCrmApiActor('crm.admin')
    const created = await createDynamicSegment({
      customerAccountId: actor.customerAccountId,
      name: body.name,
      filterDefinition: body.filterDefinition,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    return NextResponse.json({ id: created.value.id }, { status: 201 })
  } catch (error) {
    return crmRouteError(error)
  }
}
