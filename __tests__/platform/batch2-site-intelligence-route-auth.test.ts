import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCustomerMembership: vi.fn(),
  getSiteIntelligenceSummary: vi.fn(),
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

vi.mock('@/lib/platform/site-intelligence/service', () => ({
  getSiteIntelligenceSummary: mocks.getSiteIntelligenceSummary,
}))

import { AuthError } from '@/lib/portal/authz'
import { GET } from '@/app/api/v1/site-intelligence/sites/[siteId]/summary/route'

const params = { params: Promise.resolve({ siteId: 'site_a' }) }

function request(accountId?: string): Request {
  const url = new URL('https://webxxl.test/api/v1/site-intelligence/sites/site_a/summary')
  url.searchParams.set('start', '2026-10-01')
  url.searchParams.set('end', '2026-10-28')
  if (accountId) url.searchParams.set('customerAccountId', accountId)
  return new Request(url)
}

describe('Batch 2 site-intelligence summary route authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireCustomerMembership.mockResolvedValue({
      customerAccount: { id: 'acct_a' },
      membership: { customerAccountId: 'acct_a', role: 'OWNER' },
      id: 'user_a',
    })
    mocks.getSiteIntelligenceSummary.mockResolvedValue({
      ok: true,
      value: {
        customerAccountId: 'acct_a',
        managedSiteId: 'site_a',
        seo: { status: 'UNAVAILABLE', sourceModule: 'seo.overview', reasonCode: 'SEO_DISABLED', message: '' },
        analytics: { status: 'UNAVAILABLE', sourceModule: 'analytics.overview', reasonCode: 'ANALYTICS_DISABLED', message: '' },
        googleReadiness: { status: 'UNAVAILABLE', sourceModule: 'google.readiness', reasonCode: 'SEO_DISABLED', message: '' },
      },
    })
  })

  it('returns 200 for session account without cross-tenant query', async () => {
    const response = await GET(request(), params)
    expect(response.status).toBe(200)
    expect(mocks.getSiteIntelligenceSummary).toHaveBeenCalledTimes(1)
  })

  it('denies foreign customerAccountId with 403 without invoking summary', async () => {
    const response = await GET(request('acct_b'), params)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    expect(mocks.getSiteIntelligenceSummary).not.toHaveBeenCalled()
  })

  it('returns 401 when membership is missing', async () => {
    mocks.requireCustomerMembership.mockRejectedValueOnce(new AuthError())
    const response = await GET(request(), params)
    expect(response.status).toBe(401)
    expect(mocks.getSiteIntelligenceSummary).not.toHaveBeenCalled()
  })

  it('returns 404 when summary service reports foreign site', async () => {
    mocks.getSiteIntelligenceSummary.mockResolvedValueOnce({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Managed site not found for account',
    })
    const response = await GET(request(), params)
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' })
  })
})
