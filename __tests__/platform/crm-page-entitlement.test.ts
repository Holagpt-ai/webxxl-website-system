import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { denyBillingGroupSiblingCrmAccess } from '@/lib/platform/crm/account-isolation'
import {
  CRM_DASHBOARD_PAGE_PATHS,
  CRM_PAGE_ENTITLEMENT_KEY,
  crmPageGateForPath,
  crmPageLockedCopy,
  crmPageMayExposeRecords,
  evaluateCrmPageEntitlement,
  isCrmDashboardPagePath,
  resolveCrmPageEntitlement,
} from '@/lib/platform/crm/page-entitlement'
import { CrmApiError, requireCrmApiActor } from '@/lib/platform/crm/route-auth'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
} from '@/lib/platform/open001/subscriber-evidence'

const PILOT_A = 'acct_pilot_subscriber'
const PILOT_B = 'acct_pilot_non_subscriber'
const SIBLING = 'acct_billing_sibling'

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: vi.fn(),
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(),
}))

vi.mock('@/lib/platform/crm/contact-list-service', () => ({
  listCrmContacts: vi.fn(),
}))

import { requireCustomerMembership } from '@/lib/portal/authz'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import { listCrmContacts } from '@/lib/platform/crm/contact-list-service'
import { GET as getCrmContacts } from '@/app/api/v1/crm/contacts/route'

function activeSubscription(accountId: string) {
  return {
    customerAccountId: accountId,
    productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
    status: 'ACTIVE' as const,
  }
}

function portalFor(accountId: string) {
  return {
    id: 'user_test',
    role: 'CUSTOMER' as const,
    membership: { role: 'OWNER' as const },
    customerAccount: { id: accountId, billingGroupId: 'bg_shared_payer' },
  }
}

function pageFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...pageFiles(full))
    else if (entry === 'page.tsx') found.push(full)
  }
  return found
}

function routeFromPageFile(file: string): string {
  const normalized = file.replace(/\\/g, '/')
  const marker = 'app/[locale]'
  const start = normalized.indexOf(marker)
  return normalized.slice(start + marker.length).replace(/\/page\.tsx$/, '')
}

