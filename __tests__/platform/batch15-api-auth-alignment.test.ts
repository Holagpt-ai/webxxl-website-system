import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '@/lib/portal/authz'
import { crmRouteError } from '@/lib/platform/crm/http'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { seoRouteError } from '@/lib/platform/seo/http'
import { commsRouteError } from '@/lib/platform/comms/http'
import { socialRouteError } from '@/lib/platform/social/http'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { MktApiError } from '@/lib/platform/marketing/mkt-api-error'
import { SeoApiError } from '@/lib/platform/seo/seo-api-error'
import { CommsApiError } from '@/lib/platform/comms/comms-api-error'
import { SocialApiError } from '@/lib/platform/social/route-auth'

const mocks = vi.hoisted(() => ({
  requireCrmApiActor: vi.fn(),
  listCrmContacts: vi.fn(),
}))

vi.mock('@/lib/platform/crm/route-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/crm/route-auth')>()
  return {
    ...actual,
    requireCrmApiActor: mocks.requireCrmApiActor,
  }
})

vi.mock('@/lib/platform/crm/contact-list-service', () => ({
  listCrmContacts: mocks.listCrmContacts,
}))

import { GET as crmContactsGet } from '@/app/api/v1/crm/contacts/route'

describe('Batch 15 API auth and entitlement alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireCrmApiActor.mockResolvedValue({
      customerAccountId: 'acct_a',
      userId: 'user_a',
      membershipRole: 'OWNER',
      isStaff: false,
    })
    mocks.listCrmContacts.mockResolvedValue({ ok: true, value: { contacts: [], nextCursor: undefined } })
  })

  it('maps AuthError to 401 in shared route error helpers', async () => {
    const body = { code: 'UNAUTHORIZED', message: 'Unauthorized' }
    for (const helper of [crmRouteError, mktRouteError, seoRouteError, commsRouteError, socialRouteError]) {
      const res = helper(new AuthError())
      expect(res.status).toBe(401)
      await expect(res.json()).resolves.toMatchObject(body)
    }
  })

  it('preserves family ApiError status and code', async () => {
    const crm = crmRouteError(new CrmApiError(503, 'CRM backend is disabled', 'CRM_DISABLED'))
    expect(crm.status).toBe(503)
    await expect(crm.json()).resolves.toMatchObject({ code: 'CRM_DISABLED' })

    const mkt = mktRouteError(new MktApiError(503, 'x', 'POLICY_UNRESOLVED'))
    expect(mkt.status).toBe(503)

    const seo = seoRouteError(new SeoApiError(503, 'x', 'POLICY_UNRESOLVED'))
    expect(seo.status).toBe(503)

    const comms = commsRouteError(new CommsApiError(503, 'x', 'POLICY_UNRESOLVED'))
    expect(comms.status).toBe(503)

    const social = socialRouteError(new SocialApiError(503, 'x', 'POLICY_UNRESOLVED'))
    expect(social.status).toBe(503)
  })

  it('returns 401 from CRM contacts route when session is missing', async () => {
    mocks.requireCrmApiActor.mockRejectedValueOnce(new AuthError())
    const res = await crmContactsGet(new Request('https://webxxl.test/api/v1/crm/contacts'))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    expect(mocks.listCrmContacts).not.toHaveBeenCalled()
  })

  it('evaluates OPEN-001 before social backend flag in requireSocialApiActor', () => {
    const src = readFileSync(join(process.cwd(), 'lib/platform/social/route-auth.ts'), 'utf8')
    const membershipIdx = src.indexOf('requireIncludedFreeSoftwareMembershipKeys')
    const flagIdx = src.indexOf('isSocialMarketingEnabled()')
    expect(membershipIdx).toBeGreaterThan(-1)
    expect(flagIdx).toBeGreaterThan(membershipIdx)
  })

  it('wires CRM customer routes to crmRouteError', () => {
    const sample = readFileSync(join(process.cwd(), 'app/api/v1/crm/deals/route.ts'), 'utf8')
    expect(sample).toContain("from '@/lib/platform/crm/http'")
    expect(sample).toContain('crmRouteError(error)')
    expect(sample).not.toContain('instanceof CrmApiError')
  })
})