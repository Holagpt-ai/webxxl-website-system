import { createHash } from 'node:crypto'

export function buildCustomerAiPilotActionFingerprint(input: {
  customerAccountId: string
  managedSiteId: string | null
  employeeId: string
  toolKey: string
  workflowKind: string
  payload: Record<string, unknown>
  locale: string
}): string {
  const canonical = JSON.stringify({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    employeeId: input.employeeId,
    toolKey: input.toolKey,
    workflowKind: input.workflowKind,
    payload: input.payload,
    locale: input.locale,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
