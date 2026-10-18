import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/comms-backend', () => ({
  isCommsReceiptWorkerEnabled: () => true,
}))

vi.mock('@/config/workflow-backend', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/config/workflow-backend')>()
  return { ...orig, isWorkflowDurableExecutionAllowed: () => true }
})
import { attemptsExhausted } from '@/lib/platform/workflow/attempt-lifecycle'
import {
  buildWorkflowOutboxEnvelope,
  validateOutboxEnvelopeForRow,
  workflowJobMatchesOutboxEnvelope,
} from '@/lib/platform/workflow/outbox-envelope'
import {
  classifyExpiredExternalDelivery,
  DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
  isQuarantinedDeliveryOutcome,
} from '@/lib/automation/delivery-outcome'
import { executeCommsReceiptWorkflow } from '@/lib/platform/workflow/handlers/comms-receipt'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

describe('AUTO-10B recovery and delivery safety', () => {
  it('crash attempts count toward maxAttempts', () => {
    expect(attemptsExhausted({ attemptCount: 8, maxAttempts: 8 })).toBe(true)
    expect(attemptsExhausted({ attemptCount: 7, maxAttempts: 8 })).toBe(false)
  })

  it('unknown external email outcome is quarantined not retried', () => {
    const outcome = classifyExpiredExternalDelivery({
      channel: 'EMAIL',
      providerRef: null,
      hadDeliveryError: false,
    })
    expect(outcome).toBe('quarantine')
    expect(isQuarantinedDeliveryOutcome(DELIVERY_OUTCOME_UNKNOWN_EXTERNAL)).toBe(true)
  })

  it('in-app delivery remains safe to retry after lease expiry', () => {
    const outcome = classifyExpiredExternalDelivery({
      channel: 'IN_APP',
      providerRef: null,
      hadDeliveryError: false,
    })
    expect(outcome).toBe('safe_retry')
  })

  it('valid outbox duplicate fingerprint match succeeds logically', () => {
    const envelope = buildWorkflowOutboxEnvelope({
      eventKey: 'evt-1',
      payloadRef: { receiptId: 'r1' },
      enqueue: {
        jobKind: 'COMMS_RECEIPT_PROCESS',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        correlationId: 'c1',
        sourceType: 'comms_receipt',
        sourceId: 'r1',
        idempotencyKey: 'idem-1',
        payloadRef: { receiptId: 'r1' },
      },
    })
    const row = {
      eventKey: 'evt-1',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobKind: 'COMMS_RECEIPT_PROCESS',
      requestFingerprint: envelope.requestFingerprint,
    }
    expect(validateOutboxEnvelopeForRow(row, envelope).ok).toBe(true)
    expect(
      workflowJobMatchesOutboxEnvelope(
        {
          idempotencyKey: 'idem-1',
          requestFingerprint: envelope.requestFingerprint,
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          jobKind: 'COMMS_RECEIPT_PROCESS',
          sourceType: 'comms_receipt',
          sourceId: 'r1',
        },
        envelope,
      ),
    ).toBe(true)
  })

  it('foreign tenant outbox replay denied', () => {
    const envelope = buildWorkflowOutboxEnvelope({
      eventKey: 'evt-2',
      payloadRef: {},
      enqueue: {
        jobKind: 'COMMS_RECEIPT_PROCESS',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        correlationId: 'c1',
        sourceType: 'comms_receipt',
        sourceId: 'r1',
        idempotencyKey: 'idem-2',
        payloadRef: {},
      },
    })
    expect(
      workflowJobMatchesOutboxEnvelope(
        {
          idempotencyKey: 'idem-2',
          requestFingerprint: envelope.requestFingerprint,
          customerAccountId: 'other-account',
          jobKind: 'COMMS_RECEIPT_PROCESS',
          sourceType: 'comms_receipt',
          sourceId: 'r1',
        },
        envelope,
      ),
    ).toBe(false)
  })

  it('account-null COMMS receipt denied', async () => {
    const result = await executeCommsReceiptWorkflow(
      {
        job: {
          id: 'j1',
          customerAccountId: null,
          sourceId: 'r1',
        } as never,
        attemptNumber: 1,
        leaseToken: 't',
        leaseFence: 1,
        workerId: 'w',
      },
      { receiptId: 'r1' },
    )
    expect(result.outcome).toBe('FAILED_TERMINAL')
    if (result.outcome === 'FAILED_TERMINAL') expect(result.errorCode).toBe('MISSING_ACCOUNT')
  })
})
