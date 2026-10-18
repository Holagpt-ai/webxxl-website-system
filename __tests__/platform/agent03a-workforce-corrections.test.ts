import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import {
  createWorkforceApproval,
  decideWorkforceApproval,
  verifyWorkforceApprovalForExecution,
} from '@/lib/platform/workforce/approval-service'
import {
  releaseWorkforceBudget,
  reserveWorkforceBudget,
  settleWorkforceBudget,
} from '@/lib/platform/workforce/budget-service'
import { authorizeWorkforceToolCall } from '@/lib/platform/workforce/execution-gateway'
import { deleteWorkforceTaskIfAllowed } from '@/lib/platform/workforce/in-memory-store'
import { activatePause, releasePause } from '@/lib/platform/workforce/pause-service'
import { createPaperclipWorkforceProvider } from '@/lib/platform/providers/paperclip-workforce'
import { runSupervisedEngineeringWorkflowWithFixture } from '@/lib/platform/workforce/supervised-workflows'
import {
  authorizeWorkforceTask,
  createWorkforceTask,
  queueWorkforceTask,
  transitionWorkforceTask,
} from '@/lib/platform/workforce/task-service'
import {
  createAgent03TestStore,
  STAFF_APPROVER_USER_ID,
  UNRELATED_OPERATOR_USER_ID,
  trustedStaffApprover,
} from '@/lib/platform/workforce/test-fixtures'
import { workforceDefaultBudgetPeriodKey } from '@/config/workforce'

