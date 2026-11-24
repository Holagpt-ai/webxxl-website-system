import { NextResponse } from 'next/server'
import { crmRouteError } from '@/lib/platform/crm/http'
import { getCrmCompanyForAccount, updateCrmCompany } from '@/lib/platform/crm/company-service'
import { parseCrmCustomFields, type CrmCustomFields } from '@/lib/platform/crm/custom-fields'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const actor = await requireCrmApiActor('crm.read')
    const company = await getCrmCompanyForAccount(id, actor.customerAccountId)
    if (!company.ok) {
      return NextResponse.json({ code: company.code, message: company.message }, { status: crmResultHttpStatus(company.code) })
    }
    return NextResponse.json({ company: company.value })
  } catch (error) {
    return crmRouteError(error)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as {
      name?: string
      websiteDomain?: string | null
      industry?: string | null
      phone?: string | null
      email?: string | null
      customFields?: unknown
    }
    let customFields: CrmCustomFields | null | undefined
    if (body.customFields !== undefined) {
      const parsed = parseCrmCustomFields(body.customFields)
      if (!parsed.ok) {
        return NextResponse.json({ code: parsed.code, message: parsed.message }, { status: crmResultHttpStatus(parsed.code) })
      }
      customFields = parsed.value
    }
    const updated = await updateCrmCompany(id, actor.customerAccountId, {
      name: body.name,
      websiteDomain: body.websiteDomain,
      industry: body.industry,
      phone: body.phone,
      email: body.email,
      customFields,
    })
    if (!updated.ok) {
      return NextResponse.json({ code: updated.code, message: updated.message }, { status: crmResultHttpStatus(updated.code) })
    }
    return NextResponse.json({ id: updated.value.id })
  } catch (error) {
    return crmRouteError(error)
  }
}
