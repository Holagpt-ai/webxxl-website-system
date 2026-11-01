import { createHash } from 'node:crypto'
import type { CustomerAiPilotTrustedDataSource, CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'

export function buildCustomerAiPilotRequestFingerprint(input: {
  customerAccountId: string
  employeeId: string
  managedSiteId: string | null
  workflowKind: CustomerAiPilotWorkflowKind
  prepareConsequentialDraft: boolean
  locale: string
  trustedDataSource: CustomerAiPilotTrustedDataSource
  /** Binds TEST_SYNTHETIC fixture content into idempotency scope. */
  syntheticSnapshotHash?: string | null
}): string {
  const canonical = JSON.stringify(input)
  return createHash('sha256').update(canonical).digest('hex')
}

export function hashPilotSyntheticSnapshot(snapshot: Record<string, unknown> | undefined): string {
  return createHash('sha256').update(JSON.stringify(snapshot ?? {})).digest('hex')
}

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
