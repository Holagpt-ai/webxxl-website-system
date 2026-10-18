import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createCrmContact } from '@/lib/platform/crm/contact-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireCrmApiActor()
    const url = new URL(request.url)
    const take = Math.min(Number(url.searchParams.get('take') ?? '50'), 100)
    const contacts = await prisma.crmContact.findMany({
      where: { customerAccountId: actor.customerAccountId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      take,
      include: { channelIdentities: true },
    })
    return NextResponse.json({ contacts })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('crm contacts GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load contacts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor()
    const body = (await request.json()) as {
      givenName?: string
      familyName?: string
      preferredName?: string
      emails?: string[]
      phones?: string[]
      leadSource?: string
      idempotencyKey?: string
    }
    const created = await createCrmContact({
      customerAccountId: actor.customerAccountId,
      givenName: body.givenName,
      familyName: body.familyName,
      preferredName: body.preferredName,
      emails: body.emails,
      phones: body.phones,
      leadSource: body.leadSource,
      idempotencyKey: body.idempotencyKey,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    const contact = await prisma.crmContact.findUnique({
      where: { id: created.value.id },
      include: { channelIdentities: true },
    })
    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('crm contacts POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create contact' }, { status: 500 })
  }
}
