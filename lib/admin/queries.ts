import { prisma } from '@/lib/db'

export async function getAdminDashboardStats() {
  const now = new Date()
  const [
    activeCustomers,
    activeProjects,
    openDependencies,
    pendingApprovals,
    openChangeRequests,
    openSupportRequests,
    blockedTasks,
    overdueTasks,
    recentActivity,
  ] = await Promise.all([
    prisma.customerAccount.count({ where: { status: 'ACTIVE' } }),
    prisma.project.count({ where: { status: 'ACTIVE' } }),
    prisma.projectDependency.count({ where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } }),
    prisma.projectApproval.count({ where: { status: 'PENDING' } }),
    prisma.changeRequest.count({
      where: { status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED'] } },
    }),
    prisma.supportRequest.count({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'] } },
    }),
    prisma.projectTask.count({ where: { status: 'BLOCKED' } }),
    prisma.projectTask.count({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
        dueDate: { lt: now },
      },
    }),
    prisma.projectActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        project: { select: { name: true, customerAccountId: true } },
        actor: { select: { name: true, email: true } },
      },
    }),
  ])

  return {
    activeCustomers,
    activeProjects,
    projectsNeedingCustomerAction: openDependencies,
    pendingApprovals,
    openChangeRequests,
    openSupportRequests,
    blockedTasks,
    overdueTasks,
    recentActivity,
  }
}

export async function listCustomers(search?: string) {
  const q = search?.trim()
  return prisma.customerAccount.findMany({
    where: q
      ? {
          OR: [
            { businessName: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { primaryContactEmail: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { projects: true, memberships: true } },
    },
  })
}

export async function getCustomerDetail(customerId: string) {
  return prisma.customerAccount.findUnique({
    where: { id: customerId },
    include: {
      memberships: {
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      projects: { orderBy: { updatedAt: 'desc' } },
      services: { orderBy: { serviceKey: 'asc' } },
    },
  })
}

export async function getCustomerRecentActivity(customerAccountId: string, take = 20) {
  const projects = await prisma.project.findMany({
    where: { customerAccountId },
    select: { id: true },
  })
  const projectIds = projects.map((p) => p.id)
  if (projectIds.length === 0) return []
  return prisma.projectActivity.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: 'desc' },
    take,
    include: { project: { select: { name: true } }, actor: { select: { email: true, name: true } } },
  })
}

export async function listProjects(status?: string) {
  return prisma.project.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      customerAccount: { select: { id: true, businessName: true, slug: true } },
      _count: { select: { milestones: true, tasks: true } },
    },
  })
}

export async function getProjectAdminDetail(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      customerAccount: { select: { id: true, businessName: true, slug: true } },
    },
  })
  if (!project) return null

  const [milestones, tasks, dependencies, approvals, changeRequests, activities, files, comments] = await Promise.all([
    prisma.projectMilestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    prisma.projectTask.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    prisma.projectDependency.findMany({ where: { projectId }, orderBy: { requestedFromCustomerAt: 'desc' } }),
    prisma.projectApproval.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
      include: { fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } } },
    }),
    prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        submittedBy: { select: { email: true, name: true } },
        fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } },
      },
    }),
    prisma.projectActivity.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { actor: { select: { email: true, name: true } } },
    }),
    prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { name: true, email: true } } },
    }),
    prisma.projectComment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true, email: true } } },
    }),
  ])

  return { project, milestones, tasks, dependencies, approvals, changeRequests, activities, files, comments }
}

export async function listPendingApprovals() {
  return prisma.projectApproval.findMany({
    where: { status: 'PENDING' },
    orderBy: { requestedAt: 'desc' },
    include: {
      project: {
        include: { customerAccount: { select: { businessName: true, id: true } } },
      },
      fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } },
    },
  })
}

export async function listChangeRequestQueue() {
  return prisma.changeRequest.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      project: { include: { customerAccount: { select: { businessName: true, id: true } } } },
      submittedBy: { select: { email: true, name: true } },
      fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } },
      managedSite: { select: { id: true, name: true, domain: true } },
    },
  })
}

export async function listSupportQueue() {
  return prisma.supportRequest.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      customerAccount: { select: { businessName: true, id: true } },
      project: { select: { id: true, name: true } },
      fileLinks: { include: { projectFile: { select: { id: true, originalName: true } } } },
    },
  })
}
