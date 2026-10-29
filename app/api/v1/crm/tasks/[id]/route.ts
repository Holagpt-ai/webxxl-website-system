import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateCrmTask } from '@/lib/platform/crm/task-service'
import { parseTaskUpdateBody } from '@/lib/platform/crm/crm-task-input'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'
import { MembershipRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: taskId } = await params
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseTaskUpdateBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ code: parsed.code, message: parsed.message }, { status: crmResultHttpStatus(parsed.code) })
    }
    const allowAssigneeChange = actor.isStaff || actor.membershipRole === MembershipRole.OWNER
    const updated = await updateCrmTask({
      customerAccountId: actor.customerAccountId,
      taskId,
      allowAssigneeChange,
      patch: parsed.value,
    })
    if (!updated.ok) {
      return NextResponse.json({ code: updated.code, message: updated.message }, { status: crmResultHttpStatus(updated.code) })
    }
    const task = await prisma.crmTask.findFirst({
      where: { id: taskId, customerAccountId: actor.customerAccountId },
    })
    return NextResponse.json({ task })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to update task' }, { status: 500 })
  }
}
