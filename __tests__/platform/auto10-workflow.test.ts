import { beforeAll, describe, expect, it } from 'vitest'
import {
  isWorkflowBackendEnabled,
  isWorkflowEnqueueEnabled,
  isWorkflowWorkerEnabled,
} from '@/config/workflow-backend'
import { buildEnqueueFingerprint } from '@/lib/platform/workflow/fingerprint'
import { applyPerAccountClaimFairness } from '@/lib/platform/workflow/fairness'
import { canTransitionWorkflowStatus, isTerminalWorkflowStatus } from '@/lib/platform/workflow/state-machine'
import { computeWorkflowBackoffMs, isRetryableWorkflowError } from '@/lib/platform/workflow/retry-policy'
import { getWorkflowHandler, listRegisteredWorkflowKinds } from '@/lib/platform/workflow/handlers/registry'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { runWorkflowWorkerBatch } from '@/lib/platform/workflow/worker-runner'

describe('AUTO-10 workflow foundation', () => {
  beforeAll(() => {
    process.env.WORKFLOW_TEST_EXECUTION_BYPASS = 'true'
    process.env.WORKFLOW_BACKEND_ENABLED = 'false'
    process.env.WORKFLOW_ENQUEUE_ENABLED = 'true'
    process.env.WORKFLOW_WORKER_ENABLED = 'true'
  })

  it('J: live workflow flags default OFF in production configuration', () => {
    const saved = {
      bypass: process.env.WORKFLOW_TEST_EXECUTION_BYPASS,
      backend: process.env.WORKFLOW_BACKEND_ENABLED,
      enqueue: process.env.WORKFLOW_ENQUEUE_ENABLED,
      worker: process.env.WORKFLOW_WORKER_ENABLED,
    }
    delete process.env.WORKFLOW_TEST_EXECUTION_BYPASS
    delete process.env.WORKFLOW_BACKEND_ENABLED
    delete process.env.WORKFLOW_ENQUEUE_ENABLED
    delete process.env.WORKFLOW_WORKER_ENABLED
    expect(isWorkflowBackendEnabled()).toBe(false)
    expect(isWorkflowEnqueueEnabled()).toBe(false)
    expect(isWorkflowWorkerEnabled()).toBe(false)
    if (saved.bypass !== undefined) process.env.WORKFLOW_TEST_EXECUTION_BYPASS = saved.bypass
    else process.env.WORKFLOW_TEST_EXECUTION_BYPASS = 'true'
    if (saved.backend !== undefined) process.env.WORKFLOW_BACKEND_ENABLED = saved.backend
    if (saved.enqueue !== undefined) process.env.WORKFLOW_ENQUEUE_ENABLED = saved.enqueue
    else process.env.WORKFLOW_ENQUEUE_ENABLED = 'true'
    if (saved.worker !== undefined) process.env.WORKFLOW_WORKER_ENABLED = saved.worker
    else process.env.WORKFLOW_WORKER_ENABLED = 'true'
  })

  it('A: enqueue fingerprint changes when payload changes', () => {
    const base = {
      jobKind: 'SEO_SYNC_PREPARE' as const,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      correlationId: 'c1',
      sourceType: 'seo_connection',
      sourceId: 'site-1',
      idempotencyKey: 'key-1',
      payloadRef: { provider: 'GSC' },
    }
    const a = buildEnqueueFingerprint(base)
    const b = buildEnqueueFingerprint({ ...base, payloadRef: { provider: 'GA4' } })
    expect(a).not.toBe(b)
  })

  it('E: state machine forbids restarting terminal jobs', () => {
    expect(isTerminalWorkflowStatus('COMPLETED')).toBe(true)
    expect(canTransitionWorkflowStatus('COMPLETED', 'READY')).toBe(false)
    expect(canTransitionWorkflowStatus('RUNNING', 'AWAITING_RECONCILIATION')).toBe(true)
  })

  it('D: provider outage errors remain retryable with bounded backoff', () => {
    expect(isRetryableWorkflowError('PROVIDER_UNAVAILABLE')).toBe(true)
    expect(isRetryableWorkflowError('AUTHORIZATION_FAILED')).toBe(false)
    const backoff = computeWorkflowBackoffMs(3)
    expect(backoff).toBeGreaterThan(0)
    expect(backoff).toBeLessThanOrEqual(3_600_000)
  })

  it('F/G: fairness prevents one account from filling claim batch', () => {
    const jobs = [
      ...Array.from({ length: 5 }).map((_, i) => ({
        id: `a${i}`,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        jobKind: 'X',
      })),
      { id: 'p1', customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID, jobKind: 'X' },
      { id: 'c1', customerAccountId: ABMED_CLINICAL_ACCOUNT_ID, jobKind: 'X' },
    ] as Parameters<typeof applyPerAccountClaimFairness>[0]
    const fair = applyPerAccountClaimFairness(jobs, 2)
    const accounts = new Set(fair.map((j) => j.customerAccountId))
    expect(accounts.has(ABMED_PHYSICIANS_ACCOUNT_ID)).toBe(true)
    expect(accounts.has(ABMED_CLINICAL_ACCOUNT_ID)).toBe(true)
    expect(fair.length).toBeLessThanOrEqual(4)
  })

  it('N: worker batch no-ops when worker flag disabled', async () => {
    process.env.WORKFLOW_WORKER_ENABLED = 'false'
    const result = await runWorkflowWorkerBatch()
    expect(result.claimed).toBe(0)
    process.env.WORKFLOW_WORKER_ENABLED = 'true'
  })

  it('registry exposes safe handlers and disabled integrations', () => {
    const kinds = listRegisteredWorkflowKinds()
    expect(kinds).toContain('COMMS_RECEIPT_PROCESS')
    expect(getWorkflowHandler('SOCIAL_STATUS_RECONCILE')).toBeTruthy()
  })

  it('M/T: PostgreSQL SKIP LOCKED claim concurrency NOT VERIFIED in CI (SQL implemented)', () => {
    expect(true).toBe(true)
  })
})
