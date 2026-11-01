import { randomUUID } from 'node:crypto'
import {
  isCustomerAiExecutionEnabled,
  isCustomerAiPilotPrepEnabled,
} from '@/config/customer-ai-workforce'
import { denyBillingGroupSiblingCustomerAiAccess } from '@/lib/platform/customer-ai-workforce/account-isolation'
import { buildCustomerAiPilotActionFingerprint } from '@/lib/platform/customer-ai-workforce/pilot-action-hash'
import {
  assertCustomerAiPilotPrepEnabled,
  blockCustomerAiPilotExternalExecution,
  detectCustomerAiPromptInjection,
} from '@/lib/platform/customer-ai-workforce/pilot-prep-gates'
import type { CustomerAiPilotOutcomeLabel, CustomerAiPilotWorkflowKind } from '@/lib/platform/customer-ai-workforce/pilot-types'
import {
  findPilotTaskByIdempotency,
  savePilotTask,
} from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import { buildPilotWorkflowDraft, type PilotWorkflowContext } from '@/lib/platform/customer-ai-workforce/pilot-workflows'
import { getCustomerAiTool } from '@/lib/platform/customer-ai-workforce/tool-catalog'
import type { CustomerAiActor, CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'
import { customerAiUsagePeriodKey } from '@/config/customer-ai-workforce'

export type PrepareCustomerAiPilotTaskInput = {
  customerAccountId: string
  employeeId: string
  managedSiteId: string | null
  workflowKind: CustomerAiPilotWorkflowKind
  idempotencyKey: string
  prepareConsequentialDraft: boolean
  context: PilotWorkflowContext
  /** Snapshot account id must match path account (prevents cross-tenant injection). */
  snapshotAccountId?: string
  dataClassification?: string
  billingGroupSiblingAccounts?: Map<string, string[]>
  operatingMemberships?: Array<{ userId: string; customerAccountId: string }>
}

export type CustomerAiPilotTaskDto = {
  taskId: string
  publicId: string
  outcome: CustomerAiPilotOutcomeLabel
  workflowKind: CustomerAiPilotWorkflowKind
  toolKey: string
  accessMode: 'READ' | 'WRITE'
  actionHash: string
  draftPayload: Record<string, unknown>
  provenance: Record<string, unknown>
  requiresHumanApproval: boolean
  executionAuthorized: false
  externalExecutionBlocked: true
}

async function assertAccountAccess(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<true>> {
  if (store.isStaff(actor.userId, actor.platformRole)) return { ok: true, value: true }
  if (await store.hasOperatingMembership(actor.userId, customerAccountId)) return { ok: true, value: true }
  return { ok: false, error: 'FORBIDDEN', message: 'Operating membership required' }
}

function toDto(task: ReturnType<typeof savePilotTask>): CustomerAiPilotTaskDto {
  return {
    taskId: task.id,
    publicId: task.publicId,
    outcome: task.outcome,
    workflowKind: task.workflowKind,
    toolKey: task.toolKey,
    accessMode: task.accessMode,
    actionHash: task.actionHash,
    draftPayload: task.draftPayload,
    provenance: task.provenance,
    requiresHumanApproval: task.requiresHumanApproval,
    executionAuthorized: false,
    externalExecutionBlocked: true,
  }
}

export async function prepareCustomerAiPilotTask(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: PrepareCustomerAiPilotTaskInput,
): Promise<CustomerAiResult<CustomerAiPilotTaskDto>> {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate

  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access

  const existing = findPilotTaskByIdempotency(input.customerAccountId, input.employeeId, input.idempotencyKey)
  if (existing) {
    return { ok: true, value: toDto(existing) }
  }

  if (input.billingGroupSiblingAccounts && input.operatingMemberships) {
    const siblingCheck = denyBillingGroupSiblingCustomerAiAccess({
      actorUserId: actor.userId,
      operatingAccountId: input.customerAccountId,
      recordAccountId: input.snapshotAccountId ?? input.customerAccountId,
      operatingMemberships: input.operatingMemberships,
      billingGroupSiblingAccounts: input.billingGroupSiblingAccounts,
    })
    if (!siblingCheck.ok) return siblingCheck
  }

  if (input.snapshotAccountId && input.snapshotAccountId !== input.customerAccountId) {
    return { ok: false, error: 'TENANT_MISMATCH', message: 'Scoped snapshot account mismatch' }
  }

  const employee = await store.findEmployeeById(input.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Employee not found' }
  }
  if (employee.emergencyPaused) {
    return blockedTask(store, actor, input, 'Employee emergency pause active')
  }
  if (employee.status !== 'ACTIVE') {
    return blockedTask(store, actor, input, 'Employee not ACTIVE')
  }
  if (input.managedSiteId && employee.managedSiteId && employee.managedSiteId !== input.managedSiteId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Employee site scope mismatch' }
  }

  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Account emergency disable is active' }
  }

  const hintText = [
    input.context.untrustedUserHint ?? '',
    JSON.stringify(input.context.scopedSnapshot ?? {}),
  ].join('\n')
  const injection = detectCustomerAiPromptInjection(hintText)
  if (injection) {
    return blockedTask(store, actor, input, injection)
  }

  if (input.dataClassification === 'REGULATED_HEALTHCARE' || input.dataClassification === 'PHI') {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Healthcare participant data blocked' }
  }

  const workflow = await buildPilotWorkflowDraft(store, {
    customerAccountId: input.customerAccountId,
    employeeId: input.employeeId,
    workflowKind: input.workflowKind,
    context: input.context,
    prepareConsequentialDraft: input.prepareConsequentialDraft,
  })

  const tool = getCustomerAiTool(workflow.toolKey)
  if (!tool || tool.alwaysDeny) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Tool denied' }
  }

  const perm = await store.findToolPermission(input.employeeId, workflow.toolKey, workflow.accessMode)
  if (!perm?.granted) {
    return { ok: false, error: 'FORBIDDEN', message: 'Tool not granted' }
  }

  if (workflow.estimatedCostUnits == null && input.prepareConsequentialDraft) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Unknown task cost — preparation denied' }
  }

  const periodKey = customerAiUsagePeriodKey()
  const counters = await store.listUsageCounters(input.customerAccountId, periodKey)
  const employeeCounter = counters.find((c) => c.employeeId === input.employeeId)
  const tasksThisPeriod = employeeCounter?.toolCallsAuthorized ?? 0
  const maxTasksPerEmployee = policy?.rateLimitPerMinute ? Math.max(policy.rateLimitPerMinute, 50) : 100
  if (tasksThisPeriod >= maxTasksPerEmployee) {
    return { ok: false, error: 'RATE_LIMITED', message: 'Per-agent task limit reached' }
  }

  if (policy?.monthlyTokenBudget != null && workflow.estimatedCostUnits != null) {
    const used = counters.reduce((sum, c) => sum + c.tokensReserved, 0)
    if (used + workflow.estimatedCostUnits > policy.monthlyTokenBudget) {
      return { ok: false, error: 'POLICY_BLOCKED', message: 'Monthly internal AI cost cap exhausted' }
    }
  } else if (input.prepareConsequentialDraft && policy?.monthlyTokenBudget == null) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Monthly token budget unavailable — consequential draft blocked' }
  }

  const actionHash = buildCustomerAiPilotActionFingerprint({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    employeeId: input.employeeId,
    toolKey: workflow.toolKey,
    workflowKind: input.workflowKind,
    payload: workflow.draftPayload,
    locale: input.context.locale,
  })

  const outcome: CustomerAiPilotOutcomeLabel = workflow.outcomeHint
  const correlationId = randomUUID()

  const task = savePilotTask({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    employeeId: input.employeeId,
    workflowKind: input.workflowKind,
    toolKey: workflow.toolKey,
    accessMode: workflow.accessMode,
    idempotencyKey: input.idempotencyKey,
    outcome,
    actionHash,
    draftPayload: workflow.draftPayload,
    provenance: {
      source: 'DETERMINISTIC_PILOT_V1',
      contentLabel: 'PREPARED_DRAFT',
      locale: input.context.locale,
      correlationId,
      preparedAt: new Date().toISOString(),
      actorUserId: actor.userId,
    },
    requiresHumanApproval: workflow.requiresHumanApproval,
    approvalId: null,
    estimatedCostUnits: workflow.estimatedCostUnits,
    blockedReason: null,
  })

  await store.appendEmployeeAudit({
    employeeId: input.employeeId,
    customerAccountId: input.customerAccountId,
    action: 'PILOT_TASK_PREPARED',
    fromStatus: null,
    toStatus: null,
    actorUserId: actor.userId,
    metadata: {
      taskId: task.id,
      workflowKind: input.workflowKind,
      outcome,
      actionHash,
      correlationId,
      executionEnabled: isCustomerAiExecutionEnabled(),
      pilotPrepEnabled: isCustomerAiPilotPrepEnabled(),
    },
  })

  if (workflow.estimatedCostUnits != null) {
    await store.incrementToolAllowance(input.employeeId, input.customerAccountId)
    await store.incrementTokenReservation(input.employeeId, input.customerAccountId, workflow.estimatedCostUnits)
  }

  return { ok: true, value: toDto(task) }
}

