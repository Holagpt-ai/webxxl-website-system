import { prisma } from '@/lib/db'
import type { Prisma, ProjectActivityEventType } from '@prisma/client'

export type WriteActivityInput = {
  projectId: string
  actorUserId?: string | null
  eventType: ProjectActivityEventType
  summary: string
  metadata?: Record<string, unknown>
}

export async function writeProjectActivity(input: WriteActivityInput) {
  return prisma.projectActivity.create({
    data: {
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

export function formatActivitySummary(eventType: ProjectActivityEventType, detail: string): string {
  const prefix: Record<ProjectActivityEventType, string> = {
    PROJECT_CREATED: 'Project created',
    MILESTONE_STARTED: 'Milestone started',
    MILESTONE_COMPLETED: 'Milestone completed',
    TASK_COMPLETED: 'Task completed',
    DEPENDENCY_REQUESTED: 'Customer action requested',
    DEPENDENCY_RESOLVED: 'Customer action completed',
    FILE_UPLOADED: 'File uploaded',
    COMMENT_POSTED: 'Message posted',
    APPROVAL_REQUESTED: 'Approval requested',
    APPROVAL_APPROVED: 'Work approved',
    CHANGES_REQUESTED: 'Changes requested',
    CHANGE_REQUEST_SUBMITTED: 'Change request submitted',
    SUPPORT_REQUEST_CREATED: 'Support request created',
  }
  return `${prefix[eventType]}: ${detail}`
}
