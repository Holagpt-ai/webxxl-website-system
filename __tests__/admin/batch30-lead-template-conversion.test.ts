import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultWebsiteTemplateIdForProjectType,
  resolveLeadConversionTemplateId,
} from '@/lib/project-templates/registry'

const hoisted = vi.hoisted(() => ({
  salesLeadFindUnique: vi.fn(),
  salesLeadUpdateMany: vi.fn(),
  salesLeadUpdate: vi.fn(),
  customerAccountFindFirst: vi.fn(),
  customerAccountFindUnique: vi.fn(),
  customerAccountCreate: vi.fn(),
  milestoneCreate: vi.fn(async () => ({ id: 'ms-1' })),
  taskCreate: vi.fn(async () => ({})),
  dependencyCreate: vi.fn(async () => ({})),
  projectCreate: vi.fn(async () => ({ id: 'proj-1' })),
  sendInvite: vi.fn(async () => ({ ok: false, error: 'auth_email_not_configured' })),
  membershipUpdate: vi.fn(async () => ({})),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    salesLead: {
      findUnique: hoisted.salesLeadFindUnique,
      updateMany: hoisted.salesLeadUpdateMany,
      update: hoisted.salesLeadUpdate,
    },
    customerAccount: {
      findFirst: hoisted.customerAccountFindFirst,
      findUnique: hoisted.customerAccountFindUnique,
      create: hoisted.customerAccountCreate,
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    project: { create: hoisted.projectCreate },
    user: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'u1', role: 'CUSTOMER' })) },
    customerMembership: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
      update: hoisted.membershipUpdate,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        salesLead: {
          findUnique: hoisted.salesLeadFindUnique,
          updateMany: hoisted.salesLeadUpdateMany,
          update: hoisted.salesLeadUpdate,
        },
        customerAccount: {
          findFirst: hoisted.customerAccountFindFirst,
          findUnique: hoisted.customerAccountFindUnique,
          create: hoisted.customerAccountCreate,
        },
        project: { create: hoisted.projectCreate },
        projectMilestone: { create: hoisted.milestoneCreate },
        projectTask: { create: hoisted.taskCreate },
        projectDependency: { create: hoisted.dependencyCreate },
      }),
  },
}))

vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: vi.fn(async () => ({})),
  formatActivitySummary: (_t: string, d: string) => d,
}))

vi.mock('@/lib/admin/sync-project-eta', () => ({
  syncProjectProgressFromEta: vi.fn(async () => undefined),
}))

vi.mock('@/lib/leads/activity', () => ({
  writeLeadActivity: vi.fn(async () => undefined),
}))

vi.mock('@/lib/automation/hooks', () => ({
  automationHooks: { leadConverted: vi.fn(async () => undefined) },
}))

vi.mock('@/lib/portal/customer-invite-mail', () => ({
  sendCustomerInvitationMagicLink: hoisted.sendInvite,
}))

import { convertLeadToCustomer } from '@/lib/leads/conversion'

describe('batch30 template resolution', () => {
  it('defaults website types to standard business template', () => {
    expect(defaultWebsiteTemplateIdForProjectType('WEBSITE')).toBe('standard-business-website')
    expect(defaultWebsiteTemplateIdForProjectType('CRM')).toBeNull()
  })

  it('honors explicit template override', () => {
    expect(
      resolveLeadConversionTemplateId({ projectType: 'CRM', templateId: 'standard-business-website' }),
    ).toBe('standard-business-website')
  })
})

describe('batch30 lead conversion with template', () => {
  const baseLead = {
    id: 'lead-1',
    stage: 'QUALIFIED',
    contactEmail: 'owner@example.com',
    contactName: 'Owner',
    businessName: 'Acme Co',
    headline: 'Website',
    locale: 'en',
    payload: {},
    customerAccountId: null,
    projectId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.salesLeadFindUnique.mockResolvedValue(baseLead)
    hoisted.customerAccountFindFirst.mockResolvedValue(null)
    hoisted.customerAccountFindUnique.mockResolvedValue(null)
    hoisted.salesLeadUpdateMany.mockResolvedValue({ count: 1 })
    hoisted.customerAccountCreate.mockResolvedValue({ id: 'acct-1' })
    hoisted.milestoneCreate.mockImplementation(async () => ({ id: `ms-${hoisted.milestoneCreate.mock.calls.length}` }))
  })

  it('instantiates template milestones and dependencies on convert', async () => {
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
      projectType: 'WEBSITE',
    })
    expect(result).toMatchObject({ ok: true, projectId: 'proj-1' })
    expect(hoisted.projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: 'standard-business-website',
          templateVersion: '1',
        }),
      }),
    )
    expect(hoisted.milestoneCreate.mock.calls.length).toBe(8)
    expect(hoisted.dependencyCreate.mock.calls.length).toBe(3)
  })

  it('does not mark invite sent when email is not configured', async () => {
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
      sendInvite: true,
      inviteRole: 'OWNER',
      locale: 'en',
    })
    expect(result).toMatchObject({
      ok: true,
      inviteRequested: true,
      inviteSent: false,
      inviteError: 'auth_email_not_configured',
    })
    expect(hoisted.membershipUpdate).not.toHaveBeenCalled()
  })
})
