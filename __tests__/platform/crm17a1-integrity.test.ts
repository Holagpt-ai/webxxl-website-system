import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseConsentRecordInput } from '@/lib/platform/crm/crm-consent-input'
import { parseTaskUpdateBody } from '@/lib/platform/crm/crm-task-input'

describe('CRM-17A.1 integrity', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('rejects invalid consent channel and malformed capturedAt', () => {
    expect(parseConsentRecordInput({ channel: 'FAX', purpose: 'MARKETING', status: 'REVOKED', source: 'x', capturedAt: '2026-01-01' }).ok).toBe(
      false,
    )
    expect(
      parseConsentRecordInput({ channel: 'EMAIL', purpose: 'MARKETING', status: 'UNKNOWN', source: 'x', capturedAt: '2026-01-01' }).ok,
    ).toBe(false)
    expect(
      parseConsentRecordInput({ channel: 'EMAIL', purpose: 'MARKETING', status: 'REVOKED', source: 'x', capturedAt: 'not-a-date' }).ok,
    ).toBe(false)
  })

  it('rejects invalid task enums and due dates', () => {
    expect(parseTaskUpdateBody({ status: 'DONE' }).ok).toBe(false)
    expect(parseTaskUpdateBody({ priority: 'MEGA' }).ok).toBe(false)
    expect(parseTaskUpdateBody({ dueAt: 'bad-date' }).ok).toBe(false)
    expect(parseTaskUpdateBody({ status: 'COMPLETED' }).ok).toBe(true)
  })

  it('consent evidence failure rolls back consent create', async () => {
    const hoisted = vi.hoisted(() => ({
      consentCreate: vi.fn(async () => ({ id: 'consent_new' })),
      evidenceCreateMany: vi.fn(async () => {
        throw new Error('evidence write failed')
      }),
    }))
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            contactConsent: {
              findUnique: async () => null,
              create: hoisted.consentCreate,
            },
            contactConsentEvidence: { createMany: hoisted.evidenceCreateMany },
          }),
        contactConsent: { findUnique: async () => null },
      },
    }))
    const { recordContactConsentWithEvidence: record } = await import('@/lib/platform/crm/consent-service')
    await expect(
      record({
        customerAccountId: 'acct_a',
        contactId: 'c1',
        channel: 'EMAIL',
        purpose: 'MARKETING',
        status: 'GRANTED',
        source: 'portal.form',
        capturedAt: new Date(),
        evidence: [{ evidenceRef: 'ev-1' }],
      }),
    ).rejects.toThrow('evidence write failed')
    expect(hoisted.consentCreate).toHaveBeenCalled()
    expect(hoisted.evidenceCreateMany).toHaveBeenCalled()
  })

  it('idempotency replay returns existing consent without duplicate evidence writes', async () => {
    const evidenceCreateMany = vi.fn()
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            contactConsent: {
              findUnique: async () => ({
                id: 'consent_existing',
                customerAccountId: 'acct_a',
                contactId: 'c1',
                channel: 'EMAIL',
                purpose: 'MARKETING',
                status: 'REVOKED',
              }),
              create: vi.fn(),
            },
            contactConsentEvidence: { createMany: evidenceCreateMany },
          }),
        contactConsent: { findUnique: async () => null },
      },
    }))
    const { recordContactConsentWithEvidence: record } = await import('@/lib/platform/crm/consent-service')
    const result = await record({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      status: 'REVOKED',
      source: 'portal.form',
      capturedAt: new Date(),
      idempotencyKey: 'idem-1',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.id).toBe('consent_existing')
    expect(evidenceCreateMany).not.toHaveBeenCalled()
  })

  it('rejects cross-account idempotency payload conflict', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            contactConsent: {
              findUnique: async () => ({
                id: 'consent_existing',
                customerAccountId: 'acct_other',
                contactId: 'c1',
                channel: 'EMAIL',
                purpose: 'MARKETING',
                status: 'REVOKED',
              }),
            },
            contactConsentEvidence: { createMany: vi.fn() },
          }),
        contactConsent: { findUnique: async () => null },
      },
    }))
    const { recordContactConsentWithEvidence: record } = await import('@/lib/platform/crm/consent-service')
    const result = await record({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      status: 'REVOKED',
      source: 'portal.form',
      capturedAt: new Date(),
      idempotencyKey: 'idem-x',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })

  it('updateCrmTask rejects assignee outside account membership', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmTask: {
          findFirst: async () => ({
            id: 'task_1',
            customerAccountId: 'acct_a',
            status: 'OPEN',
            completedAt: null,
            title: 'Follow up',
          }),
          update: vi.fn(),
        },
        customerMembership: { findUnique: async () => null },
      },
    }))
    const { updateCrmTask: update } = await import('@/lib/platform/crm/task-service')
    const denied = await update({
      customerAccountId: 'acct_a',
      taskId: 'task_1',
      allowAssigneeChange: true,
      patch: { assignedUserId: 'foreign-user' },
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('VALIDATION_ERROR')
  })

  it('moveDealStage returns CONFLICT when conditional update loses race', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmDeal: {
          findFirst: async () => ({
            id: 'deal_1',
            customerAccountId: 'acct_a',
            pipelineId: 'pipe_1',
            stageId: 'stage_a',
          }),
        },
        crmPipelineStage: {
          findFirst: async () => ({ id: 'stage_b', pipelineId: 'pipe_1', customerAccountId: 'acct_a' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            crmDeal: {
              findFirst: async () => ({
                id: 'deal_1',
                customerAccountId: 'acct_a',
                pipelineId: 'pipe_1',
                stageId: 'stage_a',
              }),
              updateMany: async () => ({ count: 0 }),
            },
            crmDealStageHistory: { create: vi.fn() },
          }),
      },
    }))
    const { moveDealStage: move } = await import('@/lib/platform/crm/pipeline-service')
    const result = await move({ customerAccountId: 'acct_a', dealId: 'deal_1', toStageId: 'stage_b' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })
})
