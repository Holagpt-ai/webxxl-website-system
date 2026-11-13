import type { AiWorkforceOrchestrationStore } from '@/lib/platform/ai-workforce-execution/store'
import type { AiWorkforceResult } from '@/lib/platform/ai-workforce-execution/types'

const MIN_TTL_SECONDS = 60
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60

export type AiWorkforcePreparationApprovalRecord = {
  id: string
  preparationId: string
  customerAccountId: string
  toolKey: string
  actionHash: string
  allowedDecision: 'APPROVED' | 'REJECTED'
  status: 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED'
  issuerUserId: string
  expiresAt: string
  useCount: number
  maxUses: number
  createdAt: string
}

function fail(code: string, message: string): AiWorkforceResult<never> {
  return { ok: false, code, message }
}

export function issueAccountWorkforcePreparationApproval(
  store: AiWorkforceOrchestrationStore,
  input: {
    customerAccountId: string
    preparationId: string
    issuerUserId: string
    issuerIsStaff: boolean
    allowedDecision: 'APPROVED' | 'REJECTED'
    ttlSeconds?: number
    at?: Date
  },
): AiWorkforceResult<{ approvalId: string; expiresAt: string }> {
  if (!input.issuerIsStaff) {
    return fail('FORBIDDEN', 'Staff operator role required to issue workforce preparation approvals')
  }
  const preparation = store.preparations.get(input.preparationId)
  if (!preparation || preparation.customerAccountId !== input.customerAccountId) {
    return fail('NOT_FOUND', 'Preparation not found for this account')
  }
  if (preparation.status !== 'PENDING_APPROVAL') {
    return fail('NOT_CONSEQUENTIAL', 'Only pending-approval preparations accept issued approvals')
  }
  const ttl = input.ttlSeconds ?? 3600
  if (!Number.isFinite(ttl) || ttl < MIN_TTL_SECONDS || ttl > MAX_TTL_SECONDS) {
    return fail('VALIDATION', `ttlSeconds must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}`)
  }
  const at = input.at ?? new Date()
  const expiresAt = new Date(at.getTime() + Math.floor(ttl) * 1000)
  const approvalId = `aiw_apr_${store.nextId()}`
  const record: AiWorkforcePreparationApprovalRecord = {
    id: approvalId,
    preparationId: preparation.id,
    customerAccountId: preparation.customerAccountId,
    toolKey: preparation.toolKey,
    actionHash: preparation.actionHash,
    allowedDecision: input.allowedDecision,
    status: 'ACTIVE',
    issuerUserId: input.issuerUserId,
    expiresAt: expiresAt.toISOString(),
    useCount: 0,
    maxUses: 1,
    createdAt: at.toISOString(),
  }
  store.approvals.set(record.id, record)
  return { ok: true, value: { approvalId: record.id, expiresAt: record.expiresAt } }
}

export function verifyAccountWorkforcePreparationApproval(
  store: AiWorkforceOrchestrationStore,
  input: {
    approvalId: string
    customerAccountId: string
    preparationId: string
    actionHash: string
    decision: 'APPROVED' | 'REJECTED'
    consume?: boolean
    at?: Date
  },
): AiWorkforceResult<{ approval: AiWorkforcePreparationApprovalRecord }> {
  const approval = store.approvals.get(input.approvalId)
  if (!approval) return fail('FORGED_APPROVAL', 'Approval ID not found')
  if (approval.customerAccountId !== input.customerAccountId) {
    return fail('TENANT_MISMATCH', 'Approval account mismatch')
  }
  if (approval.preparationId !== input.preparationId) {
    return fail('APPROVAL_PREPARATION_MISMATCH', 'Approval does not match preparation')
  }
  if (approval.actionHash !== input.actionHash) {
    return fail('ACTION_HASH_MISMATCH', 'Approval hash does not match the prepared action')
  }
  if (approval.allowedDecision !== input.decision) {
    return fail('APPROVAL_DECISION_MISMATCH', 'Approval was not issued for this decision')
  }
  const at = input.at ?? new Date()
  if (new Date(approval.expiresAt).getTime() <= at.getTime()) {
    approval.status = 'EXPIRED'
    return fail('APPROVAL_EXPIRED', 'Approval expired')
  }
  if (approval.status === 'REVOKED' || approval.status === 'CONSUMED') {
    return fail('APPROVAL_EXHAUSTED', 'Approval is no longer active')
  }
  if (approval.status !== 'ACTIVE') {
    return fail('APPROVAL_INVALID', 'Approval not active')
  }
  if (approval.useCount >= approval.maxUses) {
    return fail('APPROVAL_EXHAUSTED', 'Approval use limit reached')
  }
  if (input.consume !== false) {
    approval.useCount += 1
    approval.status = 'CONSUMED'
  }
  return { ok: true, value: { approval } }
}
