import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canTransitionServiceOrder, OPEN_SERVICE_ORDER_STATUSES } from '@/lib/marketplace/transitions'
import { getMarketplaceService, listVisibleMarketplaceServices } from '@/lib/marketplace/catalog'
import { isEnabled } from '@/config/features'

const hoisted = vi.hoisted(() => ({
  serviceOrderFindFirst: vi.fn(),
  serviceOrderCreate: vi.fn(),
  serviceOrderFindUnique: vi.fn(),
  serviceOrderUpdate: vi.fn(),
  projectFindFirst: vi.fn(),
  customerServiceUpsert: vi.fn(),
  activityCreate: vi.fn(),
  requireCustomer: vi.fn(async () => ({ id: 'user-1', customerAccount: { id: 'acct-1' } })),
  requireStaff: vi.fn(async () => ({ id: 'staff-1', role: 'STAFF' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: {
    serviceOrder: {
      findFirst: hoisted.serviceOrderFindFirst,
      create: hoisted.serviceOrderCreate,
      findUnique: hoisted.serviceOrderFindUnique,
      update: hoisted.serviceOrderUpdate,
    },
    project: { findFirst: hoisted.projectFindFirst },
    customerService: { upsert: hoisted.customerServiceUpsert },
    serviceOrderActivity: { create: hoisted.activityCreate },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: hoisted.requireCustomer,
  requireStaff: hoisted.requireStaff,
}))

import { createServiceOrderRequest, transitionServiceOrderStatus, activateServiceOrderEntitlement } from '@/lib/marketplace/orders'
import { requestMarketplaceServiceAction } from '@/lib/marketplace/customer-actions'

describe('batch11 marketplace catalog', () => {
  it('lists services when feature flag enabled', () => {
    expect(isEnabled('serviceMarketplace')).toBe(true)
    const services = listVisibleMarketplaceServices()
    expect(services.length).toBeGreaterThan(0)
    expect(getMarketplaceService('marketplace.website-new-page')).toBeTruthy()
  })
})

describe('batch11 order transitions', () => {
  it('allows review from requested and blocks completed to requested', () => {
    expect(canTransitionServiceOrder('REQUESTED', 'UNDER_REVIEW')).toBe(true)
    expect(canTransitionServiceOrder('COMPLETED', 'REQUESTED')).toBe(false)
  })

  it('defines open statuses for duplicate protection', () => {
    expect(OPEN_SERVICE_ORDER_STATUSES).toContain('IN_PROGRESS')
  })
})

describe('batch11 order creation', () => {
  beforeEach(() => {
    hoisted.serviceOrderFindFirst.mockReset()
    hoisted.serviceOrderCreate.mockReset()
    hoisted.projectFindFirst.mockReset()
    hoisted.activityCreate.mockResolvedValue({})
  })

  it('blocks duplicate open orders', async () => {
    hoisted.projectFindFirst.mockResolvedValue({ id: 'proj-1' })
    hoisted.serviceOrderFindFirst.mockResolvedValue({ id: 'ord-1', publicId: 'WO-ABC', status: 'REQUESTED' })
    const result = await createServiceOrderRequest({
      actorUserId: 'user-1',
      customerAccountId: 'acct-1',
      serviceKey: 'marketplace.website-new-page',
      projectId: 'proj-1',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.duplicate).toBe(true)
    expect(hoisted.serviceOrderCreate).not.toHaveBeenCalled()
  })

  it('creates order for eligible service', async () => {
    hoisted.serviceOrderFindFirst.mockResolvedValue(null)
    hoisted.projectFindFirst.mockResolvedValue({ id: 'proj-1' })
    hoisted.serviceOrderCreate.mockResolvedValue({ id: 'ord-2', publicId: 'WO-NEW', status: 'REQUESTED' })
    const result = await createServiceOrderRequest({
      actorUserId: 'user-1',
      customerAccountId: 'acct-1',
      serviceKey: 'marketplace.website-new-page',
      projectId: 'proj-1',
      customerNotes: 'Homepage section',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.serviceOrderCreate).toHaveBeenCalled()
  })

  it('scopes customer action to membership', async () => {
    hoisted.serviceOrderFindFirst.mockResolvedValue(null)
    hoisted.projectFindFirst.mockResolvedValue({ id: 'proj-1' })
    hoisted.serviceOrderCreate.mockResolvedValue({ id: 'ord-3', publicId: 'WO-X', status: 'REQUESTED' })
    const result = await requestMarketplaceServiceAction({
      serviceKey: 'marketplace.website-new-page',
      projectId: 'proj-1',
    })
    expect(result.ok).toBe(true)
  })
})

describe('batch11 entitlement activation', () => {
  beforeEach(() => {
    hoisted.serviceOrderFindUnique.mockReset()
    hoisted.customerServiceUpsert.mockReset()
    hoisted.serviceOrderUpdate.mockReset()
    hoisted.activityCreate.mockResolvedValue({})
  })

  it('does not activate before completed', async () => {
    hoisted.serviceOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      status: 'APPROVED',
      serviceKey: 'marketplace.seo-local',
      customerAccountId: 'acct-1',
      customerServiceId: null,
    })
    const result = await activateServiceOrderEntitlement({ orderId: 'ord-1', actorUserId: 'staff-1' })
    expect(result).toEqual({ ok: false, error: 'invalid_status' })
    expect(hoisted.customerServiceUpsert).not.toHaveBeenCalled()
  })

  it('activates entitlement only when completed', async () => {
    hoisted.serviceOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      status: 'COMPLETED',
      serviceKey: 'marketplace.seo-local',
      customerAccountId: 'acct-1',
      customerServiceId: null,
    })
    hoisted.customerServiceUpsert.mockResolvedValue({ id: 'cs-1' })
    const result = await activateServiceOrderEntitlement({ orderId: 'ord-1', actorUserId: 'staff-1' })
    expect(result.ok).toBe(true)
    expect(hoisted.customerServiceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerAccountId_serviceKey: { customerAccountId: 'acct-1', serviceKey: 'seo' } },
      }),
    )
  })

  it('records authorized status transitions', async () => {
    hoisted.serviceOrderFindUnique.mockResolvedValue({ id: 'ord-1', status: 'REQUESTED', internalNotes: null })
    hoisted.serviceOrderUpdate.mockResolvedValue({})
    const result = await transitionServiceOrderStatus({
      orderId: 'ord-1',
      actorUserId: 'staff-1',
      nextStatus: 'UNDER_REVIEW',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.activityCreate).toHaveBeenCalled()
  })
})
