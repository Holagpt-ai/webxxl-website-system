import { describe, expect, it, vi } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  acquireMarketplaceSubmitLock,
  releaseMarketplaceSubmitLock,
  resolveMarketplaceServiceDisplayName,
  resolveServiceOrderStatusLabel,
} from '@/lib/marketplace/display'
import { getMarketplaceService } from '@/lib/marketplace/catalog'

const hoisted = vi.hoisted(() => ({
  requireCustomer: vi.fn(async () => ({ id: 'user-1', customerAccount: { id: 'acct-1' } })),
  createOrder: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/portal/authz', () => ({ requireCustomerMembership: hoisted.requireCustomer }))
vi.mock('@/lib/marketplace/orders', () => ({
  createServiceOrderRequest: hoisted.createOrder,
}))

import { requestMarketplaceServiceAction } from '@/lib/marketplace/customer-actions'

describe('batch17 marketplace display names', () => {
  it('shows catalog name for known service keys', () => {
    const key = 'marketplace.website-new-page'
    const def = getMarketplaceService(key)
    expect(resolveMarketplaceServiceDisplayName(key, 'en')).toBe(def?.name.en)
    expect(resolveMarketplaceServiceDisplayName('marketplace.hosting-email', 'es')).toBe(
      'Complemento de hosting, dominio o correo',
    )
  })

  it('falls back for unknown or retired service keys', () => {
    expect(resolveMarketplaceServiceDisplayName('marketplace.retired-addon', 'en')).toBe(
      'Service (marketplace.retired-addon)',
    )
    expect(resolveMarketplaceServiceDisplayName('marketplace.retired-addon', 'es')).toBe(
      'Servicio (marketplace.retired-addon)',
    )
  })

  it('maps order status labels in EN and ES', () => {
    const en = getDictionary('en').dashboard.marketplaceOrderStatusLabels
    const es = getDictionary('es').dashboard.marketplaceOrderStatusLabels
    expect(resolveServiceOrderStatusLabel('REQUESTED', en, 'en')).toBe('Requested')
    expect(resolveServiceOrderStatusLabel('REQUESTED', es, 'es')).toBe('Solicitada')
  })
})

describe('batch17 duplicate submission guard', () => {
  it('allows the first submit and blocks a second until released', () => {
    let locked = false
    const first = acquireMarketplaceSubmitLock(locked)
    expect(first.allowed).toBe(true)
    locked = first.nextLocked
    const second = acquireMarketplaceSubmitLock(locked)
    expect(second.allowed).toBe(false)
    locked = releaseMarketplaceSubmitLock()
    const third = acquireMarketplaceSubmitLock(locked)
    expect(third.allowed).toBe(true)
  })
})

describe('batch17 request action preserves service key', () => {
  it('submits the selected marketplace service key to the server action', async () => {
    hoisted.createOrder.mockResolvedValue({
      ok: true,
      duplicate: false,
      publicId: 'WO-TEST',
      orderId: 'ord-1',
    })
    const result = await requestMarketplaceServiceAction({
      serviceKey: 'marketplace.website-new-page',
      projectId: 'proj-1',
      customerNotes: 'Gallery page',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceKey: 'marketplace.website-new-page',
        projectId: 'proj-1',
        customerNotes: 'Gallery page',
      }),
    )
  })
})

describe('batch17 marketplace translations', () => {
  it('includes modal and confirmation strings in Spanish dashboard copy', () => {
    const es = getDictionary('es').dashboard
    expect(es.marketplaceModalTitle).toMatch(/Solicitar/)
    expect(es.marketplaceConfirmTitle).toMatch(/enviada/)
    expect(es.marketplaceSubmitRequest).toMatch(/Enviar/)
    expect(es.marketplaceDone).toBe('Listo')
  })
})
