import { describe, expect, it, vi } from 'vitest'

const { outboxUpdateMany } = vi.hoisted(() => ({
  outboxUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workflowOutbox: { updateMany: outboxUpdateMany },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}))

import { claimableNotificationLastErrorFilter } from '@/lib/automation/delivery-claim'
import { reclaimExpiredOutboxDispatchLeases } from '@/lib/platform/workflow/outbox'
import {
  DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
  isQuarantinedDeliveryOutcome,
} from '@/lib/automation/delivery-outcome'
import {
  buildWorkflowOutboxEnvelope,
  envelopePayloadRefsConsistent,
  validateOutboxEnvelopeForRow,
} from '@/lib/platform/workflow/outbox-envelope'
import { attemptsExhausted } from '@/lib/platform/workflow/attempt-lifecycle'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

describe('AUTO-10C final recovery integrity', () => {
  it('1: attempt exhaustion uses started attempt count (crash-inclusive)', () => {
    expect(attemptsExhausted({ attemptCount: 3, maxAttempts: 3 })).toBe(true)
  })

  it('7: conflicting outbox payload refs rejected', () => {
    const envelope = buildWorkflowOutboxEnvelope({
      eventKey: 'evt-x',
      payloadRef: { receiptId: 'a' },
      enqueue: {
        jobKind: 'COMMS_RECEIPT_PROCESS',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        correlationId: 'c1',
        sourceType: 'comms_receipt',
        sourceId: 'r1',
        idempotencyKey: 'idem-x',
        payloadRef: { receiptId: 'b' },
      },
    })
    expect(envelopePayloadRefsConsistent(envelope)).toBe(false)
    const row = {
      eventKey: 'evt-x',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobKind: 'COMMS_RECEIPT_PROCESS',
      requestFingerprint: envelope.requestFingerprint,
    }
    expect(validateOutboxEnvelopeForRow(row, envelope).ok).toBe(false)
  })

  it('8: NULL lastErrorClass passes claimable filter shape', () => {
    const filter = claimableNotificationLastErrorFilter()
    const allowsNull = filter.OR?.some(
      (clause) => 'lastErrorClass' in clause && clause.lastErrorClass === null,
    )
    expect(allowsNull).toBe(true)
  })

  it('9: quarantined external notifications are not claimable', () => {
    expect(isQuarantinedDeliveryOutcome(DELIVERY_OUTCOME_UNKNOWN_EXTERNAL)).toBe(true)
    expect(isQuarantinedDeliveryOutcome(null)).toBe(false)
  })

  it('4: expired outbox dispatch lease can be reclaimed', async () => {
    outboxUpdateMany.mockResolvedValueOnce({ count: 2 })
    const n = await reclaimExpiredOutboxDispatchLeases(new Date())
    expect(n).toBe(2)
    expect(outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dispatchLeaseExpiresAt: { lt: expect.any(Date) } }),
        data: expect.objectContaining({ dispatchLeaseToken: null }),
      }),
    )
  })
})
