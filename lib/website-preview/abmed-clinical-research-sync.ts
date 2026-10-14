import { prisma } from '@/lib/db'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { syncProjectProgressFromEta } from '@/lib/admin/sync-project-eta'
import { ABMED_CLINICAL_RESEARCH_PROJECT_ID } from '@/lib/website-preview/catalog'

export const ABMED_AI_CONCIERGE_TASK_ID = 'abmed-cr-t-03' as const
export const ABMED_AI_MILESTONE_ID = 'abmed-cr-ms-04' as const

const AI_MILESTONE_DESCRIPTION =
  'Bilingual AI Research Concierge is live on production (Groq, approved knowledge, New Chat and scroll fixes). Resend contact delivery remains deferred until final production cleanup.'

const AI_TASK_TITLE =
  'Implement real bilingual AI Research Concierge with safety guardrails'

export type AbmedClinicalResearchSyncResult = {
  projectId: string
  taskUpdated: boolean
  milestoneUpdated: boolean
  progressPercent: number
  activityRecorded: boolean
}

/** Idempotent milestone/task sync after ABMED website batches 19–20.2. */
export async function syncAbmedClinicalResearchDeliveryProgress(
  actorUserId: string,
): Promise<AbmedClinicalResearchSyncResult | null> {
  const projectId = ABMED_CLINICAL_RESEARCH_PROJECT_ID
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return null

  const [task, milestone] = await Promise.all([
    prisma.projectTask.findFirst({ where: { id: ABMED_AI_CONCIERGE_TASK_ID, projectId } }),
    prisma.projectMilestone.findFirst({ where: { id: ABMED_AI_MILESTONE_ID, projectId } }),
  ])
  if (!task || !milestone) return null

  let taskUpdated = false
  if (task.status !== 'DONE') {
    await prisma.projectTask.update({
      where: { id: task.id },
      data: { status: 'DONE', completedAt: new Date() },
    })
    taskUpdated = true
  }

  let milestoneUpdated = false
  if (milestone.description !== AI_MILESTONE_DESCRIPTION || milestone.status !== 'IN_PROGRESS') {
    await prisma.projectMilestone.update({
      where: { id: milestone.id },
      data: {
        status: 'IN_PROGRESS',
        description: AI_MILESTONE_DESCRIPTION,
      },
    })
    milestoneUpdated = true
  }

  let activityRecorded = false
  if (taskUpdated) {
    const existing = await prisma.projectActivity.findFirst({
      where: {
        projectId,
        eventType: 'TASK_COMPLETED',
        summary: formatActivitySummary('TASK_COMPLETED', AI_TASK_TITLE),
      },
    })
    if (!existing) {
      await writeProjectActivity({
        projectId,
        actorUserId,
        eventType: 'TASK_COMPLETED',
        summary: formatActivitySummary('TASK_COMPLETED', AI_TASK_TITLE),
        metadata: { taskId: task.id, milestoneId: milestone.id },
      })
      activityRecorded = true
    }
  }

  const eta = await syncProjectProgressFromEta(projectId)
  return {
    projectId,
    taskUpdated,
    milestoneUpdated,
    progressPercent: eta?.progressPercent ?? project.progressPercent,
    activityRecorded,
  }
}

export async function recordAbmedRecruitingOwnerConfirmation(actorUserId: string): Promise<boolean> {
  const projectId = ABMED_CLINICAL_RESEARCH_PROJECT_ID
  const summary =
    'Owner confirmed (Oct 14, 2026) that WordPress recruiting and compensation language remains current; full site content verification is still required.'
  const existing = await prisma.projectActivity.findFirst({
    where: { projectId, eventType: 'COMMENT_POSTED', summary },
  })
  if (existing) return false
  await writeProjectActivity({
    projectId,
    actorUserId,
    eventType: 'COMMENT_POSTED',
    summary,
    metadata: { source: 'owner_confirmation', scope: 'recruiting_compensation_only' },
  })
  return true
}
