import { NextResponse } from 'next/server'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import {
  deleteDynamicSegment,
  evaluateSavedSegment,
  updateDynamicSegment,
} from '@/lib/platform/crm/segment-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'
import type { SegmentFilterGroup } from '@/lib/platform/crm/segment-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const { id } = await context.params
    const evaluated = await evaluateSavedSegment(actor.customerAccountId, id)
    if (!evaluated.ok) {
      return NextResponse.json({ code: evaluated.code, message: evaluated.message }, { status: crmResultHttpStatus(evaluated.code) })
    }
    return NextResponse.json(evaluated.value)
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to evaluate segment' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireCrmApiActor('crm.admin')
    const { id } = await context.params
    const body = (await request.json()) as { name?: string; filterDefinition?: SegmentFilterGroup }
    const updated = await updateDynamicSegment({
      customerAccountId: actor.customerAccountId,
      segmentId: id,
      name: body.name,
      filterDefinition: body.filterDefinition,
    })
    if (!updated.ok) {
      return NextResponse.json({ code: updated.code, message: updated.message }, { status: crmResultHttpStatus(updated.code) })
    }
    return NextResponse.json(updated.value)
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to update segment' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireCrmApiActor('crm.admin')
    const { id } = await context.params
    const deleted = await deleteDynamicSegment(actor.customerAccountId, id)
    if (!deleted.ok) {
      return NextResponse.json({ code: deleted.code, message: deleted.message }, { status: crmResultHttpStatus(deleted.code) })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to delete segment' }, { status: 500 })
  }
}
