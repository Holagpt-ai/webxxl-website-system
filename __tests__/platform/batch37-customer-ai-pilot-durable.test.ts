import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    customerAiPilotTask: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerAiPilotApproval: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/db'
import { executeWorkforceTaskPrepareWorkflow } from '@/lib/platform/workflow/handlers/workforce-task-prepare'
import { memoryPilotTaskPersistence } from '@/lib/platform/customer-ai-workforce/pilot-task-memory-store'
import {
  resetCustomerAiPilotTaskStoreForTests,
  savePilotTask,
  updatePilotTaskWorkflow,
} from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import { maybeEnqueueCustomerAiPilotWorkflowTask } from '@/lib/platform/customer-ai-workforce/pilot-workflow-integration'
import { PILOT_WORKFLOW_ENQUEUE_FAILURE_RECOVERY } from '@/lib/platform/customer-ai-workforce/pilot-workflow-transition'
import { updatePilotApproval, savePilotApproval } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import type { CustomerAiPilotTaskRecord } from '@/lib/platform/customer-ai-workforce/pilot-types'
import * as workflowEnqueue from '@/lib/platform/workflow/enqueue-service'
import * as prepService from '@/lib/platform/customer-ai-workforce/pilot-prep-service'
import * as prismaStore from '@/lib/platform/customer-ai-workforce/prisma-store'

function toSaveInput(task: CustomerAiPilotTaskRecord) {
  const { id, publicId, createdAt, ...rest } = task
  return rest
}

