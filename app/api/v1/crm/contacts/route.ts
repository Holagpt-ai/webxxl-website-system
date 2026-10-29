import { NextResponse } from 'next/server'
import { createCrmContact } from '@/lib/platform/crm/contact-service'
import { listCrmContacts } from '@/lib/platform/crm/contact-list-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const url = new URL(request.url)
    const take = Number(url.searchParams.get('take') ?? undefined)
    const search = url.searchParams.get('q') ?? url.searchParams.get('search') ?? undefined
    const cursor = url.searchParams.get('cursor') ?? undefined
    const listed = await listCrmContacts({
      customerAccountId: actor.customerAccountId,
      take,
      search,
      cursor,
    })
    if (!listed.ok) {
      return NextResponse.json({ code: listed.code, message: listed.message }, { status: crmResultHttpStatus(listed.code) })
    }
    const body: { contacts: typeof listed.value.contacts; nextCursor?: string } = { contacts: listed.value.contacts }
    if (listed.value.nextCursor) body.nextCursor = listed.value.nextCursor
    return NextResponse.json(body)
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
    const actor = await requireCrmApiActor('crm.write')
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
