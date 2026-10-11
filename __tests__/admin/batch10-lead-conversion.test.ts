import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLeadSubmissionFingerprint } from '@/lib/leads/fingerprint'
import { isLeadPipelineStage, LEAD_PIPELINE_STAGES } from '@/lib/leads/pipeline'
import { mapIntakeProjectType } from '@/lib/leads/project-type'

const hoisted = vi.hoisted(() => ({
  salesLeadFindFirst: vi.fn(),
  salesLeadCreate: vi.fn(),
  salesLeadFindUnique: vi.fn(),
  salesLeadUpdateMany: vi.fn(),
  salesLeadUpdate: vi.fn(),
  salesLeadUpdateSingle: vi.fn(),
  customerAccountFindFirst: vi.fn(),
  customerAccountFindUnique: vi.fn(),
  customerAccountCreate: vi.fn(),
  projectCreate: vi.fn(),
  leadActivityCreate: vi.fn(),
  newsletterUpsert: vi.fn(),
  writeProjectActivity: vi.fn(),
  syncEta: vi.fn(),
  sendInvite: vi.fn(),
  requireStaff: vi.fn(async () => ({ id: 'staff-1', role: 'STAFF' })),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  membershipUpsert: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: {
    salesLead: {
      findFirst: hoisted.salesLeadFindFirst,
      create: hoisted.salesLeadCreate,
      findUnique: hoisted.salesLeadFindUnique,
      updateMany: hoisted.salesLeadUpdateMany,
      update: (...args: unknown[]) => {
        hoisted.salesLeadUpdateSingle(...args)
        return hoisted.salesLeadUpdate(...args)
      },
    },
    customerAccount: {
      findFirst: hoisted.customerAccountFindFirst,
      findUnique: hoisted.customerAccountFindUnique,
      create: hoisted.customerAccountCreate,
    },
    project: { create: hoisted.projectCreate },
    leadActivity: { create: hoisted.leadActivityCreate },
    newsletterSubscriber: { upsert: hoisted.newsletterUpsert },
    user: { findUnique: hoisted.userFindUnique, create: hoisted.userCreate },
    customerMembership: { findUnique: vi.fn(), upsert: hoisted.membershipUpsert },
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
      }),
  },
}))

vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: hoisted.writeProjectActivity,
  formatActivitySummary: (_t: string, d: string) => d,
}))

vi.mock('@/lib/admin/sync-project-eta', () => ({
  syncProjectProgressFromEta: hoisted.syncEta,
}))

vi.mock('@/lib/portal/customer-invite-mail', () => ({
  sendCustomerInvitationMagicLink: hoisted.sendInvite,
}))

vi.mock('@/lib/portal/authz', () => ({
  requireStaff: hoisted.requireStaff,
}))

import { persistSalesLead } from '@/lib/leads/intake'
import { convertLeadToCustomer } from '@/lib/leads/conversion'
import { updateLeadStageAction } from '@/lib/admin/lead-actions'

describe('batch10 lead pipeline config', () => {
  it('exposes all required stages', () => {
    expect(LEAD_PIPELINE_STAGES).toEqual([
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'PROPOSAL_SENT',
      'WON',
      'LOST',
    ])
    expect(isLeadPipelineStage('QUALIFIED')).toBe(true)
    expect(isLeadPipelineStage('INVALID')).toBe(false)
  })

  it('maps intake project types', () => {
    expect(mapIntakeProjectType('E-commerce store')).toBe('ECOMMERCE')
    expect(mapIntakeProjectType('Website redesign')).toBe('REDESIGN')
  })
})

describe('batch10 lead intake dedupe', () => {
  beforeEach(() => {
    hoisted.salesLeadFindFirst.mockReset()
    hoisted.salesLeadCreate.mockReset()
    hoisted.leadActivityCreate.mockReset()
  })

  it('returns recent duplicate without creating a second lead', async () => {
    hoisted.salesLeadFindFirst.mockResolvedValue({ id: 'lead-1', referenceCode: 'MSG-ABC12345' })
    const result = await persistSalesLead({
      source: 'CONTACT',
      locale: 'en',
      contactEmail: 'owner@example.com',
      dedupeKey: 'same message',
      referencePrefix: 'MSG',
      resendMessageId: 'resend-1',
      payload: { message: 'Hello' },
    })
    expect(result.duplicate).toBe(true)
    expect(hoisted.salesLeadCreate).not.toHaveBeenCalled()
  })

  it('fingerprints normalize email casing', () => {
    const a = buildLeadSubmissionFingerprint({ source: 'CONTACT', contactEmail: 'A@B.com', dedupeKey: 'x' })
    const b = buildLeadSubmissionFingerprint({ source: 'CONTACT', contactEmail: 'a@b.com', dedupeKey: 'x' })
    expect(a).toBe(b)
  })
})

