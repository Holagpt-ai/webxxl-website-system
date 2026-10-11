import type { ServiceOrderStatus } from '@prisma/client'

export const SERVICE_ORDER_STATUSES = [
  'REQUESTED',
  'UNDER_REVIEW',
  'QUOTED',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const satisfies readonly ServiceOrderStatus[]

const ALLOWED: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'CANCELLED', 'REJECTED'],
  UNDER_REVIEW: ['QUOTED', 'CANCELLED', 'REJECTED'],
  QUOTED: ['APPROVED', 'UNDER_REVIEW', 'CANCELLED', 'REJECTED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
}

export function canTransitionServiceOrder(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export const OPEN_SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'QUOTED',
  'APPROVED',
  'IN_PROGRESS',
]
