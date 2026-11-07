import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCustomerMembership: vi.fn(),
  getCustomerOperationsSummary: vi.fn(),
}))

vi.mock('@/lib/portal/authz', () => ({
  AuthError: class AuthError extends Error {
    constructor(message = 'Unauthorized') {
      super(message)
      this.name = 'AuthError'
    }
  },
  requireCustomerMembership: mocks.requireCustomerMembership,
}))

vi.mock('@/lib/platform/customer-operations/service', () => ({
  getCustomerOperationsSummary: mocks.getCustomerOperationsSummary,
}))

import { AuthError } from '@/lib/portal/authz'
import { GET } from '@/app/api/v1/customer-operations/summary/route'

function request(accountId?: string): Request {
  const url = new URL('https://webxxl.test/api/v1/customer-operations/summary')
  if (accountId) url.searchParams.set('customerAccountId', accountId)
  return new Request(url)
}

describe('Batch 1 customer-operations summary route authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireCustomerMembership.mockResolvedValue({
      customerAccount: { id: 'acct_a' },
      membership: { customerAccountId: 'acct_a', role: 'OWNER' },
      id: 'user_a',
    })
    mocks.getCustomerOperationsSummary.mockResolvedValue({
      customerAccountId: 'acct_a',
      accountScope: 'session_membership',
      recentLineage: [],
    })
  })

  it('serves only the currently authenticated account', async () => {
    for (const requested of [undefined, 'acct_a']) {
      const response = await GET(request(requested))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.summary.customerAccountId).toBe('acct_a')
    }
    expect(mocks.getCustomerOperationsSummary).toHaveBeenCalledTimes(2)
    expect(mocks.getCustomerOperationsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ customerAccount: { id: 'acct_a' } }),
    )
  })

  it('denies another account with HTTP 403 without reading its summary', async () => {
    const response = await GET(request('acct_b'))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.getCustomerOperationsSummary).not.toHaveBeenCalled()
  })

  it('returns HTTP 401 when customer membership is unavailable', async () => {
    mocks.requireCustomerMembership.mockRejectedValueOnce(new AuthError())
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(mocks.getCustomerOperationsSummary).not.toHaveBeenCalled()
  })
})
