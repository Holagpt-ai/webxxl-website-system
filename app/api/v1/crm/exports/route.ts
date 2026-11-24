import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { exportContactsCsvPage } from '@/lib/platform/crm/import-export-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.export')
    const body = (await request.json()) as { cursor?: string; take?: number; targetAccountId?: string }
    if (body.targetAccountId && body.targetAccountId !== actor.customerAccountId) {
      return NextResponse.json({ code: 'FORBIDDEN', message: 'Cross-account export denied' }, { status: 403 })
    }
    const exported = await exportContactsCsvPage({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      cursor: body.cursor,
      take: body.take,
    })
    if (!exported.ok) {
      return NextResponse.json({ code: exported.code, message: exported.message }, { status: crmResultHttpStatus(exported.code) })
    }
    return NextResponse.json(exported.value)
  } catch (error) {
    return crmRouteError(error)
  }
}
