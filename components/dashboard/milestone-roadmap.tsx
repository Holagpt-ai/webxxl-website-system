import { enumLabel } from '@/lib/i18n/labels'
import { milestoneTaskSummary } from '@/lib/portal/progress'
import type { MilestoneStatus, TaskStatus } from '@prisma/client'

type MilestoneRow = {
  id: string
  title: string
  description: string | null
  status: MilestoneStatus
  progressWeight: number
  completedAt: Date | null
  targetDate: Date | null
}

type TaskRow = {
  id: string
  title: string
  status: TaskStatus
  milestoneId: string | null
  assignedSide: string
}

function fmtDate(d: Date | null, locale: string) {
  if (!d) return null
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(d)
}

export function MilestoneRoadmap({
  milestones,
  tasks,
  locale,
  copy,
}: {
  milestones: MilestoneRow[]
  tasks: TaskRow[]
  locale: string
  copy: {
    milestoneStatuses: Record<string, string>
    taskStatuses: Record<string, string>
    milestoneWeight: string
    milestoneCompleted: string
    tasksRemaining: string
    tasksBlocked: string
    tasksDone: string
    noTasksInMilestone: string
  }
}) {
  return (
    <ol className="flex flex-col gap-3">
      {milestones.map((milestone, index) => {
        const milestoneTasks = tasks.filter((t) => t.milestoneId === milestone.id)
        const summary = milestoneTaskSummary(milestoneTasks)
        const completedLabel = fmtDate(milestone.completedAt, locale)
        return (
          <li key={milestone.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {index + 1}. {milestone.title}
                </p>
                {milestone.description && <p className="mt-1 text-pretty text-muted-foreground">{milestone.description}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {enumLabel(copy.milestoneStatuses, milestone.status)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {copy.milestoneWeight}: {milestone.progressWeight}%
              {completedLabel && (
                <>
                  {' '}
                  · {copy.milestoneCompleted}: {completedLabel}
                </>
              )}
            </p>
            {milestoneTasks.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                {milestoneTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>{task.title}</span>
                    <span className="text-muted-foreground">{enumLabel(copy.taskStatuses, task.status)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{copy.noTasksInMilestone}</p>
            )}
            {summary.total > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.tasksDone}: {summary.done.length} · {copy.tasksRemaining}: {summary.open.length}
                {summary.blocked.length > 0 && (
                  <>
                    {' '}
                    · {copy.tasksBlocked}: {summary.blocked.length}
                  </>
                )}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
