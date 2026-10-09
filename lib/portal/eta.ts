import type { DependencyStatus, MilestoneStatus, ProjectStatus } from '@prisma/client'

export type EtaMilestone = {
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
  estimatedCompletionDate: Date | null
  state: EtaState
  stateLabel: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function calculateProjectEta(input: EtaInput): EtaResult {
  const now = input.now ?? new Date()

  if (input.projectStatus === 'COMPLETED') {
    return {
      progressPercent: 100,
      currentMilestoneTitle: null,
      estimatedCompletionDate: input.estimatedCompletionDate ?? input.targetDate,
      state: 'complete',
      stateLabel: 'Complete',
    }
  }

  if (input.milestones.length === 0) {
    return {
      progressPercent: 0,
      currentMilestoneTitle: null,
      estimatedCompletionDate: null,
      state: 'pending_setup',
      stateLabel: 'Estimate pending project setup',
    }
  }

  const totalWeight = input.milestones.reduce((sum, m) => sum + Math.max(0, m.progressWeight), 0) || 1
  const completedWeight = input.milestones
    .filter((m) => m.status === 'COMPLETED')
    .reduce((sum, m) => sum + Math.max(0, m.progressWeight), 0)
  const progressPercent = clamp(Math.round((completedWeight / totalWeight) * 100), 0, 100)

  const current =
    input.milestones.find((m) => m.status === 'IN_PROGRESS') ??
    input.milestones.find((m) => m.status === 'PENDING') ??
    null

  const openCustomerDeps = input.customerOpenDependencies.filter((d) => d.status === 'REQUESTED' || d.status === 'IN_PROGRESS')
  const overdueCustomerDep = openCustomerDeps.some((d) => d.dueDate && d.dueDate < now)

  let estimatedCompletionDate = input.estimatedCompletionDate ?? input.targetDate

  if (!estimatedCompletionDate && input.targetDate) {
    estimatedCompletionDate = input.targetDate
  }

  if (openCustomerDeps.length > 0) {
    return {
      progressPercent,
      currentMilestoneTitle: current?.title ?? null,
      estimatedCompletionDate,
      state: 'waiting_on_customer',
      stateLabel: 'Waiting on customer',
    }
  }

  if (input.projectStatus === 'ON_HOLD') {
    return {
      progressPercent,
      currentMilestoneTitle: current?.title ?? null,
      estimatedCompletionDate,
      state: 'delayed',
      stateLabel: 'Delayed',
    }
  }

  if (overdueCustomerDep || (input.targetDate && input.targetDate < now && progressPercent < 100)) {
    return {
      progressPercent,
      currentMilestoneTitle: current?.title ?? null,
      estimatedCompletionDate,
      state: 'at_risk',
      stateLabel: 'At risk',
    }
  }

  if (input.targetDate && input.targetDate < now) {
    return {
      progressPercent,
      currentMilestoneTitle: current?.title ?? null,
      estimatedCompletionDate,
      state: 'delayed',
      stateLabel: 'Delayed',
    }
  }

  return {
    progressPercent,
    currentMilestoneTitle: current?.title ?? null,
    estimatedCompletionDate,
    state: 'on_track',
    stateLabel: 'On track',
  }
}
