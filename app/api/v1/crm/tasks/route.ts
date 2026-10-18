import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createCrmTask } from '@/lib/platform/crm/task-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function GET() {
  try {
    const actor = await requireCrmApiActor('crm.read')
    const tasks = await prisma.crmTask.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { dueAt: 'asc' },
      take: 50,
    })
    return NextResponse.json({ tasks })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as { title?: string; contactId?: string; dealId?: string; dueAt?: string; idempotencyKey?: string }
    if (!body.title) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'title required' }, { status: 400 })
    const created = await createCrmTask({
      customerAccountId: actor.customerAccountId,
      title: body.title,
      contactId: body.contactId,
      dealId: body.dealId,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      idempotencyKey: body.idempotencyKey,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: crmResultHttpStatus(created.code) })
    }
    return NextResponse.json({ id: created.value.id }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create task' }, { status: 500 })
  }
}
