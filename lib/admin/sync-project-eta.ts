import { prisma } from '@/lib/db'
import { calculateProjectEta } from '@/lib/portal/eta'

export type SyncProjectProgressOptions = {
  /** When true, only sync ETA-derived dates — keep staff-set progressPercent on the project row. */
  preserveProgressPercent?: boolean
}

/** Persist ETA-derived progress fields so customer dashboard stays in sync. */
export async function syncProjectProgressFromEta(projectId: string, options?: SyncProjectProgressOptions) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return null

  const [milestones, dependencies] = await Promise.all([
    prisma.projectMilestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    prisma.projectDependency.findMany({
      where: { projectId, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
    }),
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

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(options?.preserveProgressPercent ? {} : { progressPercent: eta.progressPercent }),
      estimatedCompletionDate: eta.estimatedCompletionDate,
    },
  })

  return eta
}
