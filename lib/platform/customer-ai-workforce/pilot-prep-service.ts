import { randomUUID } from 'node:crypto'
import {
  isCustomerAiExecutionEnabled,
  isCustomerAiPilotPrepEnabled,
  isCustomerAiPilotTestSyntheticEnabled,
} from '@/config/customer-ai-workforce'
import { denyBillingGroupSiblingCustomerAiAccess } from '@/lib/platform/customer-ai-workforce/account-isolation'
import {
  buildCustomerAiPilotActionFingerprint,
  buildCustomerAiPilotRequestFingerprint,
  hashPilotSyntheticSnapshot,
} from '@/lib/platform/customer-ai-workforce/pilot-action-hash'
import {
  assertCustomerAiPilotPrepEnabled,
  blockCustomerAiPilotExternalExecution,
  detectCustomerAiPromptInjection,
} from '@/lib/platform/customer-ai-workforce/pilot-prep-gates'
import type {
  CustomerAiPilotOutcomeLabel,
  CustomerAiPilotTrustedDataSource,
  CustomerAiPilotWorkflowKind,
} from '@/lib/platform/customer-ai-workforce/pilot-types'
import { findPilotTaskByIdempotency, savePilotTask } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import type { CustomerAiPilotTaskRecord } from '@/lib/platform/customer-ai-workforce/pilot-types'
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
  billingGroupSiblingAccounts?: Map<string, string[]>
  operatingMemberships?: Array<{ userId: string; customerAccountId: string }>
  /** Server-side record account for sibling isolation checks (never from HTTP). */
  authoritativeRecordAccountId?: string
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
  durable: false
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

function toDto(task: CustomerAiPilotTaskRecord): CustomerAiPilotTaskDto {
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
    durable: false,
  }
}

function resolveTrustedDataSource(context: PilotWorkflowContext): CustomerAiResult<CustomerAiPilotTrustedDataSource> {
  if (context.trustedDataSource === 'TEST_SYNTHETIC') {
    if (!isCustomerAiPilotTestSyntheticEnabled()) {
      return { ok: false, error: 'VALIDATION', message: 'TEST_SYNTHETIC preparation is disabled' }
    }
    return { ok: true, value: 'TEST_SYNTHETIC' }
  }
  return { ok: true, value: 'SERVER' }
}

