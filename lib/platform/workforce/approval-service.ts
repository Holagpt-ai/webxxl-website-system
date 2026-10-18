import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
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
    approverUserId: string
    decision: 'APPROVED' | 'REJECTED'
    taskAssignedAgentKey: string
    approvedScope?: Record<string, unknown>
  },
): WorkforceResult<WorkforceApprovalRecord> {
  const approval = store.approvals.get(input.approvalId)
  if (!approval) return { ok: false, code: 'APPROVAL_NOT_FOUND', message: 'Approval record missing' }
  if (approval.status !== 'PENDING') {
    return { ok: false, code: 'APPROVAL_CLOSED', message: 'Approval already decided' }
  }
  if (input.approverUserId === input.taskAssignedAgentKey) {
    return { ok: false, code: 'SELF_APPROVAL_DENIED', message: 'Agents cannot approve their own tasks' }
  }
  approval.status = input.decision
  approval.approverUserId = input.approverUserId
  approval.approvedScope = input.approvedScope
  approval.decidedAt = new Date()
  approval.updatedAt = new Date()
  recordWorkforceAudit(store, {
    taskId: approval.taskId,
    actorUserId: input.approverUserId,
    actorType: 'USER',
    eventKind: input.decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
    detail: { approvalId: approval.id },
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
  if (approval.useCount >= approval.maxUses) {
    return { ok: false, code: 'APPROVAL_EXHAUSTED', message: 'Approval use limit reached' }
  }
  if (input.actorType === 'AGENT' && approval.approverUserId === input.actorId) {
    return { ok: false, code: 'SELF_APPROVAL_DENIED', message: 'Agent cannot consume self-approval' }
  }
  approval.useCount += 1
  approval.updatedAt = new Date()
  return { ok: true, value: { approval } }
}
