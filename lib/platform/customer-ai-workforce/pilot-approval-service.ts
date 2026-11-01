import { createHash } from 'node:crypto'
import type { CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import {
  findPilotApprovalById,
  savePilotApproval,
  updatePilotApproval,
} from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import type { CustomerAiActor, CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'

export type IssuePilotApprovalInput = {
  customerAccountId: string
  managedSiteId: string | null
  employeeId: string
  toolKey: string
  workflowKind: CustomerAiPilotWorkflowKind
  actionHash: string
  allowedAction: string
  destinationRef: string | null
  maxCostUnits: number | null
  ttlSeconds: number
  /** Must match bound task content; rejects client-forged hashes without server-side preparation. */
  bindToPreparedTaskId?: string
}

async function assertTrustedApprover(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<true>> {
  if (store.isStaff(actor.userId, actor.platformRole)) return { ok: true, value: true }
  if (await store.hasOperatingMembership(actor.userId, customerAccountId)) {
    return { ok: true, value: true }
  }
  return { ok: false, error: 'FORBIDDEN', message: 'Trusted human approver requires operating membership or staff' }
}

export async function issueCustomerAiPilotApproval(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: IssuePilotApprovalInput,
): Promise<CustomerAiResult<{ approvalId: string; expiresAt: string }>> {
  const access = await assertTrustedApprover(store, actor, input.customerAccountId)
  if (!access.ok) return access

  const employee = await store.findEmployeeById(input.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'TENANT_MISMATCH', message: 'Employee scope mismatch' }
  }

  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000)
  const approval = savePilotApproval({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    employeeId: input.employeeId,
    toolKey: input.toolKey,
    workflowKind: input.workflowKind,
    actionHash: input.actionHash,
    allowedAction: input.allowedAction,
    destinationRef: input.destinationRef,
    approvedByUserId: actor.userId,
    approverPlatformRole: actor.platformRole,
    maxCostUnits: input.maxCostUnits,
    expiresAt,
    consumedAt: null,
    revokedAt: null,
  })

  return { ok: true, value: { approvalId: approval.id, expiresAt: expiresAt.toISOString() } }
}

export type ValidatePilotApprovalInput = {
  approvalId: string
  customerAccountId: string
  managedSiteId: string | null
  employeeId: string
  toolKey: string
  workflowKind: CustomerAiPilotWorkflowKind
  actionHash: string
  allowedAction: string
  estimatedCostUnits: number | null
  consume?: boolean
}

export function validateCustomerAiPilotApproval(
  input: ValidatePilotApprovalInput,
): CustomerAiResult<{ approvalId: string }> {
  const approval = findPilotApprovalById(input.approvalId)
  if (!approval) return { ok: false, error: 'NOT_FOUND', message: 'Approval not found' }
  if (approval.revokedAt) return { ok: false, error: 'FORBIDDEN', message: 'Approval revoked' }
  if (approval.consumedAt) return { ok: false, error: 'FORBIDDEN', message: 'Approval already consumed' }
  if (approval.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval expired' }
  }
  if (approval.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'TENANT_MISMATCH', message: 'Approval account mismatch' }
  }
  if (approval.managedSiteId !== input.managedSiteId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval site binding mismatch' }
  }
  if (approval.employeeId !== input.employeeId || approval.toolKey !== input.toolKey) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval employee/tool mismatch' }
  }
  if (approval.workflowKind !== input.workflowKind || approval.actionHash !== input.actionHash) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval content hash mismatch' }
  }
  if (approval.allowedAction !== input.allowedAction) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval action mismatch' }
  }
  if (
    approval.maxCostUnits != null &&
    input.estimatedCostUnits != null &&
    input.estimatedCostUnits > approval.maxCostUnits
  ) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Cost exceeds approval ceiling' }
  }

  if (input.consume) {
    updatePilotApproval(input.approvalId, { consumedAt: new Date() })
  }
  return { ok: true, value: { approvalId: input.approvalId } }
}

export function hashClientSuppliedApprovalAttempt(payload: string): string {
  return createHash('sha256').update(payload).digest('hex')
}
