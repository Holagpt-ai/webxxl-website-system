import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_MANAGED_SITE_PROFILES, abmedProfilesContainSecrets } from '@/lib/managed-sites/abmed'
import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import { transformManagedSiteRequest, validateManagedSiteChangePayload } from '@/lib/managed-sites/ai'
import {
  getCustomerVisibleCapabilities,
  isKnownCapability,
  resolveEffectiveCapability,
} from '@/lib/managed-sites/capabilities'
import { customerOwnsManagedSite } from '@/lib/managed-sites/domain'
import { planAbmedRegistration } from '@/lib/managed-sites/register-abmed'
import { routeManagedSiteRequest } from '@/lib/managed-sites/routing'
import {
  approveManagedSiteChange,
  registerManagedSite,
  submitManagedSiteChange,
  updateManagedSiteProfile,
} from '@/lib/managed-sites/operations'
import {
  createManagedSiteAction,
  setManagedSiteCapabilityAction,
  updateManagedSiteConnectionAction,
  updateManagedSiteProfileAction,
} from '@/lib/managed-sites/admin-actions'

const hoisted = vi.hoisted(() => ({
  writeProjectActivity: vi.fn(async () => ({})),
  requireStaff: vi.fn(),
  requireAdmin: vi.fn(),
  requireManagedSiteStaffAccess: vi.fn(),
  prisma: {
    project: { findFirst: vi.fn() },
    customerAccount: { findUnique: vi.fn() },
    managedSite: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    managedSiteChange: { create: vi.fn(), update: vi.fn() },
    changeRequest: { create: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: hoisted.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/portal/authz', () => ({
  requireStaff: hoisted.requireStaff,
  requireAdmin: hoisted.requireAdmin,
  requireManagedSiteStaffAccess: hoisted.requireManagedSiteStaffAccess,
}))
vi.mock('@/lib/portal/activity', () => ({
  writeProjectActivity: hoisted.writeProjectActivity,
  formatActivitySummary: (_type: string, detail: string) => detail,
}))

const site = {
  id: 'site-1',
  name: 'ABMED Aesthetics',
  domain: 'abmedaesthetics.com',
  projectId: 'proj-1',
  customerAccountId: 'acct-1',
  adapterKey: 'abmed',
  connectionType: 'EXTERNAL_ADMIN' as const,
  connectionRef: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.prisma.managedSiteChange.create.mockImplementation(async ({ data }: { data: { status: string } }) => ({
    id: 'chg-1',
    status: data.status,
  }))
  hoisted.prisma.changeRequest.create.mockResolvedValue({ id: 'cr-1' })
  hoisted.prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', customerAccountId: 'acct-1' })
})

describe('managed site access', () => {
  it('allows a customer to see only their own site', () => {
    expect(customerOwnsManagedSite('acct-1', 'acct-1')).toBe(true)
    expect(customerOwnsManagedSite('acct-1', 'acct-2')).toBe(false)
  })
})

describe('capability routing', () => {
  it('denies an unknown capability', () => {
    expect(isKnownCapability('homepage.redesign')).toBe(false)
    expect(
      routeManagedSiteRequest({ capabilityKey: 'homepage.redesign', assignment: null, actor: 'customer' }).mode,
    ).toBe('UNAVAILABLE')
  })

  it('denies a disabled capability', () => {
    const decision = routeManagedSiteRequest({
      capabilityKey: 'popups.manage',
      assignment: { capabilityKey: 'popups.manage', enabled: false, executionMode: null },
      actor: 'customer',
    })
    expect(decision.mode).toBe('UNAVAILABLE')
    expect(decision.reason).toBe('disabled')
  })

  it('hides a capability that is not customer visible', () => {
    const decision = routeManagedSiteRequest({
      capabilityKey: 'site.connection',
      assignment: { capabilityKey: 'site.connection', enabled: true, executionMode: null },
      actor: 'customer',
    })
    expect(decision.reason).toBe('hidden')
    expect(getCustomerVisibleCapabilities([{ capabilityKey: 'site.connection', enabled: true, executionMode: null }])).toEqual([])
  })

  it('resolves execution mode from the registry and stored override, not the client', () => {
    const registry = resolveEffectiveCapability(
      'popups.manage',
      { capabilityKey: 'popups.manage', enabled: true, executionMode: null },
      'HUMAN_REQUIRED',
    )
    expect(registry?.executionMode).toBe('SELF_SERVICE')
    const stored = routeManagedSiteRequest({
      capabilityKey: 'content.edit',
      assignment: { capabilityKey: 'content.edit', enabled: true, executionMode: 'HUMAN_REQUIRED' },
      actor: 'customer',
      clientExecutionMode: 'SELF_SERVICE',
    })
    expect(stored.mode).toBe('HUMAN_REQUIRED')
  })
})

describe('managed site changes', () => {
  it('creates a linked change request for human-required work', async () => {
    const result = await submitManagedSiteChange({
      actorUserId: 'user-1',
      actor: 'customer',
      site,
      assignments: [{ capabilityKey: 'site.custom_work', enabled: true, executionMode: null }],
      capabilityKey: 'site.custom_work',
      requestText: 'Redesign the homepage',
      clientExecutionMode: 'SELF_SERVICE',
    })
    expect(result).toMatchObject({ ok: true, applied: false, status: 'ESCALATED', changeRequestId: 'cr-1' })
    expect(hoisted.prisma.changeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'proj-1', managedSiteId: 'site-1', submittedById: 'user-1' }),
    })
    expect(hoisted.prisma.managedSiteChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'ESCALATED', executionMode: 'HUMAN_REQUIRED', changeRequestId: 'cr-1' }),
    })
  })

  it('saves an AI-assisted draft and does not execute it', async () => {
    const result = await submitManagedSiteChange({
      actorUserId: 'user-1',
      actor: 'customer',
      site,
      assignments: [{ capabilityKey: 'content.edit', enabled: true, executionMode: null }],
      capabilityKey: 'content.edit',
      requestText: 'Change the October popup to 20% off through Halloween',
    })
    expect(result).toMatchObject({ ok: true, applied: false, status: 'DRAFT' })
    expect(hoisted.prisma.changeRequest.create).not.toHaveBeenCalled()
    expect(transformManagedSiteRequest({ capabilityKey: 'content.edit', requestText: 'hello' })).toEqual({
      available: false,
      reason: 'llm_not_connected',
    })
  })

  it('does not report success when a self-service capability has no live adapter', async () => {
    const result = await submitManagedSiteChange({
      actorUserId: 'user-1',
      actor: 'customer',
      site,
      assignments: [{ capabilityKey: 'business_info.edit', enabled: true, executionMode: null }],
      capabilityKey: 'business_info.edit',
      requestText: 'Update the phone number',
    })
    expect(result).toMatchObject({ ok: false, applied: false, error: 'unavailable', status: 'FAILED' })
    expect(hoisted.prisma.managedSiteChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'FAILED' }),
    })
  })

  it('does not apply an approval-required change before approval', async () => {
    const created = await submitManagedSiteChange({
      actorUserId: 'user-1',
      actor: 'customer',
      site,
      assignments: [{ capabilityKey: 'popups.manage', enabled: true, executionMode: null }],
      capabilityKey: 'popups.manage',
      requestText: 'Turn the popup off',
    })
    expect(created).toMatchObject({ ok: true, applied: false, status: 'AWAITING_APPROVAL' })

    const blocked = await approveManagedSiteChange({
      actorUserId: 'staff-1',
      change: { id: 'chg-1', status: 'DRAFT', capabilityKey: 'popups.manage', managedSiteId: site.id },
      site,
    })
    expect(blocked).toMatchObject({ ok: false, error: 'not_awaiting_approval', applied: false })
    expect(hoisted.prisma.managedSiteChange.update).not.toHaveBeenCalled()
  })

  it('records approval but does not mark the change applied when the adapter cannot publish', async () => {
    const result = await approveManagedSiteChange({
      actorUserId: 'staff-1',
      change: { id: 'chg-1', status: 'AWAITING_APPROVAL', capabilityKey: 'popups.manage', managedSiteId: site.id },
      site,
    })
    expect(result).toMatchObject({ ok: false, applied: false, error: 'unavailable', status: 'APPROVED' })
    expect(hoisted.prisma.managedSiteChange.update).toHaveBeenCalledWith({
      where: { id: 'chg-1' },
      data: expect.objectContaining({ status: 'APPROVED', appliedAt: null }),
    })
  })
})