describe('AGENT-03A workforce authorization and accounting corrections', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_WORKFORCE_ENABLED', 'true')
    vi.stubEnv('PAPERCLIP_EXECUTION_ENABLED', 'false')
    vi.stubEnv('INTERNAL_WORKFORCE_BUDGET_SUBUNITS', '10000')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects unauthorized human approval decisions', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'unauth-approval',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      capability: 'engineering.implement',
      inputPayload: { x: 1 },
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    const approval = createWorkforceApproval(store, {
      taskId: task.value.id,
      capability: task.value.capability,
      artifactHash: task.value.inputHash,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const denied = decideWorkforceApproval(store, {
      approvalId: approval.id,
      trustedOperator: {
        kind: 'verified_human',
        userId: UNRELATED_OPERATOR_USER_ID,
        permissions: ['workforce.approve'],
        platformWide: true,
      },
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    expect(denied.ok).toBe(false)
  })

  it('rejects agent impersonation as human approver registration bypass', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'impersonate',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      capability: 'engineering.implement',
      inputPayload: {},
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    const approval = createWorkforceApproval(store, {
      taskId: task.value.id,
      capability: task.value.capability,
      artifactHash: task.value.inputHash,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const denied = decideWorkforceApproval(store, {
      approvalId: approval.id,
      trustedOperator: {
        kind: 'verified_human',
        userId: INTERNAL_AGENT_KEYS.projectManager,
        permissions: ['workforce.approve'],
        platformWide: true,
      },
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    expect(denied.ok).toBe(false)
  })

  it('rejects direct task authorization bypass transitions', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'bypass-auth',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      capability: 'engineering.implement',
      inputPayload: {},
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    queueWorkforceTask(store, task.value.id)
    const bypass = transitionWorkforceTask(store, task.value.id, 'AUTHORIZED', 'test')
    expect(bypass.ok).toBe(false)
  })

  it('always verifies approval for approval-required tool grants', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'tool-approval-required',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      capability: 'engineering.implement',
      inputPayload: { y: 2 },
      approvalRequired: false,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    queueWorkforceTask(store, task.value.id)
    transitionWorkforceTask(store, task.value.id, 'AWAITING_APPROVAL', 'policy')
    authorizeWorkforceTask(store, task.value.id, {
      budgetIdempotencyKey: 'budget_no_task_approval',
      estimatedSubunits: 100,
    })
    transitionWorkforceTask(store, task.value.id, 'RUNNING', 'run')
    const denied = authorizeWorkforceToolCall(store, {
      taskId: task.value.id,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      requestId: 'req_no_approval',
      inputHash: task.value.inputHash,
    })
    expect(denied.ok).toBe(false)
  })

  it('consumes approval use only after successful tool authorization', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'approval-consume',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      capability: 'engineering.implement',
      inputPayload: { z: 3 },
      approvalRequired: true,
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    queueWorkforceTask(store, task.value.id)
    transitionWorkforceTask(store, task.value.id, 'AWAITING_APPROVAL', 'needs_approval')
    const approval = createWorkforceApproval(store, {
      taskId: task.value.id,
      capability: task.value.capability,
      artifactHash: task.value.inputHash,
      expiresAt: new Date(Date.now() + 60_000),
      maxUses: 1,
    })
    decideWorkforceApproval(store, {
      approvalId: approval.id,
      trustedOperator: trustedStaffApprover(),
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    authorizeWorkforceTask(store, task.value.id, {
      budgetIdempotencyKey: 'budget_consume',
      estimatedSubunits: 100,
      approvalId: approval.id,
    })
    expect(store.approvals.get(approval.id)?.useCount).toBe(0)
    transitionWorkforceTask(store, task.value.id, 'RUNNING', 'run')
    const failed = authorizeWorkforceToolCall(store, {
      taskId: task.value.id,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      requestId: 'req_fail',
      inputHash: 'wrong-hash',
      approvalId: approval.id,
    })
    expect(failed.ok).toBe(false)
    expect(store.approvals.get(approval.id)?.useCount).toBe(0)
    const ok = authorizeWorkforceToolCall(store, {
      taskId: task.value.id,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      requestId: 'req_ok',
      inputHash: task.value.inputHash,
      approvalId: approval.id,
    })
    expect(ok.ok).toBe(true)
    expect(store.approvals.get(approval.id)?.useCount).toBe(1)
  })

  it('rejects budget idempotency conflicts and invalid amounts', () => {
    const store = createAgent03TestStore()
    expect(
      reserveWorkforceBudget(store, {
        internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
        idempotencyKey: 'conflict',
        amountSubunits: 0,
        agentLimitSubunits: 800,
      }).ok,
    ).toBe(false)
    reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'conflict',
      amountSubunits: 100,
      agentLimitSubunits: 800,
    })
    const conflict = reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'conflict',
      amountSubunits: 200,
      agentLimitSubunits: 800,
    })
    expect(conflict.ok).toBe(false)
  })

  it('preserves settled cost after partial settlement and release', () => {
    const store = createAgent03TestStore()
    reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'partial',
      amountSubunits: 500,
      agentLimitSubunits: 800,
    })
    settleWorkforceBudget(store, 'partial', 200)
    releaseWorkforceBudget(store, 'partial')
    const row = store.budgetUsage.get('partial')
    expect(row?.settledSubunits).toBe(200)
    expect(row?.costSubunits).toBe(200)
    expect(row?.reservedSubunits).toBe(0)
    const over = settleWorkforceBudget(store, 'partial', 400)
    expect(over.ok).toBe(false)
  })

  it('rejects unauthorized pause and resume', () => {
    const store = createAgent03TestStore()
    const denied = activatePause(store, {
      scope: 'GLOBAL',
      targetKey: 'global',
      operatorUserId: UNRELATED_OPERATOR_USER_ID,
    })
    expect(denied.ok).toBe(false)
  })

  it('protects audit history from task deletion when tool calls exist', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'delete-protect',
      internalAgentKey: INTERNAL_AGENT_KEYS.documentation,
      capability: 'doc.test',
      inputPayload: {},
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    store.toolCalls.set('wftool_test', {
      id: 'wftool_test',
      taskId: task.value.id,
      toolKey: 'projects.readMilestones',
      requestId: 'req',
      replayKey: 'rk',
      inputHash: task.value.inputHash,
      decision: 'DENIED',
      actorId: INTERNAL_AGENT_KEYS.documentation,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    const del = deleteWorkforceTaskIfAllowed(store, task.value.id)
    expect(del.ok).toBe(false)
  })

  it('blocks synthetic workflow under active global pause', () => {
    const store = createAgent03TestStore()
    activatePause(store, {
      scope: 'GLOBAL',
      targetKey: 'global',
      operatorUserId: STAFF_APPROVER_USER_ID,
    })
    const eng = runSupervisedEngineeringWorkflowWithFixture(store, {
      staffUserId: STAFF_APPROVER_USER_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'paused_proj',
      inputPayload: { feature: 'pause test' },
    })
    expect(eng.ok).toBe(false)
    releasePause(store, store.pauses[0]!.id, STAFF_APPROVER_USER_ID)
  })

  it('keeps disabled Paperclip NOT_CONFIGURED', async () => {
    const paperclip = createPaperclipWorkforceProvider()
    const res = await paperclip.listAgents({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorId: STAFF_APPROVER_USER_ID,
      actorType: 'USER',
      requestId: 'req',
      idempotencyKey: 'req',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NOT_CONFIGURED')
  })

  it('derives budget period key from UTC month', () => {
    expect(workforceDefaultBudgetPeriodKey(new Date('2026-03-15T12:00:00Z'))).toBe('2026-03')
  })
})
