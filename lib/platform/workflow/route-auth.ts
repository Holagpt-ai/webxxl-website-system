import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isWorkflowReadEnabled } from '@/config/workflow-backend'

export async function requireWorkflowReadAccess(customerAccountId?: string | null): Promise<{ userId: string }> {
  if (!isWorkflowReadEnabled()) {
    throw new Error('WORKFLOW_READ_DISABLED')
  }
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('UNAUTHORIZED')
  if (!customerAccountId) return { userId }
  const membership = await prisma.customerMembership.findFirst({
    where: { userId, customerAccountId },
  })
  if (!membership) throw new Error('FORBIDDEN')
  return { userId }
}