function sampleTask(overrides: Partial<CustomerAiPilotTaskRecord> = {}): CustomerAiPilotTaskRecord {
  return {
    id: 'pilot_task_test1',
    publicId: 'pt_test1',
    customerAccountId: 'acct_1',
    managedSiteId: 'site_1',
    employeeId: 'emp_1',
    workflowKind: 'crm_lead_intelligence',
    toolKey: 'customerAi.crm.contacts.read',
    accessMode: 'READ',
    idempotencyKey: 'idem-1',
    requestFingerprint: 'fp-1',
    outcome: 'PREPARED',
    actionHash: 'hash-1',
    draftPayload: { ok: true },
    provenance: {
      source: 'DETERMINISTIC_PILOT_V1',
      contentLabel: 'PREPARED_DRAFT',
      locale: 'en',
      correlationId: 'corr-1',
      preparedAt: new Date().toISOString(),
      actorUserId: 'staff',
      durable: true,
    },
    requiresHumanApproval: false,
    approvalId: null,
    estimatedCostUnits: 5,
    blockedReason: null,
    workflowJobId: null,
    workflowSyncState: 'NOT_QUEUED',
    workflowValidatedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('Batch 37 — durable pilot persistence + AUTO-10 integration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    resetCustomerAiPilotTaskStoreForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetCustomerAiPilotTaskStoreForTests()
  })

  it('persists pilot tasks with durable workflow lifecycle fields', async () => {
    const first = await savePilotTask(toSaveInput(sampleTask()))
    expect(first.workflowSyncState).toBe('NOT_QUEUED')
    expect(first.workflowJobId).toBeNull()
    expect(first.provenance.durable).toBe(true)
  })

  it('does not enqueue workflow when pilot workflow enqueue flag is off', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED', 'false')
    const enqueueSpy = vi.spyOn(workflowEnqueue, 'enqueueWorkflowJob')
    const task = await savePilotTask(toSaveInput(sampleTask()))
    const result = await maybeEnqueueCustomerAiPilotWorkflowTask(task)
    expect(result.queued).toBe(false)
    expect(enqueueSpy).not.toHaveBeenCalled()
  })

  it('enqueues WORKFORCE_TASK_PREPARE when enqueue flag is on', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED', 'true')
    vi.stubEnv('WORKFLOW_ENQUEUE_ENABLED', 'true')
    vi.stubEnv('WORKFLOW_DURABLE_EXECUTION_ENABLED', 'true')
    vi.spyOn(workflowEnqueue, 'enqueueWorkflowJob').mockResolvedValue({
      ok: true,
      value: {
        id: 'wf_job_1',
        jobKind: 'WORKFORCE_TASK_PREPARE',
        customerAccountId: 'acct_1',
        managedSiteId: 'site_1',
        billingGroupId: null,
        correlationId: 'corr-1',
        sourceType: 'CustomerAiPilotTask',
        sourceId: 'pilot_task_test1',
        sourceRevisionHash: 'hash-1',
        idempotencyKey: 'customer-ai-pilot:prepare:pilot_task_test1',
        requestFingerprint: 'fp',
        status: 'READY',
        priority: 0,
        scheduledAt: new Date(),
        nextAttemptAt: new Date(),
        attemptCount: 0,
        maxAttempts: 8,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        leaseFence: 0,
        lastErrorCode: null,
        lastErrorClass: null,
        resultRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      },
    })
    const task = await savePilotTask(toSaveInput(sampleTask()))
    const result = await maybeEnqueueCustomerAiPilotWorkflowTask(task)
    expect(result.queued).toBe(true)
    expect(result.workflowJobId).toBe('wf_job_1')
    const updated = await memoryPilotTaskPersistence.findPilotTaskById(task.id)
    expect(updated?.workflowSyncState).toBe('QUEUED')
    expect(updated?.workflowJobId).toBe('wf_job_1')
  })

  it('WORKFORCE_TASK_PREPARE handler revalidates tenant and marks task VALIDATED', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    vi.stubEnv('CUSTOMER_AI_EXECUTION_ENABLED', 'false')
    const task = await savePilotTask(toSaveInput(sampleTask()))
    vi.spyOn(prismaStore.prismaCustomerAiStore, 'findEmployeeById').mockResolvedValue({
      id: task.employeeId,
      publicId: 'emp_pub',
      customerAccountId: task.customerAccountId,
      managedSiteId: task.managedSiteId,
      projectId: null,
      displayName: 'Agent',
      roleTitle: 'Assistant',
      description: null,
      configJson: {},
      primaryLocale: 'en',
      secondaryLocales: [],
      status: 'ACTIVE',
      entitlementKey: 'future.ai-employee',
      emergencyPaused: false,
      createdByUserId: null,
      updatedByUserId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(prismaStore.prismaCustomerAiStore, 'getUsagePolicy').mockResolvedValue({
      customerAccountId: task.customerAccountId,
      maxActiveEmployees: 5,
      monthlyMessageBudget: null,
      monthlyTokenBudget: 500,
      rateLimitPerMinute: 100,
      executionEnabled: false,
      emergencyDisabled: false,
    })

    const outcome = await executeWorkforceTaskPrepareWorkflow(
      {
        job: {
          id: 'wf_1',
          jobKind: 'WORKFORCE_TASK_PREPARE',
          customerAccountId: task.customerAccountId,
          managedSiteId: task.managedSiteId,
          billingGroupId: null,
          correlationId: task.provenance.correlationId,
          sourceType: 'CustomerAiPilotTask',
          sourceId: task.id,
          sourceRevisionHash: task.actionHash,
          idempotencyKey: `customer-ai-pilot:prepare:${task.id}`,
          requestFingerprint: 'fp',
          status: 'RUNNING',
          priority: 0,
          scheduledAt: new Date(),
          nextAttemptAt: new Date(),
          attemptCount: 1,
          maxAttempts: 8,
          leaseOwner: 'worker',
          leaseToken: 'tok',
          leaseExpiresAt: new Date(Date.now() + 60_000),
          leaseFence: 1,
          lastErrorCode: null,
          lastErrorClass: null,
          resultRef: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        },
        attemptNumber: 1,
        workerId: 'worker-test',
        leaseToken: 'tok',
        leaseFence: 1,
      },
      {
        phase: 'POST_PREP_VALIDATION',
        pilotTaskId: task.id,
        employeeId: task.employeeId,
        workflowKind: task.workflowKind,
        actionHash: task.actionHash,
      },
    )
    expect(outcome.outcome).toBe('COMPLETED')
    const validated = await memoryPilotTaskPersistence.findPilotTaskById(task.id)
    expect(validated?.workflowSyncState).toBe('VALIDATED')
    expect(validated?.workflowValidatedAt).not.toBeNull()
  })

  it('WORKFORCE_TASK_PREPARE handler fails closed on tenant mismatch', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    const task = await savePilotTask(toSaveInput(sampleTask()))
    const outcome = await executeWorkforceTaskPrepareWorkflow(
      {
        job: {
          id: 'wf_2',
          jobKind: 'WORKFORCE_TASK_PREPARE',
          customerAccountId: 'other_acct',
          managedSiteId: task.managedSiteId,
          billingGroupId: null,
          correlationId: 'corr',
          sourceType: 'CustomerAiPilotTask',
          sourceId: task.id,
          sourceRevisionHash: task.actionHash,
          idempotencyKey: 'k',
          requestFingerprint: 'fp',
          status: 'RUNNING',
          priority: 0,
          scheduledAt: new Date(),
          nextAttemptAt: new Date(),
          attemptCount: 1,
          maxAttempts: 8,
          leaseOwner: 'worker',
          leaseToken: 'tok',
          leaseExpiresAt: new Date(Date.now() + 60_000),
          leaseFence: 1,
          lastErrorCode: null,
          lastErrorClass: null,
          resultRef: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        },
        attemptNumber: 1,
        workerId: 'worker-test',
        leaseToken: 'tok',
        leaseFence: 1,
      },
      { pilotTaskId: task.id, actionHash: task.actionHash },
    )
    expect(outcome.outcome).toBe('FAILED_TERMINAL')
    if (outcome.outcome === 'FAILED_TERMINAL') {
      expect(outcome.errorCode).toBe('TENANT_MISMATCH')
    }
  })

  it('prisma pilot store maps rows when durable tables exist (mocked)', async () => {
    const row = {
      id: 'cuid_task',
      publicId: 'wapt_abc',
      customerAccountId: 'acct_1',
      managedSiteId: null,
      employeeId: 'emp_1',
      workflowKind: 'receptionist_preparation' as const,
      toolKey: 'customerAi.knowledge.retrieve',
      accessMode: 'READ' as const,
      idempotencyKey: 'idem-x',
      requestFingerprint: 'rf',
      outcome: 'PREPARED' as const,
      actionHash: 'ah',
      draftPayload: {},
      provenanceJson: { durable: true, locale: 'en' },
      requiresHumanApproval: false,
      approvalId: null,
      estimatedCostUnits: null,
      blockedReason: null,
      workflowJobId: null,
      workflowSyncState: 'NOT_QUEUED' as const,
      workflowValidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(prisma.customerAiPilotTask.findUnique).mockResolvedValue(row as never)
    const { prismaPilotTaskPersistence } = await import('@/lib/platform/customer-ai-workforce/pilot-task-prisma-store')
    const found = await prismaPilotTaskPersistence.findPilotTaskById('cuid_task')
    expect(found?.id).toBe('cuid_task')
    expect(found?.workflowKind).toBe('receptionist_preparation')
  })

  it('enqueue failure marks FAILED with recovery and does not overwrite VALIDATED', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED', 'true')
    vi.spyOn(workflowEnqueue, 'enqueueWorkflowJob').mockResolvedValue({
      ok: false,
      error: 'NOT_CONFIGURED',
      message: 'Workflow enqueue disabled',
    })
    const validated = await savePilotTask(
      toSaveInput(sampleTask({ workflowSyncState: 'VALIDATED', workflowValidatedAt: new Date() })),
    )
    const result = await maybeEnqueueCustomerAiPilotWorkflowTask(validated)
    expect(result.queued).toBe(false)
    expect(result.recovery).toBe(PILOT_WORKFLOW_ENQUEUE_FAILURE_RECOVERY)
    const row = await memoryPilotTaskPersistence.findPilotTaskById(validated.id)
    expect(row?.workflowSyncState).toBe('VALIDATED')

    const fresh = await savePilotTask(toSaveInput(sampleTask({ idempotencyKey: 'enqueue-fail-idem' })))
    const fail = await maybeEnqueueCustomerAiPilotWorkflowTask(fresh)
    expect(fail.recovery).toBe(PILOT_WORKFLOW_ENQUEUE_FAILURE_RECOVERY)
    const failed = await memoryPilotTaskPersistence.findPilotTaskById(fresh.id)
    expect(failed?.workflowSyncState).toBe('FAILED')
    expect(failed?.blockedReason).toMatch(/^ENQUEUE_FAILED:/)
  })

  it('savePilotTask rejects idempotency fingerprint conflicts', async () => {
    await savePilotTask(toSaveInput(sampleTask({ idempotencyKey: 'dup-key', requestFingerprint: 'a' })))
    await expect(
      savePilotTask(toSaveInput(sampleTask({ idempotencyKey: 'dup-key', requestFingerprint: 'b' }))),
    ).rejects.toMatchObject({ code: 'PILOT_IDEMPOTENCY_CONFLICT' })
  })

  it('approval consume is atomic and tenant-bound', async () => {
    const task = await savePilotTask(toSaveInput(sampleTask()))
    const approval = await savePilotApproval({
      preparedTaskId: task.id,
      customerAccountId: task.customerAccountId,
      managedSiteId: task.managedSiteId,
      employeeId: task.employeeId,
      toolKey: task.toolKey,
      workflowKind: task.workflowKind,
      actionHash: task.actionHash,
      allowedAction: 'execute_prepared_draft',
      destinationRef: null,
      approvedByUserId: 'staff',
      approverPlatformRole: 'ADMIN',
      maxCostUnits: 10,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      revokedAt: null,
    })
    const wrongTenant = await updatePilotApproval(
      approval.id,
      { consumedAt: new Date() },
      { consumeIfUnset: true, customerAccountId: 'other_acct' },
    )
    expect(wrongTenant).toBeNull()
    const ok = await updatePilotApproval(
      approval.id,
      { consumedAt: new Date() },
      { consumeIfUnset: true, customerAccountId: task.customerAccountId },
    )
    expect(ok?.consumedAt).not.toBeNull()
    const replay = await updatePilotApproval(
      approval.id,
      { consumedAt: new Date() },
      { consumeIfUnset: true, customerAccountId: task.customerAccountId },
    )
    expect(replay).toBeNull()
  })

  it('stale workers cannot downgrade VALIDATED without invalidation', async () => {
    const saved = await savePilotTask(toSaveInput(sampleTask()))
    await updatePilotTaskWorkflow(saved.id, {
      workflowSyncState: 'VALIDATED',
      workflowValidatedAt: new Date(),
      ifCurrentSyncStateIn: ['NOT_QUEUED', 'QUEUED'],
    })
    const after = await updatePilotTaskWorkflow(saved.id, {
      workflowSyncState: 'FAILED',
      ifCurrentSyncStateIn: ['QUEUED'],
    })
    expect(after?.workflowSyncState).toBe('VALIDATED')
  })

  it('validated workflow retry re-checks pause and does not complete when ineligible', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    const saved = await savePilotTask(toSaveInput(sampleTask()))
    await updatePilotTaskWorkflow(saved.id, {
      workflowSyncState: 'VALIDATED',
      workflowValidatedAt: new Date(),
      ifCurrentSyncStateIn: ['NOT_QUEUED', 'QUEUED'],
    })
    vi.spyOn(prismaStore.prismaCustomerAiStore, 'findEmployeeById').mockResolvedValue({
      id: saved.employeeId,
      publicId: 'emp_pub',
      customerAccountId: saved.customerAccountId,
      managedSiteId: saved.managedSiteId,
      projectId: null,
      displayName: 'Agent',
      roleTitle: 'Assistant',
      description: null,
      configJson: {},
      primaryLocale: 'en',
      secondaryLocales: [],
      status: 'ACTIVE',
      entitlementKey: 'future.ai-employee',
      emergencyPaused: true,
      createdByUserId: null,
      updatedByUserId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(prepService, 'recheckPilotPreparationEligibility')
    const outcome = await executeWorkforceTaskPrepareWorkflow(
      {
        job: {
          id: 'wf_pause',
          jobKind: 'WORKFORCE_TASK_PREPARE',
          customerAccountId: saved.customerAccountId,
          managedSiteId: saved.managedSiteId,
          billingGroupId: null,
          correlationId: 'c',
          sourceType: 'CustomerAiPilotTask',
          sourceId: saved.id,
          sourceRevisionHash: saved.actionHash,
          idempotencyKey: 'k-pause',
          requestFingerprint: 'fp',
          status: 'RUNNING',
          priority: 0,
          scheduledAt: new Date(),
          nextAttemptAt: new Date(),
          attemptCount: 2,
          maxAttempts: 8,
          leaseOwner: 'worker',
          leaseToken: 'tok',
          leaseExpiresAt: new Date(Date.now() + 60_000),
          leaseFence: 2,
          lastErrorCode: null,
          lastErrorClass: null,
          resultRef: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        },
        attemptNumber: 2,
        workerId: 'worker-test',
        leaseToken: 'tok',
        leaseFence: 2,
      },
      { pilotTaskId: saved.id, actionHash: saved.actionHash },
    )
    expect(outcome.outcome).toBe('RETRY')
    expect(prepService.recheckPilotPreparationEligibility).toHaveBeenCalled()
    const row = await memoryPilotTaskPersistence.findPilotTaskById(saved.id)
    expect(row?.workflowSyncState).toBe('FAILED')
  })

  it('recovery: handler completes when already validated and still eligible', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    const saved = await savePilotTask(toSaveInput(sampleTask()))
    const validatedAt = new Date()
    await updatePilotTaskWorkflow(saved.id, {
      workflowSyncState: 'VALIDATED',
      workflowValidatedAt: validatedAt,
      ifCurrentSyncStateIn: ['NOT_QUEUED', 'QUEUED'],
    })
    vi.spyOn(prismaStore.prismaCustomerAiStore, 'findEmployeeById').mockResolvedValue({
      id: saved.employeeId,
      publicId: 'emp_pub',
      customerAccountId: saved.customerAccountId,
      managedSiteId: saved.managedSiteId,
      projectId: null,
      displayName: 'Agent',
      roleTitle: 'Assistant',
      description: null,
      configJson: {},
      primaryLocale: 'en',
      secondaryLocales: [],
      status: 'ACTIVE',
      entitlementKey: 'future.ai-employee',
      emergencyPaused: false,
      createdByUserId: null,
      updatedByUserId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(prismaStore.prismaCustomerAiStore, 'getUsagePolicy').mockResolvedValue({
      customerAccountId: saved.customerAccountId,
      maxActiveEmployees: 5,
      monthlyMessageBudget: null,
      monthlyTokenBudget: 500,
      rateLimitPerMinute: 100,
      executionEnabled: false,
      emergencyDisabled: false,
    })
    const recheckSpy = vi.spyOn(prepService, 'recheckPilotPreparationEligibility')
    const outcome = await executeWorkforceTaskPrepareWorkflow(
      {
        job: {
          id: 'wf_3',
          jobKind: 'WORKFORCE_TASK_PREPARE',
          customerAccountId: saved.customerAccountId,
          managedSiteId: saved.managedSiteId,
          billingGroupId: null,
          correlationId: 'c',
          sourceType: 'CustomerAiPilotTask',
          sourceId: saved.id,
          sourceRevisionHash: saved.actionHash,
          idempotencyKey: 'k2',
          requestFingerprint: 'fp',
          status: 'RUNNING',
          priority: 0,
          scheduledAt: new Date(),
          nextAttemptAt: new Date(),
          attemptCount: 2,
          maxAttempts: 8,
          leaseOwner: 'worker',
          leaseToken: 'tok',
          leaseExpiresAt: new Date(Date.now() + 60_000),
          leaseFence: 2,
          lastErrorCode: null,
          lastErrorClass: null,
          resultRef: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        },
        attemptNumber: 2,
        workerId: 'worker-test',
        leaseToken: 'tok',
        leaseFence: 2,
      },
      { pilotTaskId: saved.id, actionHash: saved.actionHash },
    )
    expect(outcome.outcome).toBe('COMPLETED')
    expect(recheckSpy).toHaveBeenCalled()
  })
})
