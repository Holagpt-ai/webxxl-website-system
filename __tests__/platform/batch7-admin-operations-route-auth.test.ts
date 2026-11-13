import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  getAdminOperationsSummary: vi.fn(),
}))

vi.mock('@/lib/portal/authz', () => ({
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
  requireStaff: mocks.requireStaff,
}))

vi.mock('@/lib/platform/admin-operations/service', () => ({
  getAdminOperationsSummary: mocks.getAdminOperationsSummary,
}))

import { AuthError } from '@/lib/portal/authz'
import { GET } from '@/app/api/v1/admin/operations/summary/route'

function request(params?: { customerAccountId?: string; managedSiteId?: string }): Request {
  const url = new URL('https://webxxl.test/api/v1/admin/operations/summary')
  if (params?.customerAccountId) url.searchParams.set('customerAccountId', params.customerAccountId)
  if (params?.managedSiteId) url.searchParams.set('managedSiteId', params.managedSiteId)
  return new Request(url)
}

describe('Batch 7 admin operations summary route authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireStaff.mockResolvedValue({ id: 'staff-1', role: 'STAFF' })
    mocks.getAdminOperationsSummary.mockResolvedValue({
      ok: true,
      value: { scope: 'platform', customerAccountId: null },
    })
  })

  it('returns 401 when staff session is missing', async () => {
    mocks.requireStaff.mockRejectedValueOnce(new AuthError())
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(mocks.getAdminOperationsSummary).not.toHaveBeenCalled()
  })

  it('returns 404 when managed site does not belong to the account', async () => {
    mocks.getAdminOperationsSummary.mockResolvedValueOnce({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Managed site not found for customer account',
    })
    const response = await GET(request({ customerAccountId: 'acct_a', managedSiteId: 'site_wrong' }))
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns 400 when managedSiteId is provided without customerAccountId', async () => {
    mocks.getAdminOperationsSummary.mockResolvedValueOnce({
      ok: false,
      code: 'VALIDATION',
      message: 'customerAccountId is required when managedSiteId is provided',
    })
    const response = await GET(request({ managedSiteId: 'site_a' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION' })
  })
})
