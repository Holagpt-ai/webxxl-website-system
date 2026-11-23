import { afterEach, describe, expect, it, vi } from 'vitest'
import { MembershipRole } from '@prisma/client'
import { assertCrmPermission } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { parseCrmCustomFields } from '@/lib/platform/crm/custom-fields'
import { parseSuppressionLiftInput } from '@/lib/platform/crm/crm-consent-input'
import { importMustNotLiftSuppression } from '@/lib/platform/crm/consent-service'
import { denyBillingGroupSiblingCrmAccess } from '@/lib/platform/crm/account-isolation'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_GROUP_ID } from '@/lib/platform/fixtures/abmed'

describe('CRM-10A company, custom fields, suppression lift', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('accepts scalar custom fields and rejects nested objects', () => {
    expect(parseCrmCustomFields({ industryNote: 'clinic', employeeCount: 12, vip: true }).ok).toBe(true)
    expect(parseCrmCustomFields(null).ok).toBe(true)
    const nested = parseCrmCustomFields({ meta: { nested: true } })
    expect(nested.ok).toBe(false)
    if (!nested.ok) expect(nested.code).toBe('VALIDATION_ERROR')
    expect(parseCrmCustomFields(['a']).ok).toBe(false)
    expect(parseCrmCustomFields({ '1bad': 'x' }).ok).toBe(false)
  })

  it('requires suppression lift reason and forbids import sources at parse/policy layer', () => {
    expect(parseSuppressionLiftInput({ channel: 'EMAIL', purpose: 'MARKETING', source: 'staff.portal' }).ok).toBe(false)
    expect(
      parseSuppressionLiftInput({
        channel: 'EMAIL',
        purpose: 'MARKETING',
        reason: 'Customer requested resubscribe review',
        source: 'staff.portal',
      }).ok,
    ).toBe(true)
    expect(importMustNotLiftSuppression().ok).toBe(true)
  })

  it('MEMBER cannot lift suppression; OWNER can', () => {
    expect(() =>
      assertCrmPermission({ membershipRole: MembershipRole.MEMBER, isStaff: false }, 'crm.consent.manage'),
    ).toThrow(CrmApiError)
    expect(() =>
      assertCrmPermission({ membershipRole: MembershipRole.OWNER, isStaff: false }, 'crm.consent.manage'),
    ).not.toThrow()
  })

  it('billing group does not authorize sibling company records', () => {
    const denied = denyBillingGroupSiblingCrmAccess({
      actorUserId: 'u1',
      targetAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('BILLING_GROUP_NOT_AUTHORIZATION')
  })

  it('company detail is account-scoped and omits sibling records', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmCompany: {
          findFirst: async (args: { where: { id: string; customerAccountId: string } }) => {
            if (args.where.customerAccountId !== 'acct_a') return null
            return {
              id: 'co_1',
              customerAccountId: 'acct_a',
              managedSiteId: null,
              name: 'Clinic A',
              websiteDomain: 'a.example',
              industry: 'health',
              phone: null,
              email: null,
              ownerUserId: null,
              customFields: { region: 'PR' },
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              contactLinks: [],
              deals: [],
            }
          },
        },
      },
    }))
    const { getCrmCompanyForAccount } = await import('@/lib/platform/crm/company-service')
    const owned = await getCrmCompanyForAccount('co_1', 'acct_a')
    expect(owned.ok).toBe(true)
    const denied = await getCrmCompanyForAccount('co_1', 'acct_b')
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('NOT_FOUND')
  })

  it('refuses to link a contact from another account', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmCompany: {
          findFirst: async () => ({ id: 'co_1' }),
        },
        crmContact: {
          findFirst: async () => null,
        },
      },
    }))
    const { linkContactToCompany } = await import('@/lib/platform/crm/company-service')
    const denied = await linkContactToCompany({
      customerAccountId: 'acct_a',
      companyId: 'co_1',
      contactId: 'c_other',
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('NOT_FOUND')
  })

  it('lifts active suppression without writing consent', async () => {
    const updateMock = vi.fn(async () => ({ id: 'sup_1' }))
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
        contactSuppression: {
          findUnique: async () => null,
          findFirst: async () => ({
            id: 'sup_1',
            customerAccountId: 'acct_a',
            contactId: 'c1',
            channel: 'EMAIL',
            purpose: 'MARKETING',
            active: true,
          }),
          update: updateMock,
        },
        contactConsent: {
          create: vi.fn(),
        },
      },
    }))
    const { liftContactSuppression } = await import('@/lib/platform/crm/consent-service')
    const lifted = await liftContactSuppression({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      actorUserId: 'user_owner',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      reason: 'Verified written resubscribe request',
      source: 'staff.portal',
      idempotencyKey: 'lift-1',
    })
    expect(lifted.ok).toBe(true)
    if (lifted.ok) {
      expect(lifted.value.consentUnchanged).toBe(true)
      expect(lifted.value.alreadyLifted).toBe(false)
    }
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sup_1' },
        data: expect.objectContaining({
          active: false,
          liftReason: 'Verified written resubscribe request',
          liftedByUserId: 'user_owner',
        }),
      }),
    )
  })

  it('rejects import-sourced suppression lift', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
      },
    }))
    const { liftContactSuppression } = await import('@/lib/platform/crm/consent-service')
    const denied = await liftContactSuppression({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      actorUserId: 'user_owner',
      channel: 'EMAIL',
      purpose: 'MARKETING',
      reason: 'csv',
      source: 'import.csv',
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN')
  })

  it('replays lift idempotency without a second update', async () => {
    const updateMock = vi.fn()
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', managedSiteId: null, status: 'ACTIVE' }),
        },
        contactSuppression: {
          findUnique: async () => ({
            id: 'sup_1',
            customerAccountId: 'acct_a',
            contactId: 'c1',
            active: false,
          }),
          update: updateMock,
        },
      },
    }))
    const { liftContactSuppression } = await import('@/lib/platform/crm/consent-service')
    const replay = await liftContactSuppression({
      customerAccountId: 'acct_a',
      contactId: 'c1',
      actorUserId: 'user_owner',
      reason: 'Verified written resubscribe request',
      source: 'staff.portal',
      idempotencyKey: 'lift-1',
    })
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.value.alreadyLifted).toBe(true)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('writes contact customFields only when provided', async () => {
    const updateMock = vi.fn()
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContact: {
          findFirst: async () => ({ id: 'c1', customerAccountId: 'acct_a', status: 'ACTIVE' }),
          update: updateMock,
        },
      },
    }))
    const { updateCrmContact } = await import('@/lib/platform/crm/contact-service')
    const ok = await updateCrmContact('c1', 'acct_a', { customFields: { preferredLanguage: 'es' } })
    expect(ok.ok).toBe(true)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customFields: { preferredLanguage: 'es' } }),
      }),
    )
  })
})
