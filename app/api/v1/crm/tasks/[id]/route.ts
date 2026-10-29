import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateCrmTask } from '@/lib/platform/crm/task-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'
import { MembershipRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: taskId } = await params
    const actor = await requireCrmApiActor('crm.write')
    const body = (await request.json()) as {
      title?: string
      status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
      dueAt?: string | null
      disposition?: string | null
      assignedUserId?: string | null
    }
    const allowAssigneeChange = actor.isStaff || actor.membershipRole === MembershipRole.OWNER
    const updated = await updateCrmTask({
      customerAccountId: actor.customerAccountId,
      taskId,
      allowAssigneeChange,
      patch: {
        title: body.title,
        status: body.status,
        priority: body.priority,
        dueAt: body.dueAt === undefined ? undefined : body.dueAt ? new Date(body.dueAt) : null,
        disposition: body.disposition,
        assignedUserId: body.assignedUserId,
      },
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