describe('CRM page entitlement (Issue #105)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('grants Pilot A when the session account has qualifying website subscription evidence', () => {
    const entitlement = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_A,
      crmBackendEnabled: true,
      evidence: {
        ...emptySubscriberEvidence(PILOT_A),
        subscriptions: [activeSubscription(PILOT_A)],
        loadOutcome: 'ok',
      },
    })
    expect(entitlement).toMatchObject({
      state: 'eligible',
      code: 'INCLUDED',
      httpStatus: 200,
      customerAccountId: PILOT_A,
      renderWorkspace: true,
      showIncludedFreeBadge: true,
      locked: null,
    })
    expect(crmPageMayExposeRecords(entitlement)).toBe(true)
    expect(entitlement).not.toHaveProperty('subscriptions')
    expect(entitlement).not.toHaveProperty('billingGroupId')
    expect(entitlement).not.toHaveProperty('role')
  })

  it('denies Pilot B with subscription_required and hides the FREE workspace', () => {
    const entitlement = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_B,
      crmBackendEnabled: true,
      evidence: { ...emptySubscriberEvidence(PILOT_B), loadOutcome: 'ok' },
    })
    expect(entitlement).toMatchObject({
      state: 'subscription_required',
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
      httpStatus: 403,
      renderWorkspace: false,
      showIncludedFreeBadge: false,
    })
    expect(crmPageMayExposeRecords(entitlement)).toBe(false)
    const en = crmPageLockedCopy(entitlement, 'en')
    const es = crmPageLockedCopy(entitlement, 'es')
    expect(en?.title).toMatch(/active website subscription required/i)
    expect(en?.body).toMatch(/active website subscription/i)
    expect(es?.title).toMatch(/suscripción activa de sitio web/i)
    expect(es?.body).toMatch(/suscripción activa de sitio web/i)
    const text = `${en?.title} ${en?.body} ${es?.title} ${es?.body}`
    expect(text).not.toMatch(/FREE|GRATIS|included free|incluido gratis|role|rol/i)
  })

  it('fails closed when subscription evidence is missing or not for the session account', () => {
    for (const evidence of [
      { ...emptySubscriberEvidence(PILOT_A), loadOutcome: 'failed' as const, loadError: 'connection reset' },
      { ...emptySubscriberEvidence(PILOT_A), subscriptions: [activeSubscription(PILOT_A)], loadOutcome: 'synthetic' as const },
      {
        ...emptySubscriberEvidence(PILOT_B),
        customerAccountId: PILOT_B,
        subscriptions: [activeSubscription(PILOT_A)],
        loadOutcome: 'ok' as const,
      },
    ]) {
      const entitlement = evaluateCrmPageEntitlement({
        customerAccountId: PILOT_A,
        crmBackendEnabled: true,
        evidence,
      })
      expect(entitlement.state).not.toBe('eligible')
      expect(entitlement.renderWorkspace).toBe(false)
      expect(entitlement.showIncludedFreeBadge).toBe(false)
      expect(crmPageMayExposeRecords(entitlement)).toBe(false)
    }
    const failed = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_A,
      crmBackendEnabled: true,
      evidence: { ...emptySubscriberEvidence(PILOT_A), loadOutcome: 'failed', loadError: 'timeout' },
    })
    expect(failed).toMatchObject({
      state: 'unavailable',
      code: 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
      httpStatus: 503,
    })
  })

  it('does not treat a billing-group sibling subscription as CRM authorization', () => {
    const entitlement = evaluateCrmPageEntitlement({
      customerAccountId: SIBLING,
      crmBackendEnabled: true,
      evidence: {
        ...emptySubscriberEvidence(SIBLING),
        subscriptions: [activeSubscription(PILOT_A)],
        loadOutcome: 'ok',
      },
    })
    expect(entitlement.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
    expect(entitlement.showIncludedFreeBadge).toBe(false)
    const siblingRead = denyBillingGroupSiblingCrmAccess({
      actorUserId: 'user_sibling',
      targetAccountId: SIBLING,
      recordAccountId: PILOT_A,
      operatingMemberships: [{ userId: 'user_sibling', customerAccountId: SIBLING }],
      billingGroupSiblingAccounts: new Map([['bg_shared_payer', [PILOT_A, SIBLING]]]),
    })
    expect(siblingRead.ok).toBe(false)
    if (!siblingRead.ok) expect(siblingRead.code).toBe('BILLING_GROUP_NOT_AUTHORIZATION')
    const source = readFileSync(join(process.cwd(), 'lib/platform/crm/page-entitlement.ts'), 'utf8')
    expect(source).not.toMatch(/billingGroup|BillingGroup/)
    expect(source).toContain(CRM_PAGE_ENTITLEMENT_KEY)
  })

  it('applies the same closed decision to overview and direct nested CRM routes', () => {
    const denied = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_B,
      crmBackendEnabled: true,
      evidence: { ...emptySubscriberEvidence(PILOT_B), loadOutcome: 'ok' },
    })
    const paths = [
      '/dashboard/crm',
      '/es/dashboard/crm',
      '/dashboard/crm/contacts',
      '/es/dashboard/crm/contacts',
      '/dashboard/crm/contacts/ck_pilot_b',
      '/es/dashboard/crm/leads/funnel',
      '/dashboard/crm/merges',
    ]
    for (const path of paths) {
      expect(isCrmDashboardPagePath(path)).toBe(true)
      const gated = crmPageGateForPath(path, denied)
      expect(gated).toBe(denied)
      expect(crmPageMayExposeRecords(gated)).toBe(false)
      expect(gated.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
    }
    expect(crmPageMayExposeRecords(crmPageGateForPath('/dashboard/marketing', denied))).toBe(false)
    expect(isCrmDashboardPagePath('/dashboard/crm/not-a-page')).toBe(false)
  })

  it('lists every CRM dashboard page file, including nested routes', () => {
    const root = join(process.cwd(), 'app/[locale]/dashboard/crm')
    const routes = pageFiles(root).map(routeFromPageFile).sort()
    expect(routes).toEqual([...CRM_DASHBOARD_PAGE_PATHS].sort())
  })

  it('keeps CRM disabled closed and does not show FREE access', () => {
    const entitlement = evaluateCrmPageEntitlement({
      customerAccountId: PILOT_A,
      crmBackendEnabled: false,
      evidence: {
        ...emptySubscriberEvidence(PILOT_A),
        subscriptions: [activeSubscription(PILOT_A)],
        loadOutcome: 'ok',
      },
    })
    expect(entitlement).toMatchObject({
      state: 'unavailable',
      code: 'CRM_DISABLED',
      httpStatus: 503,
      renderWorkspace: false,
      showIncludedFreeBadge: false,
    })
  })

  it('resolves the session CustomerAccount and does not load evidence when CRM is disabled', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'false')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_A) as never)
    const entitlement = await resolveCrmPageEntitlement()
    expect(entitlement.customerAccountId).toBe(PILOT_A)
    expect(entitlement.code).toBe('CRM_DISABLED')
    expect(loadSubscriberEvidenceForAccount).not.toHaveBeenCalled()
  })

  it('resolves Pilot A and Pilot B from account-scoped evidence', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_A) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_A),
      subscriptions: [activeSubscription(PILOT_A)],
      loadOutcome: 'ok',
    })
    await expect(resolveCrmPageEntitlement()).resolves.toMatchObject({
      state: 'eligible',
      customerAccountId: PILOT_A,
    })
    expect(loadSubscriberEvidenceForAccount).toHaveBeenCalledWith(PILOT_A)

    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_B) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_B),
      loadOutcome: 'ok',
    })
    await expect(resolveCrmPageEntitlement()).resolves.toMatchObject({
      state: 'subscription_required',
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
      customerAccountId: PILOT_B,
    })
    expect(loadSubscriberEvidenceForAccount).toHaveBeenCalledWith(PILOT_B)
  })
})

