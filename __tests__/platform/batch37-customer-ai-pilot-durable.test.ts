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

  it('recovery: handler is idempotent when task already validated', async () => {
    vi.stubEnv('CUSTOMER_AI_PILOT_PREP_ENABLED', 'true')
    const saved = await savePilotTask(toSaveInput(sampleTask()))
    const validatedAt = new Date()
    await updatePilotTaskWorkflow(saved.id, {
      workflowSyncState: 'VALIDATED',
      workflowValidatedAt: validatedAt,
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
    expect(recheckSpy).not.toHaveBeenCalled()
  })
})
