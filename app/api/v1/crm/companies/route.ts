import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createCrmCompany } from '@/lib/platform/crm/company-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET() {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const companies = await prisma.crmCompany.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { name: 'asc' },
      take: 50,
    })
    return NextResponse.json({ companies })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load companies' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as { name?: string; websiteDomain?: string; industry?: string }
    if (!body.name) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'name required' }, { status: 400 })
    const created = await createCrmCompany({
      customerAccountId: actor.customerAccountId,
      name: body.name,
      websiteDomain: body.websiteDomain,
      industry: body.industry,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    return NextResponse.json({ id: created.value.id }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create company' }, { status: 500 })
  }
}
