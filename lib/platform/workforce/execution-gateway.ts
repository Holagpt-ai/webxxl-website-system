import { isInternalWorkforceEnabled } from '@/config/workforce'
import { evaluateAiToolInvocation } from '@/lib/platform/ai-tools/policy'
import { getAiTool } from '@/lib/platform/ai-tools/registry'
import { verifyWorkforceApprovalForExecution } from '@/lib/platform/workforce/approval-service'
import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { getInternalAgentDefinition } from '@/lib/platform/workforce/internal-agents'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import { isWorkforcePaused } from '@/lib/platform/workforce/pause-service'
import type { AuthorizeToolCallInput, WorkforceResult } from '@/lib/platform/workforce/types'

function hasOperatingGrantForAccount(
  store: WorkforceStore,
  actorId: string,
  actorType: string,
  customerAccountId: string,
  toolKey: string,
): boolean {
  return store.toolGrants.some(
    (grant) =>
      grant.actorId === actorId &&
      grant.actorType === actorType &&
      grant.customerAccountId === customerAccountId &&
      grant.toolKey === toolKey,
  )
}

function toolCallReplayKey(input: AuthorizeToolCallInput): string {
  return [
    input.requestId,
    input.toolKey,
    input.taskId,
    input.actorId,
    input.customerAccountId,
    input.managedSiteId ?? '',
    input.inputHash,
    input.approvalId ?? '',
  ].join('|')
}

function requiresVerifiedApproval(
  store: WorkforceStore,
  input: AuthorizeToolCallInput,
): boolean {
  const tool = getAiTool(input.toolKey)
  if (!tool) return true
  if (tool.approvalPolicy === 'REQUIRED') return true
  const grant = store.toolGrants.find(
    (item) =>
      item.actorId === input.actorId &&
      item.actorType === input.actorType &&
      item.customerAccountId === input.customerAccountId &&
      item.toolKey === input.toolKey,
  )
  return grant?.approvalRequired === true
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
  if (input.actorType === 'AGENT' && input.actorId !== task.internalAgentKey) {
    return { ok: false, code: 'AGENT_ASSIGNMENT_MISMATCH', message: 'Agent is not assigned to task' }
  }
  if (!agent.allowedToolKeys.includes(input.toolKey)) {
    return { ok: false, code: 'TOOL_NOT_ALLOWED', message: 'Tool not allowed for agent role' }
  }
  if (input.inputHash !== task.inputHash && input.toolKey !== 'projects.readMilestones') {
    return { ok: false, code: 'INPUT_HASH_MISMATCH', message: 'Input hash does not match task artifact' }
  }

  const replayKey = toolCallReplayKey(input)
  for (const call of store.toolCalls.values()) {
    if (call.replayKey === replayKey) {
      if (call.decision === 'ALLOWED') return { ok: true, value: { allowed: true, toolCallId: call.id } }
      return { ok: false, code: call.denialReason ?? 'DENIED', message: 'Prior denial replayed' }
    }
  }

  const protectedTool = requiresVerifiedApproval(store, input)
  if (protectedTool && task.status !== 'AUTHORIZED' && task.status !== 'RUNNING') {
    return {
      ok: false,
      code: 'INVALID_TASK_STATE',
      message: 'Protected tool calls require AUTHORIZED or RUNNING task',
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

  if (!denialReason && protectedTool) {
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
        consumeUse: false,
      })
      if (!verified.ok) {
        denialReason = verified.code
      }
    }
  }

  if (
    !denialReason &&
    input.actorType === 'AGENT' &&
    input.customerAccountId &&
    !hasOperatingGrantForAccount(store, input.actorId, input.actorType, input.customerAccountId, input.toolKey)
  ) {
    denialReason = 'NO_EXPLICIT_TOOL_GRANT'
  }

  if (!denialReason && protectedTool && input.approvalId) {
    const consumed = verifyWorkforceApprovalForExecution(store, {
      approvalId: input.approvalId,
      taskId: task.id,
      capability: task.capability,
      artifactHash: task.inputHash,
      actorId: input.actorId,
      actorType: input.actorType,
      at: input.at,
      consumeUse: true,
    })
    if (!consumed.ok) {
      denialReason = consumed.code
    }
  }

  const finalDecision = denialReason ? 'DENIED' : 'ALLOWED'
  const toolCallId = nextWorkforceId('wftool')
  store.toolCalls.set(toolCallId, {
    id: toolCallId,
    taskId: task.id,
    toolKey: input.toolKey,
    requestId: input.requestId,
    replayKey,
    inputHash: input.inputHash,
    approvalId: input.approvalId,
    decision: finalDecision,
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
    eventKind: finalDecision === 'ALLOWED' ? 'TOOL_ALLOWED' : 'TOOL_DENIED',
    detail: { toolKey: input.toolKey, denialReason },
  })

  if (finalDecision === 'DENIED') {
    return { ok: false, code: denialReason ?? 'DENIED', message: 'Tool call denied' }
  }
  return { ok: true, value: { allowed: true, toolCallId } }
}
