import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeDomainName } from '@/lib/infrastructure/domain'
import { isInfrastructureRequestType, infrastructureRequestSubject } from '@/lib/infrastructure/requests'
import { getDnsProvider, getHostingProvider } from '@/lib/infrastructure/providers/stubs'
import { isEnabled } from '@/config/features'
import { getDictionary } from '@/lib/i18n/dictionaries'

const hoisted = vi.hoisted(() => ({
  hostingFindFirst: vi.fn(),
  domainFindUnique: vi.fn(),
  domainCreate: vi.fn(),
  activityCreate: vi.fn(),
  supportCreate: vi.fn(),
  supportFindFirst: vi.fn(),
  projectFindFirst: vi.fn(),
  requireCustomer: vi.fn(async () => ({ id: 'user-1', customerAccount: { id: 'acct-1' } })),
  requireStaff: vi.fn(async () => ({ id: 'staff-1', role: 'STAFF' })),
  notifyStaff: vi.fn(async () => undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: {
    hostingService: { findFirst: hoisted.hostingFindFirst, create: vi.fn() },
    managedDomain: { findUnique: hoisted.domainFindUnique, findFirst: vi.fn(), create: hoisted.domainCreate },
    businessEmailService: { findFirst: vi.fn(), create: vi.fn() },
    infrastructureActivity: { create: hoisted.activityCreate },
    supportRequest: { create: hoisted.supportCreate, findFirst: hoisted.supportFindFirst },
    project: { findFirst: hoisted.projectFindFirst },
  },
}))

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: hoisted.requireCustomer,
  requireStaff: hoisted.requireStaff,
}))

vi.mock('@/lib/automation/hooks', () => ({
  automationHooks: { infrastructureSupportRequestSubmitted: hoisted.notifyStaff },
}))

import { registerManagedDomain } from '@/lib/infrastructure/registry'
import { createInfrastructureSupportRequest } from '@/lib/infrastructure/requests'
import { submitInfrastructureRequestAction } from '@/lib/infrastructure/customer-actions'
import { adminRegisterDomainAction } from '@/lib/infrastructure/admin-actions'

describe('batch12 feature flag and i18n', () => {
  it('enables infrastructure management', () => {
    expect(isEnabled('infrastructureManagement')).toBe(true)
  })

  it('includes EN/ES infrastructure copy and routes vocabulary', () => {
    const en = getDictionary('en').dashboard.infrastructureRequestTypes.hosting_setup
    const es = getDictionary('es').dashboard.infrastructureRequestTypes.hosting_setup
    expect(en).toContain('Hosting')
    expect(es.length).toBeGreaterThan(5)
    expect(getDictionary('en').dashboard.nav.infrastructure).toBe('Infrastructure')
    expect(getDictionary('es').dashboard.nav.infrastructure).toBe('Infraestructura')
  })
})

describe('batch12 domain normalization', () => {
  it('normalizes valid domains and rejects invalid', () => {
    expect(normalizeDomainName(' Example.COM. ')).toBe('example.com')
    expect(normalizeDomainName('not a domain')).toBeNull()
    expect(normalizeDomainName('')).toBeNull()
  })
})

describe('batch12 duplicate domain prevention', () => {
  beforeEach(() => {
    hoisted.domainFindUnique.mockReset()
    hoisted.domainCreate.mockReset()
    hoisted.activityCreate.mockResolvedValue({})
  })

  it('blocks duplicate domain for same customer', async () => {
    hoisted.domainFindUnique.mockResolvedValue({ id: 'dom-1' })
    const result = await registerManagedDomain({
      customerAccountId: 'acct-1',
      domainName: 'example.com',
      actorUserId: 'staff-1',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate_domain' })
    expect(hoisted.domainCreate).not.toHaveBeenCalled()
  })

  it('registers normalized domain', async () => {
    hoisted.domainFindUnique.mockResolvedValue(null)
    hoisted.domainCreate.mockResolvedValue({ id: 'dom-2', domainName: 'example.com' })
    const result = await registerManagedDomain({
      customerAccountId: 'acct-1',
      domainName: 'EXAMPLE.com',
      actorUserId: 'staff-1',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.domainCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ domainName: 'example.com' }) }),
    )
  })
})

describe('batch12 provider stubs', () => {
  it('never performs external writes', async () => {
    const hosting = getHostingProvider('vercel')
    const dns = getDnsProvider('cloudflare')
    await expect(hosting.requestProvisioning()).resolves.toEqual({ ok: false, error: 'unavailable' })
    await expect(hosting.synchronize()).resolves.toEqual({ ok: false, error: 'unavailable' })
    await expect(dns.requestModification()).resolves.toEqual({ ok: false, error: 'unavailable' })
  })
})

describe('batch12 customer isolation and requests', () => {
  beforeEach(() => {
    hoisted.supportFindFirst.mockReset()
    hoisted.supportCreate.mockReset()
    hoisted.projectFindFirst.mockReset()
    hoisted.hostingFindFirst.mockReset()
    hoisted.notifyStaff.mockClear()
  })

  it('validates infrastructure request types', () => {
    expect(isInfrastructureRequestType('dns_modification')).toBe(true)
    expect(isInfrastructureRequestType('bogus')).toBe(false)
    expect(infrastructureRequestSubject('dns_modification', 'en')).toContain('[Infrastructure]')
  })

  it('creates support ticket without provider mutation', async () => {
    hoisted.supportFindFirst.mockResolvedValue(null)
    hoisted.supportCreate.mockResolvedValue({ id: 'sup-1' })
    const result = await createInfrastructureSupportRequest({
      customerAccountId: 'acct-1',
      actorUserId: 'user-1',
      type: 'hosting_setup',
      locale: 'en',
      message: 'Need staging environment',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.supportCreate).toHaveBeenCalled()
    const message = hoisted.supportCreate.mock.calls[0][0].data.message as string
    expect(message).toContain('human review')
  })

  it('scopes customer action to membership', async () => {
    hoisted.supportFindFirst.mockResolvedValue(null)
    hoisted.supportCreate.mockResolvedValue({ id: 'sup-2' })
    const result = await submitInfrastructureRequestAction({
      locale: 'en',
      type: 'ssl_assistance',
      message: 'Renew cert',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.requireCustomer).toHaveBeenCalled()
  })
})

describe('batch12 staff mutations', () => {
  it('requires staff for admin domain registration', async () => {
    hoisted.domainFindUnique.mockResolvedValue(null)
    hoisted.domainCreate.mockResolvedValue({ id: 'd1', domainName: 'x.com' })
    hoisted.activityCreate.mockResolvedValue({})
    const fd = new FormData()
    fd.set('customerAccountId', 'acct-1')
    fd.set('domainName', 'x.com')
    await adminRegisterDomainAction(fd)
    expect(hoisted.requireStaff).toHaveBeenCalled()
    expect(hoisted.domainCreate).toHaveBeenCalled()
  })
})
