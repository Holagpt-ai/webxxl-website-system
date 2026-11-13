import { prisma } from '@/lib/db'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import { SITE_LEAD_AWAITING_REVIEW_STATUSES } from '@/lib/platform/site-leads/funnel-metrics'
import type { AdminPlatformQueueCounts } from '@/lib/platform/admin-operations/types'

function projectAccountFilter(customerAccountId?: string) {
  return customerAccountId ? { customerAccountId } : {}
}

export async function loadPlatformOperationalQueues(customerAccountId?: string): Promise<
  | { ok: true; value: AdminPlatformQueueCounts }
  | { ok: false; reasonCode: string; message: string }
> {
  const now = new Date()
  const projectWhere = projectAccountFilter(customerAccountId)
  const leadWhere = customerAccountId
    ? { managedSite: { customerAccountId } }
    : {}

  try {
    const [
      activeCustomerAccounts,
      activeProjects,
      pendingProjectApprovals,
      openChangeRequests,
      openSupportRequests,
      openServiceOrders,
      websiteLeadsAwaitingReview,
      blockedProjectTasks,
      overdueProjectTasks,
    ] = await Promise.all([
      customerAccountId
        ? prisma.customerAccount.count({ where: { id: customerAccountId, status: 'ACTIVE' } })
        : prisma.customerAccount.count({ where: { status: 'ACTIVE' } }),
      prisma.project.count({ where: { ...projectWhere, status: 'ACTIVE' } }),
      prisma.projectApproval.count({
        where: {
          status: 'PENDING',
          ...(customerAccountId
            ? { project: { customerAccountId } }
            : {}),
        },
      }),
      prisma.changeRequest.count({
        where: {
          status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED'] },
          ...(customerAccountId ? { project: { customerAccountId } } : {}),
        },
      }),
      prisma.supportRequest.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'] },
          ...(customerAccountId ? { customerAccountId } : {}),
        },
      }),
      prisma.serviceOrder.count({
        where: {
          status: { in: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'APPROVED', 'IN_PROGRESS'] },
          ...(customerAccountId ? { customerAccountId } : {}),
        },
      }),
      prisma.managedSiteLead.count({
        where: {
          ...leadWhere,
          status: { in: SITE_LEAD_AWAITING_REVIEW_STATUSES },
        },
      }),
      prisma.projectTask.count({
        where: {
          status: 'BLOCKED',
          ...(customerAccountId ? { project: { customerAccountId } } : {}),
        },
      }),
      prisma.projectTask.count({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          dueDate: { lt: now },
          ...(customerAccountId ? { project: { customerAccountId } } : {}),
        },
      }),
    ])

    return {
      ok: true,
      value: {
        activeCustomerAccounts,
        activeProjects,
        pendingProjectApprovals,
        openChangeRequests,
        openSupportRequests,
        openServiceOrders,
        websiteLeadsAwaitingReview,
        blockedProjectTasks,
        overdueProjectTasks,
      },
    }
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return {
        ok: false,
        reasonCode: 'DATA_STORE_UNAVAILABLE',
        message: 'Operational queue tables are unavailable in this environment.',
      }
    }
    throw error
  }
}
