import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: 'admin-1', role: 'ADMIN' })),
  requireStaff: vi.fn(async () => ({ id: 'staff-1', role: 'STAFF' })),
  createCustomerAccountRecord: vi.fn(),
  createProjectFromTemplate: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/portal/authz', () => ({
  requireAdmin: hoisted.requireAdmin,
  requireStaff: hoisted.requireStaff,
}))

vi.mock('@/lib/admin/customer-onboarding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/customer-onboarding')>()
  return {
    ...actual,
    createCustomerAccountRecord: hoisted.createCustomerAccountRecord,
    createProjectFromTemplate: hoisted.createProjectFromTemplate,
  }
})

import { createCustomerOnboardingAction, createProjectFromTemplateAction } from '@/lib/admin/actions'

describe('batch26 admin onboarding actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.createCustomerAccountRecord.mockResolvedValue({
      ok: true,
      customerAccountId: 'acct-new',
      slug: 'acme-plumbing',
      created: true,
    })
    hoisted.createProjectFromTemplate.mockResolvedValue({ ok: true, projectId: 'proj-new' })
  })

  it('creates account and templated project without invitation', async () => {
    const result = await createCustomerOnboardingAction({
      businessName: 'Acme Plumbing',
      projectName: 'Acme website',
      templateId: 'standard-business-website',
    })

    expect(result).toMatchObject({
      ok: true,
      customerAccountId: 'acct-new',
      projectId: 'proj-new',
      inviteRequested: false,
    })
    expect(hoisted.createProjectFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        customerAccountId: 'acct-new',
        templateId: 'standard-business-website',
      }),
    )
  })

  it('rejects duplicate slug when explicitly provided', async () => {
    hoisted.createCustomerAccountRecord.mockResolvedValueOnce({ ok: false, error: 'duplicate_slug' })
    const result = await createCustomerOnboardingAction({
      businessName: 'Acme',
      slug: 'taken-slug',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate_slug' })
  })

  it('requires staff for project creation from template', async () => {
    hoisted.createProjectFromTemplate.mockResolvedValueOnce({ ok: true, projectId: 'p1' })
    const result = await createProjectFromTemplateAction({
      customerAccountId: 'acct-1',
      name: 'Site',
      templateId: 'standard-business-website',
    })
    expect(result).toMatchObject({ ok: true, projectId: 'p1' })
    expect(hoisted.requireStaff).toHaveBeenCalled()
  })
})
