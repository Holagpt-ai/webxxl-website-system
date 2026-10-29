import { afterEach, describe, expect, it, vi } from 'vitest'
import { MembershipRole } from '@prisma/client'
import { decodeContactListCursor, encodeContactListCursor } from '@/lib/platform/crm/contact-cursor'
import { assertCrmPermission } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'

describe('CRM-17A core workflows', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('contact cursor round-trip and rejects malformed cursor', () => {
    const raw = encodeContactListCursor({ u: new Date('2026-01-01T00:00:00.000Z').toISOString(), i: 'contact_abc' })
    const decoded = decodeContactListCursor(raw)
    expect(decoded.ok).toBe(true)
    expect(decodeContactListCursor('not-valid').ok).toBe(false)
  })

  it('MEMBER cannot manage consent; OWNER can', () => {
    expect(() => assertCrmPermission({ membershipRole: MembershipRole.MEMBER, isStaff: false }, 'crm.consent.manage')).toThrow(
      CrmApiError,
    )
    expect(() => assertCrmPermission({ membershipRole: MembershipRole.OWNER, isStaff: false }, 'crm.consent.manage')).not.toThrow()
  })

  it('GRANTED consent requires evidence', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
      },
    }))
    const { recordContactConsentWithEvidence: record } = await import('@/lib/platform/crm/consent-service')
    const denied = await record({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      status: 'GRANTED',
      source: 'portal.form',
      capturedAt: new Date(),
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('VALIDATION_ERROR')
  })

  it('moveDealStage no-ops when stage unchanged', async () => {
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
          findFirst: async () => ({ id: 'stage_a', pipelineId: 'pipe_1', customerAccountId: 'acct_a' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      },
    }))
    const { moveDealStage: move } = await import('@/lib/platform/crm/pipeline-service')
    const result = await move({ customerAccountId: 'acct_a', dealId: 'deal_1', toStageId: 'stage_a' })
    expect(result.ok).toBe(true)
  })

  it('updateCrmTask blocks assignee changes for members', async () => {
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
      },
    }))
    const { updateCrmTask: update } = await import('@/lib/platform/crm/task-service')
    const denied = await update({
      customerAccountId: 'acct_a',
      taskId: 'task_1',
      allowAssigneeChange: false,
      patch: { assignedUserId: 'other-user' },
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN')
  })

  it('updateCrmTask sets completedAt when completing', async () => {
    const updateMock = vi.fn()
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
          update: updateMock,
        },
      },
    }))
    const { updateCrmTask: update } = await import('@/lib/platform/crm/task-service')
    const ok = await update({
      customerAccountId: 'acct_a',
      taskId: 'task_1',
      allowAssigneeChange: true,
      patch: { status: 'COMPLETED' },
    })
    expect(ok.ok).toBe(true)
    expect(updateMock).toHaveBeenCalled()
    const data = updateMock.mock.calls[0][0].data
    expect(data.status).toBe('COMPLETED')
    expect(data.completedAt).toBeInstanceOf(Date)
  })
})
