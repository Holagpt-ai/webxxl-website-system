import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkflowReadAccess } from '@/lib/platform/workflow/route-auth'
import { toWorkflowRunListItem } from '@/lib/platform/workflow/read-dto'

type Params = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const job = await prisma.workflowJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
    await requireWorkflowReadAccess(job.customerAccountId)
    const events = await prisma.workflowEvent.findMany({
      where: { workflowJobId: id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return NextResponse.json({ run: toWorkflowRunListItem(job), events })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    if (message === 'UNAUTHORIZED') return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
    if (message === 'FORBIDDEN') return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 })
    if (message === 'WORKFLOW_READ_DISABLED') {
      return NextResponse.json({ code: 'NOT_CONFIGURED' }, { status: 404 })
    }
    return NextResponse.json({ code: 'ERROR', message }, { status: 500 })
  }
}
