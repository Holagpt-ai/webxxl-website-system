import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clampWorkflowPagination, resolveWorkflowReadScope } from '@/lib/platform/workflow/route-auth'
import { toWorkflowRunListItem } from '@/lib/platform/workflow/read-dto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const customerAccountId = url.searchParams.get('customerAccountId')
    const scope = await resolveWorkflowReadScope(customerAccountId)
    if (scope.kind === 'platform' && !customerAccountId) {
      /* staff-only platform listing */
    } else if (!customerAccountId) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 })
    }
    const { take, skip } = clampWorkflowPagination(
      url.searchParams.get('take'),
      url.searchParams.get('skip'),
    )
    const where =
      scope.kind === 'account'
        ? { customerAccountId: scope.customerAccountId }
        : customerAccountId
          ? { customerAccountId }
          : {}
    const rows = await prisma.workflowJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
    return NextResponse.json({ runs: rows.map(toWorkflowRunListItem) })
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
