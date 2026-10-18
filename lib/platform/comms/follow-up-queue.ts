import { buildSyntheticOverdueFollowUpReport } from '@/lib/platform/crm/follow-up-service'
import type { CommsResult } from '@/lib/platform/comms/types'

export type HandoffQueueItem = {
  contactId: string
  coverage: string
  reason: string
  sourceSystems: string[]
}

/** Account-scoped human escalation preparation (no automatic outreach). */
export function prepareHumanHandoffQueue(): CommsResult<HandoffQueueItem[]> {
  const report = buildSyntheticOverdueFollowUpReport()
  if (!report.ok) return { ok: false, code: 'VALIDATION', message: report.message }
  return {
    ok: true,
    value: report.value.map((row) => ({
      contactId: row.contactId,
      coverage: row.coverage,
      reason:
        row.coverage === 'UNKNOWN_COVERAGE'
          ? 'Missing provider coverage — cannot claim uncontacted'
          : row.coverage === 'CONFIRMED_NO_OUTREACH'
            ? 'Qualifying outreach not established'
            : 'Follow-up attention',
      sourceSystems: row.sourceSystems,
    })),
  }
}
