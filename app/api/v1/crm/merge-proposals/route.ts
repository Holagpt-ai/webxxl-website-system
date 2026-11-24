import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { listMergeProposals, proposeContactMerge } from '@/lib/platform/crm/dedup-service'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'PENDING'
    const proposals = await listMergeProposals(actor.customerAccountId, status)
    return NextResponse.json({ proposals })
  } catch (error) {
    return crmRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.admin')
    const body = (await request.json()) as {
      primaryContactId?: string
      duplicateContactId?: string
      confidenceBps?: number
    }
    if (!body.primaryContactId || !body.duplicateContactId || body.confidenceBps === undefined) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'primaryContactId, duplicateContactId, and confidenceBps required' },
        { status: 400 },
      )
    }
    const created = await proposeContactMerge({
      customerAccountId: actor.customerAccountId,
      primaryContactId: body.primaryContactId,
      duplicateContactId: body.duplicateContactId,
      confidenceBps: body.confidenceBps,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    return NextResponse.json({ id: created.value.id }, { status: 201 })
  } catch (error) {
    return crmRouteError(error)
  }
}
