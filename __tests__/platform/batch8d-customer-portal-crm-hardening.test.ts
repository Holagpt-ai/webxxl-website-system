import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MembershipRole } from '@prisma/client'
import { getDashboardNavModules } from '@/lib/portal/modules'
import { assertCrmPermission, resolveCrmPermissions } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import {
  CRM_DASHBOARD_PAGE_PATHS,
  evaluateCrmPageEntitlement,
  resolveCrmPageEntitlement,
} from '@/lib/platform/crm/page-entitlement'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
} from '@/lib/platform/open001/subscriber-evidence'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

const PILOT_A = 'acct_pilot_subscriber'
const PILOT_B = 'acct_pilot_non_subscriber'

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: vi.fn(),
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(),
}))

import { requireCustomerMembership } from '@/lib/portal/authz'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import { requireCrmApiActor } from '@/lib/platform/crm/route-auth'

function portalFor(accountId: string) {
  return {
    id: 'user_test',
    role: 'CUSTOMER' as const,
    membership: { role: 'OWNER' as const },
    customerAccount: { id: accountId, billingGroupId: null },
  }
}

function activeSubscription(accountId: string) {
  return {
    customerAccountId: accountId,
    productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
    status: 'ACTIVE' as const,
  }
}

describe('Batch 8D customer portal + CRM release hardening', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('dashboard shell redirects staff and admin away from customer routes', () => {
    const layout = readFileSync(join(process.cwd(), 'app/[locale]/dashboard/layout.tsx'), 'utf8')
    expect(layout).toContain("session.user.role === 'STAFF'")
    expect(layout).toContain("session.user.role === 'ADMIN'")
    expect(layout).toContain("redirect(locale === 'es' ? '/es/admin' : '/admin')")
  })

  it('global nav exposes CRM as a link separate from project messages', () => {
    const nav = getDashboardNavModules()
    const crm = nav.find((m) => m.key === 'crm')
    const messages = nav.find((m) => m.key === 'messages' && m.route === '/dashboard/messages')
    expect(crm?.route).toBe('/dashboard/crm')
    expect(messages?.route).toBe('/dashboard/messages')
  })

  it('CRM layout gates workspace chrome before nested routes', () => {
    const layout = readFileSync(join(process.cwd(), 'app/[locale]/dashboard/crm/layout.tsx'), 'utf8')
    expect(layout).toContain('resolveCrmPageEntitlement')
    expect(layout).toContain("entitlement.state !== 'eligible'")
    expect(CRM_DASHBOARD_PAGE_PATHS.length).toBeGreaterThanOrEqual(10)
  })

  it('OPEN-001 module gate fails closed when subscription evidence is not verified', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_A) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_A),
      loadOutcome: 'failed',
      loadError: 'db unavailable',
    })
    await expect(requireIncludedFreeSoftwareMembership('core.crm', CrmApiError)).rejects.toMatchObject({
      status: 503,
      code: 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
    })

    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_A),
      subscriptions: [activeSubscription(PILOT_A)],
      loadOutcome: 'synthetic',
    })
    await expect(requireIncludedFreeSoftwareMembership('core.crm', CrmApiError)).rejects.toMatchObject({
      status: 503,
      code: 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
    })
  })

  it('CRM API allows subscriber Pilot A and denies non-subscriber Pilot B with test sessions', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')

    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_A) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_A),
      subscriptions: [activeSubscription(PILOT_A)],
      loadOutcome: 'ok',
    })
    await expect(requireCrmApiActor('crm.read')).resolves.toMatchObject({
      customerAccountId: PILOT_A,
      entitlementAccess: 'INCLUDED',
    })

    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_B) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_B),
      loadOutcome: 'ok',
    })
    await expect(requireCrmApiActor('crm.read')).rejects.toMatchObject({
      status: 403,
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    })
  })

  it('CRM permission boundaries keep import/export owner-only for customers', () => {
    const member = resolveCrmPermissions({ membershipRole: MembershipRole.MEMBER, isStaff: false })
    expect(member.has('crm.read')).toBe(true)
    expect(member.has('crm.import')).toBe(false)
    expect(() => assertCrmPermission({ membershipRole: MembershipRole.MEMBER, isStaff: false }, 'crm.export')).toThrow()

    const owner = resolveCrmPermissions({ membershipRole: MembershipRole.OWNER, isStaff: false })
    expect(owner.has('crm.import')).toBe(true)
    expect(owner.has('crm.admin')).toBe(true)
  })

  it('page entitlement mirrors subscriber vs non-subscriber without leaking evidence fields', () => {
    const allowed = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_A,
      crmBackendEnabled: true,
      evidence: {
        ...emptySubscriberEvidence(PILOT_A),
        subscriptions: [activeSubscription(PILOT_A)],
        loadOutcome: 'ok',
      },
    })
    expect(allowed.state).toBe('eligible')
    expect(allowed).not.toHaveProperty('subscriptions')

    const denied = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_B,
      crmBackendEnabled: true,
      evidence: { ...emptySubscriberEvidence(PILOT_B), loadOutcome: 'ok' },
    })
    expect(denied.state).toBe('subscription_required')
    expect(denied.renderWorkspace).toBe(false)
  })

  it('revalidates CRM layouts when the active customer account switches', () => {
    const actions = readFileSync(join(process.cwd(), 'lib/portal/customer-actions.ts'), 'utf8')
    expect(actions).toContain("revalidatePath('/dashboard/crm', 'layout')")
    expect(actions).toContain("revalidatePath('/es/dashboard/crm', 'layout')")
  })
})

describe('Batch 8D resolve CRM page entitlement (session scoped)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('loads evidence only for the session CustomerAccount', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_B) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_B),
      loadOutcome: 'ok',
    })
    const entitlement = await resolveCrmPageEntitlement()
    expect(entitlement.customerAccountId).toBe(PILOT_B)
    expect(loadSubscriberEvidenceForAccount).toHaveBeenCalledWith(PILOT_B)
    expect(entitlement.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
  })
})
