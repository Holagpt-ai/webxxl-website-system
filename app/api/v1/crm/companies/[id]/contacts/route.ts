import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { linkContactToCompany } from '@/lib/platform/crm/company-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: companyId } = await params
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as { contactId?: string; roleTitle?: string; isPrimary?: boolean }
    if (!body.contactId?.trim()) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'contactId required' }, { status: 400 })
    }
    const linked = await linkContactToCompany({
      customerAccountId: actor.customerAccountId,
      companyId,
      contactId: body.contactId.trim(),
      roleTitle: body.roleTitle,
      isPrimary: body.isPrimary,
    })
    if (!linked.ok) {
      return NextResponse.json({ code: linked.code, message: linked.message }, { status: crmResultHttpStatus(linked.code) })
    }
    return NextResponse.json(
      { id: linked.value.id, alreadyLinked: linked.value.alreadyLinked },
      { status: linked.value.alreadyLinked ? 200 : 201 },
    )
  } catch (error) {
    return crmRouteError(error)
  }
}
