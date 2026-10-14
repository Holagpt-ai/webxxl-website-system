import type { DependencyStatus, MilestoneStatus, ProjectStatus } from '@prisma/client'
import { calculateProjectProgress } from '@/lib/portal/progress'

export type EtaMilestone = {
  id?: string
  title: string
  status: MilestoneStatus
  progressWeight: number
  targetDate: Date | null
  completedAt: Date | null
}

export type EtaDependency = {
  status: DependencyStatus
  dueDate: Date | null
}

export type EtaInput = {
  projectStatus: ProjectStatus
  targetDate: Date | null
  estimatedCompletionDate: Date | null
  milestones: EtaMilestone[]
  customerOpenDependencies: EtaDependency[]
  now?: Date
}

export type EtaState = 'pending_setup' | 'waiting_on_customer' | 'on_track' | 'at_risk' | 'delayed' | 'complete'

export type EtaResult = {
  progressPercent: number
  currentMilestoneTitle: string | null
  nextMilestoneTitle: string | null
  /** Staff-recorded or calculated forecast only — never inferred from % complete. */
  forecastDate: Date | null
  /** Project target date (planning), shown separately from forecast. */
  targetDate: Date | null
  state: EtaState
  stateLabel: string
  /** @deprecated use forecastDate in new UI */
  estimatedCompletionDate: Date | null
}

function nextPendingMilestone(milestones: EtaMilestone[], afterTitle: string | null): EtaMilestone | null {
  const ordered = [...milestones]
  if (afterTitle) {
    const idx = ordered.findIndex((m) => m.title === afterTitle)
    if (idx >= 0) {
      return ordered.slice(idx + 1).find((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS') ?? null
    }
  }
  return ordered.find((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS') ?? null
}

export function calculateProjectEta(input: EtaInput): EtaResult {
  const now = input.now ?? new Date()
  const targetDate = input.targetDate
  const forecastDate = input.estimatedCompletionDate ?? null

  if (input.projectStatus === 'COMPLETED') {
    return {
      progressPercent: 100,
      currentMilestoneTitle: null,
      nextMilestoneTitle: null,
      forecastDate: forecastDate ?? targetDate,
      targetDate,
      state: 'complete',
      stateLabel: 'Complete',
      estimatedCompletionDate: forecastDate ?? targetDate,
    }
  }

  if (input.milestones.length === 0) {
    return {
      progressPercent: 0,
      currentMilestoneTitle: null,
      nextMilestoneTitle: null,
      forecastDate: null,
      targetDate,
      state: 'pending_setup',
      stateLabel: 'Estimate pending project setup',
      estimatedCompletionDate: null,
    }
  }

  const progressPercent = calculateProjectProgress(input.milestones)

  const current =
    input.milestones.find((m) => m.status === 'IN_PROGRESS') ??
    input.milestones.find((m) => m.status === 'PENDING') ??
    null

  const next = nextPendingMilestone(
    input.milestones,
    current?.status === 'IN_PROGRESS' ? current.title : null,
  )

  const openCustomerDeps = input.customerOpenDependencies.filter((d) => d.status === 'REQUESTED' || d.status === 'IN_PROGRESS')
  const overdueCustomerDep = openCustomerDeps.some((d) => d.dueDate && d.dueDate < now)

  const base = {
    progressPercent,
    currentMilestoneTitle: current?.title ?? null,
    nextMilestoneTitle: next?.title ?? null,
    forecastDate,
    targetDate,
    estimatedCompletionDate: forecastDate,
  }

  if (openCustomerDeps.length > 0) {
    return {
      ...base,
      state: 'waiting_on_customer',
      stateLabel: 'Waiting on customer',
    }
  }

  if (input.projectStatus === 'ON_HOLD') {
    return {
      ...base,
      state: 'delayed',
      stateLabel: 'Delayed',
    }
  }

  if (overdueCustomerDep || (targetDate && targetDate < now && progressPercent < 100)) {
    return {
      ...base,
      state: 'at_risk',
      stateLabel: 'At risk',
    }
  }

  if (targetDate && targetDate < now) {
    return {
      ...base,
      state: 'delayed',
      stateLabel: 'Delayed',
    }
  }

  return {
    ...base,
    state: 'on_track',
    stateLabel: 'On track',
  }
}
