import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clampWorkflowPagination, resolveWorkflowReadScope } from '@/lib/platform/workflow/route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const customerAccountId = url.searchParams.get('customerAccountId')
    const scope = await resolveWorkflowReadScope(customerAccountId)
    if (scope.kind !== 'platform' && !customerAccountId) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 })
    }
    clampWorkflowPagination('50', '0')

    const jobWhere =
      scope.kind === 'account'
        ? { customerAccountId: scope.customerAccountId }
        : customerAccountId
          ? { customerAccountId }
          : {}

    const [queueDepth, oldest, expiredLeaseCount] = await Promise.all([
      prisma.workflowJob.count({
        where: { ...jobWhere, status: { in: ['PENDING', 'READY', 'RETRY_WAIT', 'CLAIMED', 'RUNNING'] } },
      }),
      prisma.workflowJob.findFirst({
        where: { ...jobWhere, status: { in: ['PENDING', 'READY', 'RETRY_WAIT'] } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.workflowJob.count({
        where: {
          ...jobWhere,
          status: { in: ['CLAIMED', 'RUNNING'] },
          leaseExpiresAt: { lt: new Date() },
        },
      }),
    ])

    const deadLetterCount = await prisma.workflowDeadLetter.count({
      where: scope.kind === 'account' || customerAccountId
        ? { workflowJob: { customerAccountId: scope.kind === 'account' ? scope.customerAccountId : customerAccountId! } }
        : {},
    })

    const oldestJobAgeMs = oldest ? Date.now() - oldest.createdAt.getTime() : null
    return NextResponse.json({
      summary: { queueDepth, oldestJobAgeMs, deadLetterCount, expiredLeaseCount },
    })
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
