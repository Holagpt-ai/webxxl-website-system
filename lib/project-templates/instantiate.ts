import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { ProjectTemplateDefinition } from '@/lib/project-templates/types'

export async function instantiateProjectTemplate(
  projectId: string,
  template: ProjectTemplateDefinition,
  tx: Prisma.TransactionClient = prisma,
) {
  const milestoneIds: string[] = []
  for (let i = 0; i < template.milestones.length; i += 1) {
    const m = template.milestones[i]
    const created = await tx.projectMilestone.create({
      data: {
        projectId,
        title: m.title,
        description: m.description,
        sortOrder: i,
        progressWeight: m.progressWeight,
        status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
      },
    })
    milestoneIds.push(created.id)
    for (const task of m.tasks) {
      await tx.projectTask.create({
        data: {
          projectId,
          milestoneId: created.id,
          title: task.title,
          assignedSide: task.assignedSide,
          status: 'TODO',
        },
      })
    }
  }

  for (const dep of template.dependencies) {
    const milestoneId =
      dep.milestoneIndex !== undefined && dep.milestoneIndex >= 0 && dep.milestoneIndex < milestoneIds.length
        ? milestoneIds[dep.milestoneIndex]
        : null
    await tx.projectDependency.create({
      data: {
        projectId,
        milestoneId,
        title: dep.title,
        description: dep.description,
        status: 'REQUESTED',
        customerActionKey: dep.customerActionKey,
        allowsCustomerAck: dep.allowsCustomerAck ?? false,
      },
    })
  }
}
