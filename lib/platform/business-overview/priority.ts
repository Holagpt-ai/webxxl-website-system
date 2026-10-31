import type { BusinessActionPriority } from '@/lib/platform/business-overview/types'

export function priorityFromDueDate(dueAt: Date | null | undefined, now: Date): BusinessActionPriority {
  if (!dueAt) return 'normal'
  const ms = dueAt.getTime() - now.getTime()
  if (ms < 0) return 'high'
  if (ms <= 7 * 24 * 60 * 60 * 1000) return 'medium'
  return 'normal'
}

export function priorityFromSeoScore(priorityScore: number): BusinessActionPriority {
  if (priorityScore >= 80) return 'high'
  if (priorityScore >= 50) return 'medium'
  return 'normal'
}

export function compareActionPriority(a: BusinessActionPriority, b: BusinessActionPriority): number {
  const rank: Record<BusinessActionPriority, number> = { high: 0, medium: 1, normal: 2, low: 3 }
  return rank[a] - rank[b]
}
