import { NextResponse } from 'next/server'
import { listContactTimeline } from '@/lib/platform/crm/timeline-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const actor = await requireCrmApiActor('crm.read')
    const events = await listContactTimeline(id, actor.customerAccountId)
    return NextResponse.json({ events })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load timeline' }, { status: 500 })
  }
}
