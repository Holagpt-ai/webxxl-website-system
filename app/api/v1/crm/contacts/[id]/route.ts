import { NextResponse } from 'next/server'
import { getCrmContactForAccount, updateCrmContact } from '@/lib/platform/crm/contact-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const actor = await requireCrmApiActor()
    const contact = await getCrmContactForAccount(id, actor.customerAccountId)
    if (!contact.ok) {
      return NextResponse.json({ code: contact.code, message: contact.message }, { status: crmResultHttpStatus(contact.code) })
    }
    return NextResponse.json({ contact: contact.value })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load contact' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const actor = await requireCrmApiActor()
    const body = (await request.json()) as { givenName?: string; familyName?: string; preferredName?: string; jobTitle?: string }
    const updated = await updateCrmContact(id, actor.customerAccountId, body)
    if (!updated.ok) {
      return NextResponse.json({ code: updated.code, message: updated.message }, { status: crmResultHttpStatus(updated.code) })
    }
    return NextResponse.json({ id: updated.value.id })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to update contact' }, { status: 500 })
  }
}