describe('batch10 lead conversion', () => {
  const baseLead = {
    id: 'lead-1',
    stage: 'QUALIFIED',
    contactEmail: 'owner@example.com',
    contactName: 'Owner',
    businessName: 'Acme Plumbing',
    headline: 'Website project',
    locale: 'en',
    payload: { projectType: 'Website' },
    customerAccountId: null,
    projectId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.requireStaff.mockResolvedValue({ id: 'staff-1', role: 'STAFF' })
    hoisted.userFindUnique.mockResolvedValue(null)
    hoisted.userCreate.mockResolvedValue({ id: 'user-1', role: 'CUSTOMER', email: 'owner@example.com' })
    hoisted.membershipUpsert.mockResolvedValue({})
    hoisted.sendInvite.mockResolvedValue({ ok: true })
    hoisted.salesLeadFindUnique.mockResolvedValue(baseLead)
    hoisted.customerAccountFindFirst.mockResolvedValue(null)
    hoisted.customerAccountFindUnique.mockResolvedValue(null)
    hoisted.salesLeadUpdateMany.mockResolvedValue({ count: 1 })
    hoisted.customerAccountCreate.mockResolvedValue({ id: 'acct-1' })
    hoisted.projectCreate.mockResolvedValue({ id: 'proj-1' })
  })

  it('creates customer and project atomically', async () => {
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
      businessName: 'Acme Plumbing',
      projectName: 'Acme website',
      sendInvite: true,
      inviteRole: 'OWNER',
      locale: 'en',
    })
    expect(result).toMatchObject({
      ok: true,
      customerAccountId: 'acct-1',
      projectId: 'proj-1',
      idempotent: false,
      inviteRequested: true,
      inviteSent: true,
    })
    expect(hoisted.projectCreate).toHaveBeenCalledTimes(1)
    expect(hoisted.sendInvite).toHaveBeenCalled()
  })

  it('returns conversion success when invitation delivery fails', async () => {
    hoisted.sendInvite.mockResolvedValueOnce({ ok: false, error: 'auth_email_not_configured' })
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
      businessName: 'Acme Plumbing',
      projectName: 'Acme website',
      sendInvite: true,
      inviteRole: 'OWNER',
      locale: 'en',
    })
    expect(result).toMatchObject({
      ok: true,
      customerAccountId: 'acct-1',
      projectId: 'proj-1',
      inviteRequested: true,
      inviteSent: false,
      inviteError: 'auth_email_not_configured',
    })
    expect(hoisted.projectCreate).toHaveBeenCalledTimes(1)
  })

  it('is idempotent when lead already converted', async () => {
    hoisted.salesLeadFindUnique.mockResolvedValue({
      ...baseLead,
      customerAccountId: 'acct-9',
      projectId: 'proj-9',
    })
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
    })
    expect(result).toMatchObject({ ok: true, idempotent: true, customerAccountId: 'acct-9', projectId: 'proj-9' })
    expect(hoisted.projectCreate).not.toHaveBeenCalled()
  })

  it('blocks duplicate customer email on create', async () => {
    hoisted.customerAccountFindFirst.mockResolvedValue({ id: 'existing' })
    const result = await convertLeadToCustomer({
      leadId: 'lead-1',
      actorUserId: 'staff-1',
      mode: 'create',
    })
    expect(result).toEqual({ ok: false, error: 'customer_email_exists' })
    expect(hoisted.projectCreate).not.toHaveBeenCalled()
  })
})

describe('batch10 lead stage updates', () => {
  beforeEach(() => {
    hoisted.requireStaff.mockResolvedValue({ id: 'staff-1', role: 'STAFF' })
    hoisted.salesLeadFindUnique.mockResolvedValue({ id: 'lead-1', stage: 'NEW' })
    hoisted.salesLeadUpdate.mockResolvedValue({})
    hoisted.leadActivityCreate.mockResolvedValue({})
  })

  it('records stage transitions', async () => {
    const result = await updateLeadStageAction('lead-1', 'CONTACTED')
    expect(result).toEqual({ ok: true })
    expect(hoisted.salesLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { stage: 'CONTACTED' },
    })
    expect(hoisted.leadActivityCreate).toHaveBeenCalled()
  })
})
