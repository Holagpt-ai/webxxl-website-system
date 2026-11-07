import type { MilestoneStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { CUSTOMER_OPERATIONS_MAX_LINEAGE } from '@/lib/platform/customer-operations/constants'
import type {
  CustomerOperationsCrmLinkage,
  CustomerOperationsLeadLineage,
  CustomerOperationsProjectContext,
} from '@/lib/platform/customer-operations/types'

const OPEN_MILESTONE: MilestoneStatus[] = ['PENDING', 'IN_PROGRESS']

async function loadProjectContext(input: {
  customerAccountId: string
  projectId: string
}): Promise<CustomerOperationsProjectContext | null> {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, customerAccountId: input.customerAccountId },
    select: {
      id: true,
      name: true,
      progressPercent: true,
      estimatedCompletionDate: true,
    },
  })
  if (!project) return null

  const [pendingApprovals, openDependencies, nextMilestone] = await Promise.all([
    prisma.projectApproval.count({
      where: { projectId: project.id, status: 'PENDING' },
    }),
    prisma.projectDependency.count({
      where: { projectId: project.id, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
    }),
    prisma.projectMilestone.findFirst({
      where: { projectId: project.id, status: { in: OPEN_MILESTONE } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { title: true },
    }),
  ])

  return {
    projectId: project.id,
    projectName: project.name,
    progressPercent: project.progressPercent,
    estimatedCompletionDate: project.estimatedCompletionDate?.toISOString() ?? null,
    pendingApprovals,
    openDependencies,
    nextMilestoneTitle: nextMilestone?.title ?? null,
    destination: { path: BUSINESS_DESTINATIONS.projectDetail },
  }
}

async function loadCrmLinkage(input: {
  customerAccountId: string
  contactId: string
}): Promise<CustomerOperationsCrmLinkage> {
  const [openDeals, openTasks] = await Promise.all([
    prisma.crmDeal.count({
      where: { customerAccountId: input.customerAccountId, contactId: input.contactId, status: 'OPEN' },
    }),
    prisma.crmTask.count({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: input.contactId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),
  ])
  return {
    contactId: input.contactId,
    openDeals,
    openTasks,
    destination: { path: BUSINESS_DESTINATIONS.crmContact(input.contactId) },
  }
}

export async function loadRecentLeadLineage(customerAccountId: string): Promise<CustomerOperationsLeadLineage[]> {
  try {
    const leads = await prisma.managedSiteLead.findMany({
      where: { customerAccountId },
      orderBy: { createdAt: 'desc' },
      take: CUSTOMER_OPERATIONS_MAX_LINEAGE,
      select: {
        id: true,
        status: true,
        managedSiteId: true,
        submittedAt: true,
        qualifiedAt: true,
        convertedAt: true,
        rejectedAt: true,
        crmContactId: true,
        managedSite: {
          select: {
            name: true,
            projectId: true,
          },
        },
      },
    })

    const lineage: CustomerOperationsLeadLineage[] = []
    for (const lead of leads) {
      let crm: CustomerOperationsCrmLinkage | null = null
      if (lead.crmContactId) {
        crm = await loadCrmLinkage({ customerAccountId, contactId: lead.crmContactId })
      }

      let project: CustomerOperationsProjectContext | null = null
      const projectId = lead.managedSite.projectId
      if (projectId) {
        project = await loadProjectContext({ customerAccountId, projectId })
      }

      lineage.push({
        leadId: lead.id,
        status: lead.status,
        managedSiteId: lead.managedSiteId,
        managedSiteName: lead.managedSite.name,
        submittedAt: lead.submittedAt.toISOString(),
        qualification: {
          qualifiedAt: lead.qualifiedAt?.toISOString() ?? null,
          convertedAt: lead.convertedAt?.toISOString() ?? null,
          rejectedAt: lead.rejectedAt?.toISOString() ?? null,
        },
        crm,
        project,
        destinations: {
          leadReview: { path: BUSINESS_DESTINATIONS.crmLeads },
        },
      })
    }
    return lineage
  } catch (error) {
    if (isPrismaMissingTableError(error)) return []
    throw error
  }
}
