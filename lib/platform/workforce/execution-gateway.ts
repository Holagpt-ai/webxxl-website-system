import { isInternalWorkforceEnabled } from '@/config/workforce'
import { evaluateAiToolInvocation } from '@/lib/platform/ai-tools/policy'
import { verifyWorkforceApprovalForExecution } from '@/lib/platform/workforce/approval-service'
import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { getInternalAgentDefinition } from '@/lib/platform/workforce/internal-agents'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import { isWorkforcePaused } from '@/lib/platform/workforce/pause-service'
import type { AuthorizeToolCallInput, WorkforceResult } from '@/lib/platform/workforce/types'

function hasOperatingAccess(
  store: WorkforceStore,
  userId: string,
  customerAccountId: string,
): boolean {
  return store.operatingMemberships.some(
    (m) => m.userId === userId && m.customerAccountId === customerAccountId,
  )
}

export function authorizeWorkforceToolCall(
  store: WorkforceStore,
  input: AuthorizeToolCallInput,
): WorkforceResult<{ allowed: true; toolCallId: string }> {
  if (!isInternalWorkforceEnabled()) {
    return { ok: false, code: 'WORKFORCE_DISABLED', message: 'Internal workforce disabled' }
  }
  const task = store.tasks.get(input.taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }
  if (task.customerAccountId && task.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'SCOPE_MISMATCH', message: 'Tool call account scope mismatch' }
  }
  if (
    isWorkforcePaused(store, {
      taskId: task.id,
      agentKey: task.internalAgentKey,
      providerKey: task.providerKey,
    })
  ) {
    return { ok: false, code: 'PAUSED', message: 'Execution paused' }
  }

  const agent = store.agents.get(task.internalAgentKey) ?? getInternalAgentDefinition(task.internalAgentKey)
  if (!agent) return { ok: false, code: 'UNKNOWN_AGENT', message: 'Agent missing' }
  if (!agent.allowedToolKeys.includes(input.toolKey)) {
    return { ok: false, code: 'TOOL_NOT_ALLOWED', message: 'Tool not allowed for agent role' }
  }
  if (input.inputHash !== task.inputHash && input.toolKey !== 'projects.readMilestones') {
    return { ok: false, code: 'INPUT_HASH_MISMATCH', message: 'Input hash does not match task artifact' }
  }

  const existingKey = `${input.requestId}:${input.toolKey}`
  for (const call of store.toolCalls.values()) {
    if (`${call.requestId}:${call.toolKey}` === existingKey) {
      if (call.decision === 'ALLOWED') return { ok: true, value: { allowed: true, toolCallId: call.id } }
      return { ok: false, code: call.denialReason ?? 'DENIED', message: 'Prior denial replayed' }
    }
  }

  const policy = evaluateAiToolInvocation(
    {
      actorId: input.actorId,
      actorType: input.actorType,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      toolKey: input.toolKey,
      requestId: input.requestId,
      approvalId: input.approvalId,
      inputHash: input.inputHash,
      at: input.at,
    },
    store.toolGrants,
  )

  let denialReason = policy.decision === 'DENIED' ? policy.denialReason : undefined

  if (policy.decision === 'ALLOWED' && task.approvalRequired) {
    if (!input.approvalId) {
      denialReason = 'APPROVAL_REQUIRED'
    } else {
      const verified = verifyWorkforceApprovalForExecution(store, {
        approvalId: input.approvalId,
        taskId: task.id,
        capability: task.capability,
        artifactHash: task.inputHash,
        actorId: input.actorId,
        actorType: input.actorType,
        at: input.at,
      })
      if (!verified.ok) {
        denialReason = verified.code
      }
    }
  }

  if (
    input.actorType === 'AGENT' &&
    input.customerAccountId &&
    !hasOperatingAccess(store, input.actorId, input.customerAccountId)
  ) {
    denialReason = 'NO_OPERATING_MEMBERSHIP'
  }

  const toolCallId = nextWorkforceId('wftool')
  const decision = denialReason ? 'DENIED' : 'ALLOWED'
  store.toolCalls.set(toolCallId, {
    id: toolCallId,
    taskId: task.id,
    toolKey: input.toolKey,
    requestId: input.requestId,
    inputHash: input.inputHash,
    approvalId: input.approvalId,
    decision,
    denialReason,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    actorId: input.actorId,
    actorType: input.actorType,
  })

  recordWorkforceAudit(store, {
    taskId: task.id,
    actorUserId: input.actorType === 'USER' ? input.actorId : undefined,
    actorType: input.actorType,
    eventKind: decision === 'ALLOWED' ? 'TOOL_ALLOWED' : 'TOOL_DENIED',
    detail: { toolKey: input.toolKey, denialReason },
  })

  if (decision === 'DENIED') {
    return { ok: false, code: denialReason ?? 'DENIED', message: 'Tool call denied' }
  }
  return { ok: true, value: { allowed: true, toolCallId } }
}
