import type { MarketingRequestStatus } from '@prisma/client'
import type { MktResult } from '@/lib/platform/marketing/types'

const ALLOWED: Record<MarketingRequestStatus, MarketingRequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['VALIDATING', 'CANCELLED'],
  VALIDATING: ['PREPARING', 'FAILED', 'CANCELLED'],
  PREPARING: ['DRAFT_READY', 'FAILED', 'CANCELLED'],
  DRAFT_READY: ['AWAITING_REVIEW', 'CANCELLED'],
  AWAITING_REVIEW: ['IN_REVIEW', 'REVISION_REQUESTED', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'CANCELLED'],
  REVISION_REQUESTED: ['PREPARING', 'CANCELLED'],
  APPROVED: ['HANDED_OFF', 'COMPLETED', 'CANCELLED'],
  REJECTED: ['REVISION_REQUESTED', 'CANCELLED'],
  HANDED_OFF: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
}

export function assertMarketingStatusTransition(
  from: MarketingRequestStatus,
  to: MarketingRequestStatus,
): MktResult<true> {
  const allowed = ALLOWED[from] ?? []
  if (!allowed.includes(to)) {
    return { ok: false, code: 'VALIDATION', message: `Invalid marketing request transition ${from} -> ${to}` }
  }
  if (to === 'COMPLETED' && from !== 'HANDED_OFF' && from !== 'APPROVED') {
    return { ok: false, code: 'VALIDATION', message: 'COMPLETED requires prior handoff or approved deliverable' }
  }
  return { ok: true, value: true }
}
