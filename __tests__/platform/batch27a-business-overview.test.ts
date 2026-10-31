import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import {
  availableReadiness,
  resolveCrmModuleAccess,
  resolveMarketingModuleAccess,
} from '@/lib/platform/business-overview/access'
import { compareActionPriority, priorityFromDueDate, priorityFromSeoScore } from '@/lib/platform/business-overview/priority'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import type { PortalUser } from '@/lib/portal/authz'

function portalStub(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: 'user_1',
    role: 'CUSTOMER',
    membership: { role: 'OWNER', customerAccountId: 'acct_a', userId: 'user_1' } as PortalUser['membership'],
    customerAccount: { id: 'acct_a', businessName: 'A Co' } as PortalUser['customerAccount'],
    ...overrides,
  } as PortalUser
}

describe('Batch 27A business command center backend', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  it('exposes GET /api/v1/business/overview with session account scope', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/v1/business/overview/route.ts'), 'utf8')
    expect(route).toContain("requireCustomerMembership")
    expect(route).toContain('getBusinessOverview')
    expect(route).toContain('customerAccountId')
    expect(route).toContain('FORBIDDEN')
  })

  it('documents stable module readiness and action contract for v0', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md'),
      'utf8',
    )
    expect(doc).toContain('/api/v1/business/overview')
    expect(doc).toContain('readiness')
    expect(doc).toContain('disabled')
    expect(doc).toContain('session_membership')
    expect(doc).toContain('actionType')
  })

  it('reports CRM disabled without implying zero activity', () => {
    process.env.CRM_BACKEND_ENABLED = 'false'
    const readiness = resolveCrmModuleAccess({
      portal: portalStub(),
      evidence: { activeWebsiteSubscriptions: [], legacyWebsiteEvidence: [] },
      isStaff: false,
    })
    expect(readiness).toMatchObject({ state: 'disabled', reasonCode: 'CRM_DISABLED' })
  })

  it('reports marketing disabled when backend flag is off', () => {
    process.env.MKT_BACKEND_ENABLED = 'false'
    const readiness = resolveMarketingModuleAccess({
      portal: portalStub(),
      evidence: { activeWebsiteSubscriptions: [], legacyWebsiteEvidence: [] },
      isStaff: false,
    })
    expect(readiness).toMatchObject({ state: 'disabled', reasonCode: 'MKT_DISABLED' })
  })

  it('available readiness distinguishes empty from populated modules', () => {
    const empty = availableReadiness('2026-10-31T00:00:00.000Z', 0)
    expect(empty.state).toBe('available')
    expect(empty.empty).toBe(true)
    const populated = availableReadiness('2026-10-31T00:00:00.000Z', 3)
    expect(populated.empty).toBe(false)
    expect(populated.evidenceCount).toBe(3)
  })

  it('derives priority only from due dates and SEO scores', () => {
    const now = new Date('2026-10-31T12:00:00.000Z')
    expect(priorityFromDueDate(new Date('2026-10-30T12:00:00.000Z'), now)).toBe('high')
    expect(priorityFromDueDate(new Date('2026-11-05T12:00:00.000Z'), now)).toBe('medium')
    expect(priorityFromSeoScore(85)).toBe('high')
    expect(compareActionPriority('high', 'medium')).toBeLessThan(0)
  })

  it('uses Batch 16 locale-neutral customer destinations', () => {
    expect(BUSINESS_DESTINATIONS.crmTasks).toBe('/dashboard/crm/tasks')
    expect(BUSINESS_DESTINATIONS.marketingApprovals).toBe('/dashboard/marketing/approvals')
    expect(BUSINESS_DESTINATIONS.projectApprovals).toBe('/dashboard/approvals')
    expect(BUSINESS_DESTINATIONS.commsConversation('c1')).toBe('/dashboard/communications/conversations/c1')
  })

  it('denies billing-group sibling communications access (account isolation)', () => {
    const result = denyBillingGroupSiblingCommsAccess({
      actorUserId: 'user_1',
      operatingAccountId: 'acct_a',
      recordAccountId: 'acct_b',
      operatingMemberships: [{ userId: 'user_1', customerAccountId: 'acct_a' }],
      billingGroupSiblingAccounts: new Map([['bg_1', ['acct_a', 'acct_b']]]),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/Billing group does not grant sibling/i)
    }
  })

  it('scopes collectors to customerAccountId in service source', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform/business-overview/service.ts'), 'utf8')
    expect(source).toContain('customerAccountId: accountId')
    expect(source).toContain('listMergeProposals')
    expect(source).toContain('listMarketingReviews')
    expect(source).toContain('listAccountConversations')
    expect(source).not.toContain('.create(')
    expect(source).not.toContain('.update(')
  })
})