describe('CRM contacts API entitlement (Issue #105)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns 403 FREE_SOFTWARE_NOT_ELIGIBLE for Pilot B and does not list contacts', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_B) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_B),
      loadOutcome: 'ok',
    })
    await expect(requireCrmApiActor('crm.read')).rejects.toMatchObject({
      name: 'CrmApiError',
      status: 403,
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    })
    const response = await getCrmContacts(new Request('http://localhost/api/v1/crm/contacts'))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    })
    expect(listCrmContacts).not.toHaveBeenCalled()
  })

  it('returns 403 when a sibling account presents another account subscription', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(SIBLING) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(SIBLING),
      subscriptions: [activeSubscription(PILOT_A)],
      loadOutcome: 'ok',
    })
    const response = await getCrmContacts(new Request('http://localhost/api/v1/crm/contacts'))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'FREE_SOFTWARE_NOT_ELIGIBLE' })
    expect(listCrmContacts).not.toHaveBeenCalled()
    await expect(requireCrmApiActor()).rejects.toBeInstanceOf(CrmApiError)
  })

  it('allows Pilot A through the existing API gate for the session account only', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'true')
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(PILOT_A) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(PILOT_A),
      subscriptions: [activeSubscription(PILOT_A)],
      loadOutcome: 'ok',
    })
    vi.mocked(listCrmContacts).mockResolvedValue({ ok: true, value: { contacts: [] } })
    const actor = await requireCrmApiActor('crm.read')
    expect(actor).toMatchObject({ customerAccountId: PILOT_A, entitlementAccess: 'INCLUDED' })
    const response = await getCrmContacts(new Request('http://localhost/api/v1/crm/contacts'))
    expect(response.status).toBe(200)
    expect(listCrmContacts).toHaveBeenCalledWith(
      expect.objectContaining({ customerAccountId: PILOT_A }),
    )
  })

  it('keeps CRM_DISABLED ahead of the subscriber check', async () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', 'false')
    const response = await getCrmContacts(new Request('http://localhost/api/v1/crm/contacts'))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: 'CRM_DISABLED' })
    expect(requireCustomerMembership).not.toHaveBeenCalled()
    expect(listCrmContacts).not.toHaveBeenCalled()
  })
})
