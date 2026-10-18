import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWorkflowReadAccess } from '@/lib/platform/workflow/route-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const customerAccountId = url.searchParams.get('customerAccountId')
    await requireWorkflowReadAccess(customerAccountId)
    const where = customerAccountId ? { customerAccountId } : {}
    const [queueDepth, oldest, deadLetterCount, expiredLeaseCount] = await Promise.all([
      prisma.workflowJob.count({
        where: { ...where, status: { in: ['PENDING', 'READY', 'RETRY_WAIT', 'CLAIMED', 'RUNNING'] } },
      }),
      prisma.workflowJob.findFirst({
        where: { ...where, status: { in: ['PENDING', 'READY', 'RETRY_WAIT'] } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.workflowDeadLetter.count(),
      prisma.workflowJob.count({
        where: {
          ...where,
          status: { in: ['CLAIMED', 'RUNNING'] },
          leaseExpiresAt: { lt: new Date() },
        },
      }),
    ])
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
