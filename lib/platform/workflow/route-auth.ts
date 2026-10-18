import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isStaffRole } from '@/lib/admin/roles'
import { isWorkflowReadEnabled } from '@/config/workflow-backend'

export type WorkflowReadScope =
  | { kind: 'account'; userId: string; customerAccountId: string }
  | { kind: 'platform'; userId: string }

export async function resolveWorkflowReadScope(
  customerAccountId?: string | null,
): Promise<WorkflowReadScope> {
  if (!isWorkflowReadEnabled()) {
    throw new Error('WORKFLOW_READ_DISABLED')
  }
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('UNAUTHORIZED')

  if (customerAccountId) {
    const membership = await prisma.customerMembership.findFirst({
      where: { userId, customerAccountId },
    })
    if (!membership) throw new Error('FORBIDDEN')
    return { kind: 'account', userId, customerAccountId }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !isStaffRole(user.role)) throw new Error('FORBIDDEN')
  return { kind: 'platform', userId }
}

export async function authorizeWorkflowJobRead(
  job: { customerAccountId: string | null },
  scope: WorkflowReadScope,
): Promise<void> {
  if (job.customerAccountId == null) {
    if (scope.kind !== 'platform') throw new Error('NOT_FOUND')
    return
  }
  if (scope.kind === 'platform') return
  if (scope.customerAccountId !== job.customerAccountId) throw new Error('NOT_FOUND')
}

export function clampWorkflowPagination(takeRaw: string | null, skipRaw: string | null): {
  take: number
  skip: number
} {
  const take = Math.min(Math.max(Number(takeRaw ?? '50') || 50, 1), 100)
  const skip = Math.max(Number(skipRaw ?? '0') || 0, 0)
  return { take, skip }
}
