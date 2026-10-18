import { CRM_DEFAULT_FOLLOW_UP_DAYS } from '@/config/crm-backend'
import type { CrmFollowUpCoverage } from '@prisma/client'
import type { CrmResult } from '@/lib/platform/crm/types'

export type FollowUpEvidence = {
  contactId: string
  coverage: CrmFollowUpCoverage
  lastQualifyingEventAt?: Date
  sourceSystems: string[]
}

export function classifyFollowUpCoverage(input: {
  hasQualifyingOutreach: boolean
  providerCoverageMissing: boolean
  awaitingReply: boolean
  lastEventAt?: Date
  dueAt?: Date
  completed: boolean
  now?: Date
}): CrmFollowUpCoverage {
  const now = input.now ?? new Date()
  if (input.completed) return 'COMPLETED'
  if (input.providerCoverageMissing) return 'UNKNOWN_COVERAGE'
  if (!input.hasQualifyingOutreach) return 'CONFIRMED_NO_OUTREACH'
  if (input.awaitingReply) return 'AWAITING_REPLY'
  if (input.dueAt && input.dueAt.getTime() < now.getTime()) return 'OVERDUE'
  return 'CONTACTED'
}

export function defaultFollowUpDueAt(from: Date, days = CRM_DEFAULT_FOLLOW_UP_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 3600_000)
}

/** Synthetic overdue follow-up report for internal preparation (10 rows). */
export function buildSyntheticOverdueFollowUpReport(): CrmResult<FollowUpEvidence[]> {
  const base = new Date('2026-10-10T12:00:00Z')
  const rows: FollowUpEvidence[] = []
  for (let i = 0; i < 10; i += 1) {
    const coverage =
      i % 5 === 0
        ? 'OVERDUE'
        : i % 5 === 1
          ? 'UNKNOWN_COVERAGE'
          : i % 5 === 2
            ? 'CONFIRMED_NO_OUTREACH'
            : i % 5 === 3
              ? 'AWAITING_REPLY'
              : 'CONTACTED'
    rows.push({
      contactId: `syn_contact_overdue_${i + 1}`,
      coverage,
      lastQualifyingEventAt: new Date(base.getTime() - (i + 4) * 24 * 3600_000),
      sourceSystems: coverage === 'UNKNOWN_COVERAGE' ? [] : ['native.crm.timeline'],
    })
  }
  return { ok: true, value: rows }
}
