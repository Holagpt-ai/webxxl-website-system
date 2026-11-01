import { createHash } from 'node:crypto'
import type { CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import {
  findPilotApprovalById,
  findPilotTaskById,
  linkPilotTaskApproval,
  savePilotApproval,
  updatePilotApproval,
} from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import type { CustomerAiActor, CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'

const MIN_TTL_SECONDS = 60
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60
const MAX_COST_UNITS = 1_000_000

export type IssuePilotApprovalInput = {
  preparedTaskId: string
  customerAccountId: string
  allowedAction: string
  destinationRef: string | null
  maxCostUnits: number | null
  ttlSeconds: number
}

function validateBoundedTtl(ttlSeconds: number): CustomerAiResult<number> {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < MIN_TTL_SECONDS || ttlSeconds > MAX_TTL_SECONDS) {
    return {
      ok: false,
      error: 'VALIDATION',
      message: `ttlSeconds must be finite between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}`,
    }
  }
  return { ok: true, value: Math.floor(ttlSeconds) }
}

function validateBoundedCost(maxCostUnits: number | null): CustomerAiResult<number | null> {
  if (maxCostUnits == null) return { ok: true, value: null }
  if (!Number.isFinite(maxCostUnits) || maxCostUnits < 0 || maxCostUnits > MAX_COST_UNITS) {
    return { ok: false, error: 'VALIDATION', message: 'maxCostUnits must be finite and within platform bounds' }
  }
  return { ok: true, value: maxCostUnits }
}

/** Staff/platform operators only — operating membership does not grant pilot approval authority. */
async function assertTrustedPilotApprover(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<true>> {
  if (!store.isStaff(actor.userId, actor.platformRole)) {
    return { ok: false, error: 'FORBIDDEN', message: 'Pilot approval requires staff operator role' }
  }
  return { ok: true, value: true }
}

export async function issueCustomerAiPilotApproval(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: IssuePilotApprovalInput,
): Promise<CustomerAiResult<{ approvalId: string; expiresAt: string }>> {
  const access = await assertTrustedPilotApprover(store, actor, input.customerAccountId)
  if (!access.ok) return access

  const ttl = validateBoundedTtl(input.ttlSeconds)
  if (!ttl.ok) return ttl
  const cost = validateBoundedCost(input.maxCostUnits)
  if (!cost.ok) return cost

  const task = findPilotTaskById(input.preparedTaskId)
  if (!task || task.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Prepared task not found' }
  }
  if (task.outcome === 'BLOCKED' || task.outcome === 'UNVERIFIED') {
    return { ok: false, error: 'FORBIDDEN', message: 'Blocked or unverified tasks cannot be approved' }
  }
  if (!task.requiresHumanApproval && input.allowedAction === 'execute_prepared_draft') {
    return { ok: false, error: 'FORBIDDEN', message: 'Task does not require consequential approval' }
  }

  const employee = await store.findEmployeeById(task.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'TENANT_MISMATCH', message: 'Employee scope mismatch' }
  }
  if (employee.emergencyPaused || employee.status !== 'ACTIVE') {
    return { ok: false, error: 'EXECUTION_DISABLED', message: 'Employee not eligible for approval' }
  }

  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Account emergency disable is active' }
  }

  if (
    task.estimatedCostUnits != null &&
    cost.value != null &&
    task.estimatedCostUnits > cost.value
  ) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Approval cost ceiling below prepared task estimate' }
  }

  const expiresAt = new Date(Date.now() + ttl.value * 1000)
  const approval = savePilotApproval({
    preparedTaskId: task.id,
    customerAccountId: task.customerAccountId,
    managedSiteId: task.managedSiteId,
    employeeId: task.employeeId,
    toolKey: task.toolKey,
    workflowKind: task.workflowKind,
    actionHash: task.actionHash,
    allowedAction: input.allowedAction,
    destinationRef: input.destinationRef,
    approvedByUserId: actor.userId,
    approverPlatformRole: actor.platformRole,
    maxCostUnits: cost.value ?? task.estimatedCostUnits,
    expiresAt,
    consumedAt: null,
    revokedAt: null,
  })
  linkPilotTaskApproval(task.id, approval.id)

  return { ok: true, value: { approvalId: approval.id, expiresAt: expiresAt.toISOString() } }
}

export type ValidatePilotApprovalInput = {
  approvalId: string
  preparedTaskId: string
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
  const task = findPilotTaskById(input.preparedTaskId)
  if (!task || task.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Prepared task not found' }
  }
  if (task.outcome === 'BLOCKED') {
    return { ok: false, error: 'FORBIDDEN', message: 'Blocked task cannot be executed' }
  }

  const approval = findPilotApprovalById(input.approvalId)
  if (!approval) return { ok: false, error: 'NOT_FOUND', message: 'Approval not found' }
  if (approval.preparedTaskId !== input.preparedTaskId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Approval task binding mismatch' }
  }
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
  if (approval.actionHash !== task.actionHash) {
    return { ok: false, error: 'FORBIDDEN', message: 'Task hash does not match approval binding' }
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
