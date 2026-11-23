import { NextResponse } from 'next/server'
import { unlinkContactFromCompany } from '@/lib/platform/crm/company-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string; contactId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id: companyId, contactId } = await params
    const actor = await requireCrmApiActor('crm.write')
    const unlinked = await unlinkContactFromCompany({
      customerAccountId: actor.customerAccountId,
      companyId,
      contactId,
    })
    if (!unlinked.ok) {
      return NextResponse.json(
        { code: unlinked.code, message: unlinked.message },
        { status: crmResultHttpStatus(unlinked.code) },
      )
    }
    return NextResponse.json({ id: unlinked.value.id })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to unlink contact from company' }, { status: 500 })
  }
}
