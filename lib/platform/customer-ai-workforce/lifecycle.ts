import type { EmployeeLifecycleStatus } from '@/lib/platform/customer-ai-workforce/types'

const ALLOWED: Record<EmployeeLifecycleStatus, EmployeeLifecycleStatus[]> = {
  DRAFT: ['INACTIVE', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'ARCHIVED', 'DRAFT'],
  ACTIVE: ['PAUSED', 'INACTIVE', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
}

export function canTransitionEmployeeStatus(from: EmployeeLifecycleStatus, to: EmployeeLifecycleStatus): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}