async function recheckPilotPreparationEligibility(
  store: CustomerAiStore,
  input: PrepareCustomerAiPilotTaskInput,
): Promise<CustomerAiResult<true>> {
  const employee = await store.findEmployeeById(input.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Employee not found' }
  }
  if (employee.emergencyPaused) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Employee emergency pause active' }
  }
  if (employee.status !== 'ACTIVE') {
    return { ok: false, error: 'FORBIDDEN', message: 'Employee not ACTIVE' }
  }
  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Account emergency disable is active' }
  }
  return { ok: true, value: true }
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

  const dataSource = resolveTrustedDataSource(input.context)
  if (!dataSource.ok) return dataSource

  const requestFingerprint = buildCustomerAiPilotRequestFingerprint({
    customerAccountId: input.customerAccountId,
    employeeId: input.employeeId,
    managedSiteId: input.managedSiteId,
    workflowKind: input.workflowKind,
    prepareConsequentialDraft: input.prepareConsequentialDraft,
    locale: input.context.locale,
    trustedDataSource: dataSource.value,
    syntheticSnapshotHash:
      dataSource.value === 'TEST_SYNTHETIC'
        ? hashPilotSyntheticSnapshot(input.context.testSyntheticSnapshot)
        : null,
  })

  const existing = findPilotTaskByIdempotency(input.customerAccountId, input.employeeId, input.idempotencyKey)
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) {
      return {
        ok: false,
        error: 'VALIDATION',
        message: 'Idempotency key reused with a different request fingerprint',
      }
    }
    const recheck = await recheckPilotPreparationEligibility(store, input)
    if (!recheck.ok) return recheck
    return { ok: true, value: toDto(existing) }
  }

  if (input.billingGroupSiblingAccounts && input.operatingMemberships) {
    const siblingCheck = denyBillingGroupSiblingCustomerAiAccess({
      actorUserId: actor.userId,
      operatingAccountId: input.customerAccountId,
      recordAccountId: input.authoritativeRecordAccountId ?? input.customerAccountId,
      operatingMemberships: input.operatingMemberships,
      billingGroupSiblingAccounts: input.billingGroupSiblingAccounts,
    })
    if (!siblingCheck.ok) return siblingCheck
  }

  const employee = await store.findEmployeeById(input.employeeId)
  if (!employee || employee.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'NOT_FOUND', message: 'Employee not found' }
  }
  if (employee.emergencyPaused) {
    return blockedTask(store, actor, input, requestFingerprint, 'Employee emergency pause active')
  }
  if (employee.status !== 'ACTIVE') {
    return blockedTask(store, actor, input, requestFingerprint, 'Employee not ACTIVE')
  }
  const effectiveSiteId = input.managedSiteId ?? employee.managedSiteId
  if (input.managedSiteId && employee.managedSiteId && employee.managedSiteId !== input.managedSiteId) {
    return { ok: false, error: 'FORBIDDEN', message: 'Employee site scope mismatch' }
  }

  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) {
    return { ok: false, error: 'EMERGENCY_DISABLED', message: 'Account emergency disable is active' }
  }

  const hintText = input.context.untrustedUserHint ?? ''
  const injection = detectCustomerAiPromptInjection(hintText)
  if (injection) {
    return blockedTask(store, actor, input, requestFingerprint, injection)
  }

  const workflowContext: PilotWorkflowContext = {
    locale: input.context.locale,
    managedSiteId: effectiveSiteId,
    trustedDataSource: dataSource.value,
    testSyntheticSnapshot: dataSource.value === 'TEST_SYNTHETIC' ? input.context.testSyntheticSnapshot : undefined,
    untrustedUserHint: input.context.untrustedUserHint,
  }

  const workflow = await buildPilotWorkflowDraft(store, {
    customerAccountId: input.customerAccountId,
    employeeId: input.employeeId,
    workflowKind: input.workflowKind,
    context: workflowContext,
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

  if (workflow.estimatedCostUnits == null && input.prepareConsequentialDraft && workflow.outcomeHint !== 'UNVERIFIED') {
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

  if (
    workflow.outcomeHint !== 'UNVERIFIED' &&
    policy?.monthlyTokenBudget != null &&
    workflow.estimatedCostUnits != null
  ) {
    const used = counters.reduce((sum, c) => sum + c.tokensReserved, 0)
    if (used + workflow.estimatedCostUnits > policy.monthlyTokenBudget) {
      return { ok: false, error: 'POLICY_BLOCKED', message: 'Monthly internal AI cost cap exhausted' }
    }
  } else if (
    input.prepareConsequentialDraft &&
    policy?.monthlyTokenBudget == null &&
    workflow.outcomeHint !== 'UNVERIFIED'
  ) {
    return { ok: false, error: 'POLICY_BLOCKED', message: 'Monthly token budget unavailable — consequential draft blocked' }
  }

  const actionHash = buildCustomerAiPilotActionFingerprint({
    customerAccountId: input.customerAccountId,
    managedSiteId: effectiveSiteId,
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
    managedSiteId: effectiveSiteId,
    employeeId: input.employeeId,
    workflowKind: input.workflowKind,
    toolKey: workflow.toolKey,
    accessMode: workflow.accessMode,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
    outcome,
    actionHash,
    draftPayload: workflow.draftPayload,
    provenance: {
      source: dataSource.value === 'TEST_SYNTHETIC' ? 'DETERMINISTIC_PILOT_V1_TEST' : 'DETERMINISTIC_PILOT_V1',
      contentLabel: outcome === 'UNVERIFIED' ? 'UNVERIFIED' : 'PREPARED_DRAFT',
      locale: input.context.locale,
      correlationId,
      preparedAt: new Date().toISOString(),
      actorUserId: actor.userId,
      durable: false,
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

  if (workflow.estimatedCostUnits != null && outcome !== 'UNVERIFIED') {
    await store.incrementToolAllowance(input.employeeId, input.customerAccountId)
    await store.incrementTokenReservation(input.employeeId, input.customerAccountId, workflow.estimatedCostUnits)
  }

  return { ok: true, value: toDto(task) }
}

async function blockedTask(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: PrepareCustomerAiPilotTaskInput,
  requestFingerprint: string,
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
    requestFingerprint,
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
      durable: false,
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