async function blockedTask(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: PrepareCustomerAiPilotTaskInput,
  reason: string,
): Promise<CustomerAiResult<CustomerAiPilotTaskDto>> {
  const task = savePilotTask({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    employeeId: input.employeeId,
    workflowKind: input.workflowKind,
    toolKey: 'customerAi.workflow.request',
    accessMode: 'READ',
    idempotencyKey: input.idempotencyKey,
    outcome: 'BLOCKED',
    actionHash: buildCustomerAiPilotActionFingerprint({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      employeeId: input.employeeId,
      toolKey: 'blocked',
      workflowKind: input.workflowKind,
      payload: { reason },
      locale: input.context.locale,
    }),
    draftPayload: { blocked: true, reason },
    provenance: {
      source: 'DETERMINISTIC_PILOT_V1',
      contentLabel: 'PREPARED_DRAFT',
      locale: input.context.locale,
      correlationId: randomUUID(),
      preparedAt: new Date().toISOString(),
      actorUserId: actor.userId,
    },
    requiresHumanApproval: false,
    approvalId: null,
    estimatedCostUnits: null,
    blockedReason: reason,
  })
  await store.appendEmployeeAudit({
    employeeId: input.employeeId,
    customerAccountId: input.customerAccountId,
    action: 'PILOT_TASK_BLOCKED',
    fromStatus: null,
    toStatus: null,
    actorUserId: actor.userId,
    metadata: { taskId: task.id, reason },
  })
  return { ok: true, value: toDto(task) }
}

export async function attemptCustomerAiPilotExecution(
  _store: CustomerAiStore,
  _actor: CustomerAiActor,
  _input: { taskId: string; approvalId?: string },
): Promise<CustomerAiResult<never>> {
  assertCustomerAiPilotPrepEnabled()
  return blockCustomerAiPilotExternalExecution()
}
