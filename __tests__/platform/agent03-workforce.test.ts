import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'
import { createPaperclipWorkforceProvider } from '@/lib/platform/providers/paperclip-workforce'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { INTERNAL_AGENT_DEFINITIONS, INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import {
  decideWorkforceApproval,
  createWorkforceApproval,
  verifyWorkforceApprovalForExecution,
} from '@/lib/platform/workforce/approval-service'
import { releaseWorkforceBudget, reserveWorkforceBudget, settleWorkforceBudget } from '@/lib/platform/workforce/budget-service'
import { authorizeWorkforceToolCall } from '@/lib/platform/workforce/execution-gateway'
import { activatePause, isWorkforcePaused, releasePause } from '@/lib/platform/workforce/pause-service'
import {
  runSupervisedDocumentationWorkflowWithFixture,
  runSupervisedEngineeringWorkflowWithFixture,
  runSupervisedOperationsWorkflowWithFixture,
} from '@/lib/platform/workforce/supervised-workflows'
import {
  authorizeWorkforceTask,
  createWorkforceTask,
  queueWorkforceTask,
  transitionWorkforceTask,
} from '@/lib/platform/workforce/task-service'
import { assertTaskTransition } from '@/lib/platform/workforce/transitions'
import {
  createAgent03TestStore,
  STAFF_APPROVER_USER_ID,
  trustedStaffApprover,
} from '@/lib/platform/workforce/test-fixtures'

describe('AGENT-03 internal workforce', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_WORKFORCE_ENABLED', 'true')
    vi.stubEnv('PAPERCLIP_EXECUTION_ENABLED', 'false')
    vi.stubEnv('INTERNAL_WORKFORCE_BUDGET_SUBUNITS', '10000')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('registers five internal agent role configurations', () => {
    expect(INTERNAL_AGENT_DEFINITIONS).toHaveLength(5)
    expect(INTERNAL_AGENT_DEFINITIONS.every((a) => a.paused && !a.liveExecutionEnabled)).toBe(true)
  })

  it('enforces task state transitions', () => {
    expect(assertTaskTransition('DRAFT', 'QUEUED', 'test').ok).toBe(true)
    expect(assertTaskTransition('COMPLETED', 'RUNNING', 'test').ok).toBe(false)
    expect(assertTaskTransition('QUEUED', 'AUTHORIZED', 'test').ok).toBe(false)
  })

  it('creates tasks idempotently', () => {
    const store = createAgent03TestStore()
    const first = createWorkforceTask(store, {
      idempotencyKey: 'idem-1',
      internalAgentKey: INTERNAL_AGENT_KEYS.documentation,
      capability: 'doc.test',
      inputPayload: { a: 1 },
    })
    const second = createWorkforceTask(store, {
      idempotencyKey: 'idem-1',
      internalAgentKey: INTERNAL_AGENT_KEYS.documentation,
      capability: 'doc.test',
      inputPayload: { a: 1 },
    })
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) expect(first.value.id).toBe(second.value.id)
  })

  it('verifies human approval and rejects forged approval IDs', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'approval-task',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      capability: 'engineering.implement',
      inputPayload: { ticket: 1 },
    })
    expect(task.ok).toBe(true)
    if (!task.ok) return
    const approval = createWorkforceApproval(store, {
      taskId: task.value.id,
      capability: task.value.capability,
      artifactHash: task.value.inputHash,
      expiresAt: new Date(Date.now() + 60_000),
    })
    decideWorkforceApproval(store, {
      approvalId: approval.id,
      trustedOperator: trustedStaffApprover(),
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    const forged = verifyWorkforceApprovalForExecution(store, {
      approvalId: 'wfapproval_missing',
      taskId: task.value.id,
      capability: task.value.capability,
      artifactHash: task.value.inputHash,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
    })
    expect(forged.ok).toBe(false)
    if (!forged.ok) expect(forged.code).toBe('FORGED_APPROVAL')
  })

  it('denies agent self-approval', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'self-approval',
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
        userId: INTERNAL_AGENT_KEYS.engineer,
        permissions: ['workforce.approve'],
        platformWide: true,
      },
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    expect(denied.ok).toBe(false)
  })

  it('denies unknown tools and cross-account scope via execution gateway', () => {
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'tool-scope',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      capability: 'engineering.implement',
      inputPayload: { x: 1 },
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
    })
    decideWorkforceApproval(store, {
      approvalId: approval.id,
      trustedOperator: trustedStaffApprover(),
      decision: 'APPROVED',
      taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
    })
    authorizeWorkforceTask(store, task.value.id, {
      budgetIdempotencyKey: 'budget_tool_scope',
      estimatedSubunits: 100,
      approvalId: approval.id,
    })
    transitionWorkforceTask(store, task.value.id, 'RUNNING', 'run')

    const unknown = authorizeWorkforceToolCall(store, {
      taskId: task.value.id,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      toolKey: 'db.rawQuery',
      requestId: 'req_unknown',
      inputHash: task.value.inputHash,
    })
    expect(unknown.ok).toBe(false)

    const cross = authorizeWorkforceToolCall(store, {
      taskId: task.value.id,
      actorId: INTERNAL_AGENT_KEYS.engineer,
      actorType: 'AGENT',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      toolKey: 'projects.proposeUpdate',
      requestId: 'req_cross',
      inputHash: task.value.inputHash,
      approvalId: approval.id,
    })
    expect(cross.ok).toBe(false)
  })

  it('enforces budget limits and idempotent usage events', () => {
    const store = createAgent03TestStore()
    vi.stubEnv('INTERNAL_WORKFORCE_BUDGET_SUBUNITS', '1000')
    const a = reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'budget-1',
      amountSubunits: 600,
      agentLimitSubunits: 800,
    })
    const b = reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'budget-1',
      amountSubunits: 600,
      agentLimitSubunits: 800,
    })
    expect(a.ok && b.ok).toBe(true)
    const over = reserveWorkforceBudget(store, {
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      idempotencyKey: 'budget-2',
      amountSubunits: 900,
      agentLimitSubunits: 800,
    })
    expect(over.ok).toBe(false)
    settleWorkforceBudget(store, 'budget-1', 600)
    const dup = settleWorkforceBudget(store, 'budget-1', 600)
    expect(dup.ok).toBe(true)
  })

  it('supports emergency pause and resume', () => {
    const store = createAgent03TestStore()
    const pause = activatePause(store, {
      scope: 'AGENT',
      targetKey: INTERNAL_AGENT_KEYS.engineer,
      operatorUserId: STAFF_APPROVER_USER_ID,
    })
    expect(pause.ok).toBe(true)
    expect(isWorkforcePaused(store, { agentKey: INTERNAL_AGENT_KEYS.engineer })).toBe(true)
    const blocked = createWorkforceTask(store, {
      idempotencyKey: 'paused-task',
      internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
      capability: 'engineering.implement',
      inputPayload: {},
    })
    expect(blocked.ok).toBe(false)
    if (pause.ok) {
      releasePause(store, pause.value.pauseId, STAFF_APPROVER_USER_ID)
    }
    expect(isWorkforcePaused(store, { agentKey: INTERNAL_AGENT_KEYS.engineer })).toBe(false)
  })

  it('returns NOT_CONFIGURED when Paperclip live execution is disabled', async () => {
    const paperclip = createPaperclipWorkforceProvider()
    const res = await paperclip.listAgents({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorId: STAFF_APPROVER_USER_ID,
      actorType: 'USER',
      requestId: 'req_paperclip_probe',
      idempotencyKey: 'req_paperclip_probe',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('NOT_CONFIGURED')
  })

  it('runs three supervised synthetic workflows end-to-end', () => {
    const store = createAgent03TestStore()
    const eng = runSupervisedEngineeringWorkflowWithFixture(store, {
      staffUserId: STAFF_APPROVER_USER_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'proj_test',
      inputPayload: { feature: 'auth hardening' },
    })
    const doc = runSupervisedDocumentationWorkflowWithFixture(store, {
      staffUserId: STAFF_APPROVER_USER_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    const ops = runSupervisedOperationsWorkflowWithFixture(store, {
      staffUserId: STAFF_APPROVER_USER_ID,
    })
    expect(eng.ok && doc.ok && ops.ok).toBe(true)
    if (eng.ok) {
      const completed = [...store.tasks.values()].find((t) => t.id === eng.value.taskIds[1])
      expect(completed?.status).toBe('COMPLETED')
      expect(completed?.resultArtifactRef).toContain('artifact://')
      expect(completed?.externalProviderRunId).toBeTruthy()
    }
  })

  it('registers synthetic and Paperclip workforce adapters', () => {
    const registry = createDefaultProviderRegistry()
    const workforce = registry.list('workforce')
    expect(workforce.length).toBeGreaterThanOrEqual(2)
    expect(workforce.some((p) => p.key === 'synthetic')).toBe(true)
    expect(workforce.some((p) => p.key === 'paperclip')).toBe(true)
  })

  it('blocks workforce when INTERNAL_WORKFORCE_ENABLED is false', () => {
    vi.stubEnv('INTERNAL_WORKFORCE_ENABLED', 'false')
    const store = createAgent03TestStore()
    const task = createWorkforceTask(store, {
      idempotencyKey: 'disabled',
      internalAgentKey: INTERNAL_AGENT_KEYS.documentation,
      capability: 'doc',
      inputPayload: {},
    })
    expect(task.ok).toBe(false)
  })
})
