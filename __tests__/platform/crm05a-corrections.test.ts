import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MembershipRole } from '@prisma/client'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_GROUP_ID,
} from '@/lib/platform/fixtures/abmed'
import { denyBillingGroupSiblingCrmAccess } from '@/lib/platform/crm/account-isolation'
import { assertCrmPermission, resolveCrmPermissions } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { buildSynthetic200ContactSegmentFixture } from '@/lib/platform/crm/test-fixtures-200'
import { summarizeSegmentPopulation } from '@/lib/platform/crm/segment-engine'
import { createTwentyCrmProvider } from '@/lib/platform/providers/twenty-crm'
import { createWebxxlNativeCrmProvider } from '@/lib/platform/providers/webxxl-native-crm'
import { Prisma } from '@prisma/client'

describe('CRM-05A corrections', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('A: unresolved FREE eligibility is POLICY_UNRESOLVED (not INCLUDED)', () => {
    const entitlement = getServiceEntitlement('core.crm')
    expect(entitlement).toBeDefined()
    const access = evaluateEntitlementAccess(entitlement!)
    expect(access.access).toBe('POLICY_UNRESOLVED')
  })

  it('B/M: MEMBER lacks import/export; OWNER has elevated permissions', () => {
    const member = resolveCrmPermissions({ membershipRole: MembershipRole.MEMBER, isStaff: false })
    expect(member.has('crm.read')).toBe(true)
    expect(member.has('crm.import')).toBe(false)
    expect(() => assertCrmPermission({ membershipRole: MembershipRole.MEMBER, isStaff: false }, 'crm.import')).toThrow(
      CrmApiError,
    )
    const owner = resolveCrmPermissions({ membershipRole: MembershipRole.OWNER, isStaff: false })
    expect(owner.has('crm.export')).toBe(true)
  })

  it('C: billing group does not grant CRM access', () => {
    const denied = denyBillingGroupSiblingCrmAccess({
      actorUserId: 'u1',
      targetAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
    })
    expect(denied.ok).toBe(false)
  })

  it('D/E: consent and suppression idempotency reject cross-account payload', async () => {
    const hoisted = vi.hoisted(() => {
      const acctA = 'acct_abmed_aesthetics'
      const acctP = 'acct_abmed_physicians'
      return {
        acctA,
        acctP,
        consent: {
          id: 'consent_1',
          customerAccountId: acctA,
          contactId: 'contact_a',
          channel: 'EMAIL' as const,
          purpose: 'MARKETING' as const,
          status: 'GRANTED' as const,
        },
        contact: { id: 'contact_a', customerAccountId: acctA, managedSiteId: null, status: 'ACTIVE' as const },
        contactB: { id: 'contact_b', customerAccountId: acctP, managedSiteId: null, status: 'ACTIVE' as const },
      }
    })
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async ({ where }: { where: { id: string; customerAccountId: string } }) => {
            if (where.id === 'contact_b' && where.customerAccountId === hoisted.acctP) return hoisted.contactB
            if (where.id === 'contact_a' && where.customerAccountId === hoisted.acctA) return hoisted.contact
            return null
          },
        },
        contactConsent: {
          findUnique: async () => hoisted.consent,
          create: async () => {
            throw new Error('should not create')
          },
        },
        contactSuppression: {
          findUnique: async () => ({
            id: 'sup_1',
            customerAccountId: hoisted.acctP,
            contactId: 'contact_b',
            channel: 'EMAIL',
            purpose: 'MARKETING',
          }),
          create: async () => {
            throw new Error('should not create')
          },
        },
      },
    }))
    const { recordContactConsent, recordContactSuppression } = await import('@/lib/platform/crm/consent-service')
    const consentReplay = await recordContactConsent({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      contactId: 'contact_b',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      status: 'GRANTED',
      source: 'test',
      capturedAt: new Date(),
      idempotencyKey: 'idem-consent',
    })
    expect(consentReplay.ok).toBe(false)
    const suppressionReplay = await recordContactSuppression({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      contactId: 'contact_a',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      reason: 'opt-out',
      source: 'test',
      idempotencyKey: 'idem-sup',
    })
    expect(suppressionReplay.ok).toBe(false)
    if (!suppressionReplay.ok) expect(suppressionReplay.code).toBe('CONFLICT')
  })

  it('F/G: timeline rejects foreign contact and preserves first/last activity bounds', async () => {
    const contactState = {
      id: 'contact_a',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      firstActivityAt: new Date('2026-10-01T00:00:00Z'),
      lastActivityAt: new Date('2026-10-10T00:00:00Z'),
    }
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async ({ where }: { where: { id: string; customerAccountId: string } }) =>
            where.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID && where.id === 'contact_a'
              ? { ...contactState, managedSiteId: null, status: 'ACTIVE' }
              : null,
          findUnique: async () => contactState,
          update: async ({ data }: { data: { firstActivityAt: Date; lastActivityAt: Date } }) => {
            contactState.firstActivityAt = data.firstActivityAt
            contactState.lastActivityAt = data.lastActivityAt
            return contactState
          },
        },
        crmTimelineEvent: {
          findUnique: async () => null,
          create: async () => ({ id: 'evt_1' }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            crmTimelineEvent: { create: async () => ({ id: 'evt_1' }) },
            crmContact: {
              findUnique: async () => contactState,
              update: async ({ data }: { data: { firstActivityAt: Date; lastActivityAt: Date } }) => {
                contactState.firstActivityAt = data.firstActivityAt
                contactState.lastActivityAt = data.lastActivityAt
                return contactState
              },
            },
          }),
      },
    }))
    const { appendCrmTimelineEvent } = await import('@/lib/platform/crm/timeline-service')
    const foreign = await appendCrmTimelineEvent({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      contactId: 'contact_foreign',
      eventKind: 'NOTE',
      sourceSystem: 'test',
      idempotencyKey: 'tl-foreign',
      eventAt: new Date('2026-10-05T00:00:00Z'),
    })
    expect(foreign.ok).toBe(false)
    const older = await appendCrmTimelineEvent({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      contactId: 'contact_a',
      eventKind: 'NOTE',
      sourceSystem: 'test',
      idempotencyKey: 'tl-older',
      eventAt: new Date('2026-09-15T00:00:00Z'),
    })
    expect(older.ok).toBe(true)
    expect(contactState.firstActivityAt.toISOString()).toBe('2026-09-15T00:00:00.000Z')
    expect(contactState.lastActivityAt.toISOString()).toBe('2026-10-10T00:00:00.000Z')
  })

  it('I/J: import commit idempotency replay and conflict', async () => {
    const jobs = new Map<string, { id: string; customerAccountId: string; status: string; committedContactCount: number | null }>()
    jobs.set('job_a', {
      id: 'job_a',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      status: 'COMMITTED',
      committedContactCount: 3,
    })
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmImportJob: {
          findFirst: async ({ where }: { where: { commitIdempotencyKey?: string; id?: string; customerAccountId?: string } }) => {
            if (where.commitIdempotencyKey) {
              return [...jobs.values()].find((j) => j.id === 'job_a') ?? null
            }
            return jobs.get(where.id ?? '') ?? null
          },
        },
        crmDataAccessAudit: { create: async () => ({}) },
        $transaction: async () => {
          throw new Error('should not tx on replay')
        },
      },
    }))
    vi.doMock('@/config/crm-backend', () => ({ isCrmImportEnabled: () => true }))
    const { commitCrmImport } = await import('@/lib/platform/crm/import-export-service')
    const replay = await commitCrmImport({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobId: 'job_a',
      commitIdempotencyKey: 'commit-key',
      actorUserId: 'user_1',
    })
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.value.committed).toBe(3)
    const conflict = await commitCrmImport({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobId: 'job_b',
      commitIdempotencyKey: 'commit-key',
      actorUserId: 'user_1',
    })
    expect(conflict.ok).toBe(false)
  })

  it('N/O: unowned SalesLead cannot be claimed; cross-account idempotency rejected', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        salesLead: {
          findUnique: async () => ({
            id: 'lead_webxxl',
            customerAccountId: null,
            contactEmail: 'lead@example.com',
          }),
        },
        crmSalesLeadBridge: {
          findUnique: async () => ({
            id: 'bridge_1',
            customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
            salesLeadId: 'lead_other',
            status: 'CANDIDATE',
          }),
          upsert: async () => {
            throw new Error('should not upsert')
          },
        },
      },
    }))
    const { registerSalesLeadBridgeCandidate } = await import('@/lib/platform/crm/saleslead-bridge')
    const unowned = await registerSalesLeadBridgeCandidate({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      salesLeadId: 'lead_webxxl',
      idempotencyKey: 'bridge-key',
    })
    expect(unowned.ok).toBe(false)
    const replay = await registerSalesLeadBridgeCandidate({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      salesLeadId: 'lead_a',
      idempotencyKey: 'bridge-key',
    })
    expect(replay.ok).toBe(false)
  })

  it('P/Q/R: 200-contact fixture, provider contract, SalesLead models intact', () => {
    const fixture = buildSynthetic200ContactSegmentFixture(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(fixture).toHaveLength(200)
    expect(summarizeSegmentPopulation(fixture).totalContacts).toBe(200)
    expect(createWebxxlNativeCrmProvider().describeCapabilities().contacts).toBe(true)
    expect(createTwentyCrmProvider().availability).toBe('CANDIDATE')
    expect(Prisma.ModelName.SalesLead).toBe('SalesLead')
  })
})
