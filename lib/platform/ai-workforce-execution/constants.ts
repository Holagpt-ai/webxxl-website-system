/** Batch 6 composition. ADR not required: reuses AGENT-03, AI-CUSTOMER-13, and AUTO-10. */

export const AI_WORKFORCE_EXECUTION_BATCH_VERSION = 'batch6-ai-workforce-automation-v1' as const

export const AI_WORKFORCE_EXECUTION_DISCLOSURE =
  'Deterministic preparation only. Live inference, outbound send, charges, workflow cron, and external effects stay disabled.'

export const AI_WORKFORCE_ACCOUNT_HARD_CEILING_SUBUNITS = 1_000

export const AI_WORKFORCE_ACCOUNT_SOFT_CEILING_SUBUNITS = 800

export const AI_WORKFORCE_READ_COST_SUBUNITS = 1

export const AI_WORKFORCE_DRAFT_COST_SUBUNITS = 10

export const PAID_AI_EMPLOYEE_ENTITLEMENT_KEY = 'future.ai-employee' as const

/** Body fields a prompt or browser must not be allowed to set. */
export const CLIENT_AUTHORITY_FIELDS = [
  'approvalId',
  'actionHash',
  'dataClassification',
  'serverClassification',
  'actorType',
  'granted',
  'executionEnabled',
  'approved',
  'channelConnected',
] as const

export function rejectClientAuthority(body: Record<string, unknown>): string | null {
  for (const field of CLIENT_AUTHORITY_FIELDS) {
    if (field in body) return field
  }
  return null
}
