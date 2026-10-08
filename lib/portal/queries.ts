import { prisma } from '@/lib/db'
import { calculateProjectEta } from '@/lib/portal/eta'
import { filterCustomerComments } from '@/lib/portal/access-rules'
import type { PortalUser } from '@/lib/portal/authz'
import { getActiveProject } from '@/lib/portal/authz'

export async function getDashboardOverview(portal: PortalUser) {
  const project = await getActiveProject(portal.customerAccount.id)
  if (!project) {
    return {
      project: null,
      eta: null,
      milestones: [],
      dependencies: [],
      approvals: [],
      activities: [],
      comments: [],
      files: [],
      services: [],
      tasks: { webxxl: [], customer: [] },
    }
  }

  const [milestones, dependencies, approvals, activities, comments, files, services, tasks] = await Promise.all([
    prisma.projectMilestone.findMany({ where: { projectId: project.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.projectDependency.findMany({
      where: { projectId: project.id, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
      orderBy: { requestedFromCustomerAt: 'desc' },
    }),
    prisma.projectApproval.findMany({
      where: { projectId: project.id, status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
      take: 5,
    }),
    prisma.projectActivity.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.projectComment.findMany({
      where: { projectId: project.id, visibility: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { author: { select: { name: true, email: true } } },
    }),
    prisma.projectFile.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.customerService.findMany({ where: { customerAccountId: portal.customerAccount.id } }),
    prisma.projectTask.findMany({ where: { projectId: project.id }, orderBy: { dueDate: 'asc' } }),
  ])

  const eta = calculateProjectEta({
    projectStatus: project.status,
    targetDate: project.targetDate,
    estimatedCompletionDate: project.estimatedCompletionDate,
    milestones: milestones.map((m) => ({
      title: m.title,
      status: m.status,
      progressWeight: m.progressWeight,
      targetDate: m.targetDate,
      completedAt: m.completedAt,
    })),
    customerOpenDependencies: dependencies.map((d) => ({ status: d.status, dueDate: d.dueDate })),
  })

  const customerTasks = tasks.filter((t) => t.assignedSide === 'CUSTOMER' && t.status !== 'DONE')
  const webxxlTasks = tasks.filter((t) => t.assignedSide === 'WEBXXL' && t.status !== 'DONE')

  return {
    project,
    eta,
    milestones,
    dependencies,
    approvals,
    activities,
    comments: filterCustomerComments(comments),
    files,
    services,
    tasks: { webxxl: webxxlTasks, customer: customerTasks },
  }
}

export async function getProjectDetail(portal: PortalUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, customerAccountId: portal.customerAccount.id },
  })
  if (!project) return null

  const [milestones, tasks, dependencies, activities] = await Promise.all([
    prisma.projectMilestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    prisma.projectTask.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    prisma.projectDependency.findMany({ where: { projectId }, orderBy: { requestedFromCustomerAt: 'desc' } }),
    prisma.projectActivity.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ])

  const eta = calculateProjectEta({
    projectStatus: project.status,
    targetDate: project.targetDate,
    estimatedCompletionDate: project.estimatedCompletionDate,
    milestones: milestones.map((m) => ({
      title: m.title,
      status: m.status,
      progressWeight: m.progressWeight,
      targetDate: m.targetDate,
      completedAt: m.completedAt,
    })),
    customerOpenDependencies: dependencies
      .filter((d) => d.status === 'REQUESTED' || d.status === 'IN_PROGRESS')
      .map((d) => ({ status: d.status, dueDate: d.dueDate })),
  })

  return { project, milestones, tasks, dependencies, activities, eta }
}