describe('site registration', () => {
  it('rejects a duplicate domain', async () => {
    hoisted.prisma.customerAccount.findUnique.mockResolvedValue({ id: 'acct-1' })
    hoisted.prisma.managedSite.findUnique.mockResolvedValue({ id: 'existing' })
    const result = await registerManagedSite({
      actorRole: 'ADMIN',
      customerAccountId: 'acct-1',
      name: 'Other',
      domain: 'ABMEDAesthetics.com',
      canonicalUrl: 'https://abmedaesthetics.com/',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate_domain' })
    expect(hoisted.prisma.managedSite.create).not.toHaveBeenCalled()
  })

  it('lets staff update site profile fields and blocks customers from adapter, connection, and capability grants', async () => {
    hoisted.prisma.managedSite.update.mockResolvedValue({})
    const profile = await updateManagedSiteProfile({
      siteId: 'site-1',
      customerAccountId: 'acct-1',
      name: 'Clinic site',
      status: 'ACTIVE',
    })
    expect(profile).toEqual({ ok: true })
    expect(hoisted.prisma.managedSite.update).toHaveBeenCalledWith({
      where: { id: 'site-1' },
      data: { name: 'Clinic site', status: 'ACTIVE' },
    })

    hoisted.requireStaff.mockRejectedValue(new Error('Staff access required'))
    hoisted.requireAdmin.mockRejectedValue(new Error('Admin access required'))
    hoisted.requireManagedSiteStaffAccess.mockRejectedValue(new Error('Staff access required'))
    await expect(
      createManagedSiteAction({
        customerAccountId: 'acct-2',
        name: 'Stolen',
        domain: 'stolen.example',
        canonicalUrl: 'https://stolen.example/',
        adapterKey: 'abmed',
      }),
    ).resolves.toEqual({ ok: false, error: 'unauthorized' })
    await expect(updateManagedSiteConnectionAction('site-1', 'abmed', 'API')).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    })
    await expect(setManagedSiteCapabilityAction('site-1', 'popups.manage', true, 'SELF_SERVICE')).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    })
    expect(hoisted.prisma.managedSite.create).not.toHaveBeenCalled()

    hoisted.requireManagedSiteStaffAccess.mockResolvedValue({
      staff: { id: 'staff-1', role: 'STAFF' },
      site: { id: 'site-1', customerAccountId: 'acct-1' },
    })
    await expect(updateManagedSiteProfileAction('site-1', { name: 'Renamed' })).resolves.toEqual({ ok: true })
  })

  it('lets staff register a manual site and blocks staff from choosing an adapter', async () => {
    hoisted.prisma.customerAccount.findUnique.mockResolvedValue({ id: 'acct-1' })
    hoisted.prisma.managedSite.findUnique.mockResolvedValue(null)
    hoisted.prisma.managedSite.create.mockResolvedValue({ id: 'site-new' })
    const denied = await registerManagedSite({
      actorRole: 'STAFF',
      customerAccountId: 'acct-1',
      name: 'Clinic',
      domain: 'clinic.example',
      canonicalUrl: 'https://clinic.example/',
      adapterKey: 'abmed',
      connectionType: 'API',
    })
    expect(denied).toEqual({ ok: false, error: 'unauthorized' })

    const created = await registerManagedSite({
      actorRole: 'STAFF',
      customerAccountId: 'acct-1',
      name: 'Clinic',
      domain: 'clinic.example',
      canonicalUrl: 'https://clinic.example/',
    })
    expect(created).toEqual({ ok: true, siteId: 'site-new' })
    expect(hoisted.prisma.managedSite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ adapterKey: 'manual', connectionType: 'MANUAL', customerAccountId: 'acct-1' }),
    })
  })

  it('plans ABMED registration without creating a customer or duplicating a domain', () => {
    expect(planAbmedRegistration({ customerAccountId: null, existingSites: [] })).toEqual({
      ok: false,
      error: 'customer_not_found',
    })
    const plan = planAbmedRegistration({
      customerAccountId: 'acct-1',
      existingSites: [{ domain: 'abmedaesthetics.com', customerAccountId: 'acct-1' }],
    })
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      expect(plan.existing).toEqual(['abmedaesthetics.com'])
      expect(plan.create.map((profile) => profile.domain)).toEqual(['abmedphysiciansgroup.com'])
    }
    expect(
      planAbmedRegistration({
        customerAccountId: 'acct-1',
        existingSites: [{ domain: 'abmedaesthetics.com', customerAccountId: 'acct-2' }],
      }),
    ).toEqual({ ok: false, error: 'domain_taken', domain: 'abmedaesthetics.com' })
  })
})

describe('ABMED profile and adapter', () => {
  it('contains no secrets and does not pretend a live write succeeded', async () => {
    expect(abmedProfilesContainSecrets()).toBe(false)
    expect(ABMED_MANAGED_SITE_PROFILES.map((profile) => profile.domain)).toEqual([
      'abmedaesthetics.com',
      'abmedphysiciansgroup.com',
    ])
    const adapter = getManagedSiteAdapter('abmed')
    await expect(adapter.applyChange(site, 'popups.manage', null)).resolves.toEqual({ ok: false, reason: 'unavailable' })
    await expect(adapter.connectionStatus(site)).resolves.toMatchObject({ state: 'not_connected' })
  })

  it('rejects a structured payload for an unknown capability', () => {
    expect(validateManagedSiteChangePayload('homepage.redesign', { title: 'Hi' })).toEqual({ ok: false, error: 'unknown' })
  })
})
