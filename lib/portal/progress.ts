import type { MilestoneStatus } from '@prisma/client'

export type ProgressMilestone = {
  id?: string
  title: string
  status: MilestoneStatus
  progressWeight: number
}

/** Weighted completion from COMPLETED milestones only; normalizes when weights do not sum to 100. */
export function calculateProjectProgress(milestones: ProgressMilestone[]): number {
  if (milestones.length === 0) return 0
  const seen = new Set<string>()
  let totalWeight = 0
  let completedWeight = 0
  for (const milestone of milestones) {
    const key = milestone.id ?? milestone.title
    if (seen.has(key)) continue
    seen.add(key)
    const weight = Math.max(0, milestone.progressWeight)
    totalWeight += weight
    if (milestone.status === 'COMPLETED') completedWeight += weight
  }
  if (totalWeight <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((completedWeight / totalWeight) * 100)))
}

export function milestoneTaskSummary(tasks: { status: string }[]) {
  const open = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED')
  const blocked = open.filter((t) => t.status === 'BLOCKED')
  const done = tasks.filter((t) => t.status === 'DONE')
  return { open, blocked, done, total: tasks.length }
}
