import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import {
  assertApproverScopeForTask,
  isInternalAgentIdentity,
  resolveTrustedWorkforceHuman,
  type TrustedWorkforceHumanActor,
} from '@/lib/platform/workforce/operator-auth'
import type { WorkforceApprovalRecord, WorkforceResult } from '@/lib/platform/workforce/types'

export function createWorkforceApproval(
  store: WorkforceStore,
  input: {
    taskId: string
    capability: string
    artifactHash: string
    expiresAt: Date
    maxUses?: number
  },
): WorkforceApprovalRecord {
  const approval: WorkforceApprovalRecord = {
    id: nextWorkforceId('wfapproval'),
    taskId: input.taskId,
    status: 'PENDING',
    capability: input.capability,
    artifactHash: input.artifactHash,
    expiresAt: input.expiresAt,
    maxUses: input.maxUses ?? 1,
    useCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.approvals.set(approval.id, approval)
  return approval
}

export function decideWorkforceApproval(
  store: WorkforceStore,
  input: {
    approvalId: string
    trustedOperator: TrustedWorkforceHumanActor
    decision: 'APPROVED' | 'REJECTED'
    taskAssignedAgentKey: string
    approvedScope?: Record<string, unknown>
  },
): WorkforceResult<WorkforceApprovalRecord> {
  const operator = resolveTrustedWorkforceHuman(store, input.trustedOperator.userId, 'workforce.approve')
  if (!operator.ok) return operator

  const approval = store.approvals.get(input.approvalId)
  if (!approval) return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record missing' }
  if (approval.status !== 'PENDING') {
    return { ok: false, code: 'APPROVAL_CLOSED', message: 'Approval already decided' }
  }
  const task = store.tasks.get(approval.taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found for approval' }
  if (approval.capability !== task.capability) {
    return { ok: false, code: 'APPROVAL_CAPABILITY_MISMATCH', message: 'Approval capability mismatch' }
  }
  if (approval.artifactHash !== task.inputHash) {
    return { ok: false, code: 'APPROVAL_ARTIFACT_MISMATCH', message: 'Task payload changed since approval request' }
  }
  const at = new Date()
  if (approval.expiresAt <= at) {
    approval.status = 'EXPIRED'
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired before decision' }
  }
  if (operator.value.userId === input.taskAssignedAgentKey) {
    return { ok: false, code: 'SELF_APPROVAL_DENIED', message: 'Agents cannot approve their own tasks' }
  }
  const scope = assertApproverScopeForTask(store, operator.value, task)
  if (!scope.ok) return scope

  approval.status = input.decision
  approval.approverUserId = operator.value.userId
  approval.approvedScope = input.approvedScope
  approval.decidedAt = at
  approval.updatedAt = at
  recordWorkforceAudit(store, {
    taskId: approval.taskId,
    actorUserId: operator.value.userId,
    actorType: 'USER',
    eventKind: input.decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
    detail: { approvalId: approval.id, approverUserId: input.trustedOperator.userId },
  })
  return { ok: true, value: approval }
}

export function verifyWorkforceApprovalForExecution(
  store: WorkforceStore,
  input: {
    approvalId: string
    taskId: string
    capability: string
    artifactHash: string
    actorId: string
    actorType: string
    at?: Date
    consumeUse?: boolean
  },
): WorkforceResult<{ approval: WorkforceApprovalRecord }> {
  const approval = store.approvals.get(input.approvalId)
  if (!approval) return { ok: false, code: 'FORGED_APPROVAL', message: 'Approval ID not found' }
  if (approval.taskId !== input.taskId) {
    return { ok: false, code: 'APPROVAL_TASK_MISMATCH', message: 'Approval does not match task' }
  }
  if (approval.capability !== input.capability) {
    return { ok: false, code: 'APPROVAL_CAPABILITY_MISMATCH', message: 'Approval capability mismatch' }
  }
  if (approval.artifactHash !== input.artifactHash) {
    return { ok: false, code: 'APPROVAL_ARTIFACT_MISMATCH', message: 'Task payload changed since approval' }
  }
  const at = input.at ?? new Date()
  if (approval.expiresAt <= at) {
    approval.status = 'EXPIRED'
    return { ok: false, code: 'APPROVAL_EXPIRED', message: 'Approval expired' }
  }
  if (approval.status === 'REVOKED' || approval.status === 'REJECTED') {
    return { ok: false, code: 'APPROVAL_INVALID', message: 'Approval not active' }
  }
  if (approval.status !== 'APPROVED') {
    return { ok: false, code: 'APPROVAL_PENDING', message: 'Approval not granted' }
  }
  if (!approval.approverUserId || isInternalAgentIdentity(approval.approverUserId)) {
    return { ok: false, code: 'APPROVAL_INVALID', message: 'Approval lacks verified human approver' }
  }
  if (approval.useCount >= approval.maxUses) {
    return { ok: false, code: 'APPROVAL_EXHAUSTED', message: 'Approval use limit reached' }
  }
  if (input.actorType === 'AGENT' && approval.approverUserId === input.actorId) {
    return { ok: false, code: 'SELF_APPROVAL_DENIED', message: 'Agent cannot consume self-approval' }
  }
  if (input.consumeUse !== false) {
    approval.useCount += 1
    approval.updatedAt = new Date()
  }
  return { ok: true, value: { approval } }
}
