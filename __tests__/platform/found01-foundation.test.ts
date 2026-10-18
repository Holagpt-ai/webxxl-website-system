import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isEnabled } from '@/config/features'
import { getMarketplaceCatalog, getMarketplaceService } from '@/lib/marketplace/catalog'
import {
  canAccessExistingProject,
  canAccessSiblingCrmThroughBillingGroup,
  canReadAccountScopedRecord,
  filterAccountScopedRecords,
} from '@/lib/platform/account-isolation'
import { evaluateAiToolInvocation } from '@/lib/platform/ai-tools/policy'
import {
  canAccessBillingGroup,
  canAccessOperatingAccount,
  canManageGroupWallet,
  operatingMembershipGrantsGroupWalletAccess,
} from '@/lib/platform/billing-authz'
import {
  evaluateEntitlementAccess,
  existingMarketplacePricesUnchanged,
  getServiceEntitlement,
  listIncludedFreeEntitlements,
  listPaidEntitlements,
} from '@/lib/platform/entitlements'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_USAGE_OPERATOR_ID,
  BILLING_OWNER_USER_ID,
  CLINICAL_ONLY_USER_ID,
  EXISTING_ABMED_ACCOUNT_ID,
  EXISTING_ABMED_PROJECT_ID,
  SYNTHETIC_ABMED_USAGE,
  createSyntheticAbmedFoundation,
} from '@/lib/platform/fixtures/abmed'
import { PLATFORM_MODULE_CONTRACTS } from '@/lib/platform/module-contracts'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'
import { createWalletContractService, listHistoricalCharges, seedWalletTopUp, unlinkAccountFromGroup } from '@/lib/platform/wallet/service'
import { canAccessProject } from '@/lib/portal/access-rules'

function spendCredits(
  wallet: ReturnType<typeof createWalletContractService>,
  accountId: string,
  amount: number,
  key: string,
) {
  const reserved = wallet.reserve({
    actorUserId: ABMED_USAGE_OPERATOR_ID,
    billingGroupId: ABMED_GROUP_ID,
    customerAccountId: accountId,
    amount,
    correlationId: key,
    idempotencyKey: `reserve_${key}`,
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
  })
  expect(reserved.ok).toBe(true)
  if (!reserved.ok) return reserved
  return wallet.settle({
    actorUserId: BILLING_OWNER_USER_ID,
    reservationId: reserved.value.id,
    amount,
    idempotencyKey: `settle_${key}`,
  })
}

describe('FOUND-01 billing group and account isolation', () => {
  it('keeps three ABMED operating accounts independent under one authorized group', () => {
    const store = createSyntheticAbmedFoundation()
    expect(store.accounts.get(ABMED_AESTHETICS_ACCOUNT_ID)?.businessName).toBe('ABMED Aesthetics')
    expect(store.accounts.get(ABMED_PHYSICIANS_ACCOUNT_ID)?.businessName).toBe('ABMED Physicians Group')
    expect(store.accounts.get(ABMED_CLINICAL_ACCOUNT_ID)?.businessName).toBe('ABMED Clinical Research')
    expect(store.groups.get(ABMED_GROUP_ID)?.slug).toBe('abmed-group')
    expect(store.memberships.filter((item) => item.status === 'ACTIVE')).toHaveLength(3)
    expect(store.roles[0]).toMatchObject({ userId: BILLING_OWNER_USER_ID, role: 'GROUP_OWNER' })
  })

  it('grants group billing permission without CRM access, and isolates a single-business user', () => {
    const store = createSyntheticAbmedFoundation()
    expect(canManageGroupWallet(store.roles, BILLING_OWNER_USER_ID, ABMED_GROUP_ID)).toBe(true)
    expect(canAccessOperatingAccount(store.operatingMemberships, BILLING_OWNER_USER_ID, ABMED_AESTHETICS_ACCOUNT_ID)).toBe(false)
    expect(canAccessSiblingCrmThroughBillingGroup()).toBe(false)
    expect(canAccessOperatingAccount(store.operatingMemberships, CLINICAL_ONLY_USER_ID, ABMED_CLINICAL_ACCOUNT_ID)).toBe(true)
    expect(canAccessOperatingAccount(store.operatingMemberships, CLINICAL_ONLY_USER_ID, ABMED_AESTHETICS_ACCOUNT_ID)).toBe(false)
    expect(canAccessBillingGroup(store.roles, CLINICAL_ONLY_USER_ID, ABMED_GROUP_ID)).toBe(false)
    expect(operatingMembershipGrantsGroupWalletAccess()).toBe(false)
  })

  it('rejects cross-business CRM reads and unauthorized group wallet access', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    const authorized = new Set([ABMED_CLINICAL_ACCOUNT_ID])
    const contacts = [
      { customerAccountId: ABMED_CLINICAL_ACCOUNT_ID, name: 'Clinical contact' },
      { customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID, name: 'Aesthetics contact' },
    ]
    expect(canReadAccountScopedRecord(authorized, ABMED_AESTHETICS_ACCOUNT_ID)).toBe(false)
    expect(filterAccountScopedRecords(authorized, contacts)).toEqual([
      { customerAccountId: ABMED_CLINICAL_ACCOUNT_ID, name: 'Clinical contact' },
    ])
    expect(wallet.getBalance(CLINICAL_ONLY_USER_ID, ABMED_GROUP_ID)).toEqual({
      ok: false,
      error: 'UNAUTHORIZED_BALANCE',
    })
    expect(wallet.getBalance(BILLING_OWNER_USER_ID, 'group_other')).toEqual({
      ok: false,
      error: 'UNAUTHORIZED_BALANCE',
    })
  })

  it('resolves account-to-group funding and preserves history after unlink', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, SYNTHETIC_ABMED_USAGE.startingCredits, 'topup-unlink', BILLING_OWNER_USER_ID)
    spendCredits(wallet, ABMED_AESTHETICS_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.aesthetics, 'aesthetics-unlink')
    expect(wallet.canAccountUseWallet(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID)).toBe(true)
    unlinkAccountFromGroup(store, ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID, new Date('2026-10-18T00:00:00.000Z'))
    expect(wallet.canAccountUseWallet(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID)).toBe(false)
    expect(listHistoricalCharges(store, ABMED_GROUP_ID, ABMED_AESTHETICS_ACCOUNT_ID)).toHaveLength(1)
  })

  it('keeps managed sites and disabled agent identities independent', () => {
    const store = createSyntheticAbmedFoundation()
    expect(store.sites).toHaveLength(3)
    expect(new Set(store.sites.map((site) => site.customerAccountId)).size).toBe(3)
    expect(store.agentConfigs).toHaveLength(3)
    expect(store.agentConfigs.every((agent) => agent.enabled === false)).toBe(true)
    expect(new Set(store.agentConfigs.map((agent) => agent.managedSiteId)).size).toBe(3)
  })
})

describe('FOUND-01 shared wallet contracts', () => {
  it('applies the synthetic ABMED 1000 → 800 → 700 → 650 example', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, SYNTHETIC_ABMED_USAGE.startingCredits, 'topup-demo', BILLING_OWNER_USER_ID)
    const opening = wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)
    expect(opening.ok).toBe(true)
    if (opening.ok) expect(opening.value.availableBalance).toBe(1000)
    spendCredits(wallet, ABMED_AESTHETICS_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.aesthetics, 'aesthetics')
    expect(wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)).toMatchObject({
      ok: true,
      value: { availableBalance: 800 },
    })
    spendCredits(wallet, ABMED_PHYSICIANS_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.physicians, 'physicians')
    expect(wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)).toMatchObject({
      ok: true,
      value: { availableBalance: 700 },
    })
    spendCredits(wallet, ABMED_CLINICAL_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.clinical, 'clinical')
    const finalBalance = wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)
    expect(finalBalance).toMatchObject({ ok: true, value: { postedBalance: 650, availableBalance: 650 } })
    expect(wallet.accountUsage(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID)).toBe(200)
    expect(wallet.accountUsage(ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_GROUP_ID)).toBe(100)
    expect(wallet.accountUsage(ABMED_CLINICAL_ACCOUNT_ID, ABMED_GROUP_ID)).toBe(50)
  })

  it('reserves concurrently without negative availability and is idempotent', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 1000, 'topup-concurrent', BILLING_OWNER_USER_ID)
    const first = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 200,
      correlationId: 'c1',
      idempotencyKey: 'hold-a',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    const second = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      amount: 100,
      correlationId: 'c2',
      idempotencyKey: 'hold-b',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    const third = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      amount: 50,
      correlationId: 'c3',
      idempotencyKey: 'hold-c',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect([first, second, third].every((item) => item.ok)).toBe(true)
    expect(wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)).toMatchObject({
      ok: true,
      value: { availableBalance: 650, reservedBalance: 350, postedBalance: 1000 },
    })
    const replay = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 200,
      correlationId: 'c1',
      idempotencyKey: 'hold-a',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(replay.ok).toBe(true)
    expect(first.ok).toBe(true)
    if (replay.ok && first.ok) expect(replay.value.id).toBe(first.value.id)
    const overspend = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 700,
      correlationId: 'too-much',
      idempotencyKey: 'hold-over',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(overspend).toEqual({ ok: false, error: 'INSUFFICIENT_CREDITS' })
  })
})

describe('FOUND-01 entitlements and existing catalog prices', () => {
  it('classifies FREE core services and paid website/SMS/hosting offerings', () => {
    const freeKeys = listIncludedFreeEntitlements().map((item) => item.entitlementKey)
    expect(freeKeys).toEqual(
      expect.arrayContaining([
        'core.crm',
        'core.marketing-studio',
        'core.social-automation',
        'core.local-seo',
        'core.ai-landing-pages',
        'core.campaign-preparation',
        'core.ad-creative',
        'core.ai-marketing-agents',
      ]),
    )
    expect(listPaidEntitlements().map((item) => item.entitlementKey)).toEqual(
      expect.arrayContaining([
        'paid.website-subscription',
        'paid.sms-usage',
        'paid.hosting',
        'paid.domains',
        'paid.business-email',
        'future.ai-employee',
      ]),
    )
    expect(evaluateEntitlementAccess(getServiceEntitlement('core.crm')!).access).toBe('POLICY_UNRESOLVED')
    expect(evaluateEntitlementAccess(getServiceEntitlement('paid.sms-usage')!).classification).toBe('METERED_EXTERNAL')
    expect(isEnabled('purchasableAiEmployees')).toBe(false)
    expect(evaluateEntitlementAccess(getServiceEntitlement('future.ai-employee')!).access).toBe('DISABLED')
  })

  it('does not change existing marketplace quote presentation', () => {
    expect(existingMarketplacePricesUnchanged()).toBe(true)
    expect(getMarketplaceService('marketplace.seo-local')?.pricingPresentation.en).toBe('Monthly or project quote')
    expect(getMarketplaceService('marketplace.crm-automation')?.pricingPresentation.en).toBe('Custom quote')
    expect(getMarketplaceService('marketplace.marketing-ads')?.pricingPresentation.en).toBe('Quote per campaign')
    expect(getMarketplaceCatalog().map((item) => item.serviceKey)).toContain('marketplace.website-new-page')
  })
})

describe('FOUND-01 providers and AI tool authorization', () => {
  it('registers replaceable providers without installing specialist systems', () => {
    const registry = createDefaultProviderRegistry()
    expect(registry.requiredKindsPresent()).toBe(true)
    expect(registry.get('social', 'postiz')?.availability).toBe('NOT_ACTIVATED')
    expect(registry.get('workflow', 'webxxl-worker')?.availability).toBe('EXISTING_ADAPTER')
    expect(registry.get('crm', 'twenty')?.installed).toBe(false)
    expect(registry.get('conversation', 'chatwoot')?.installed).toBe(false)
    expect(registry.get('sms', 'twilio')?.installed).toBe(false)
    expect(registry.list().every((provider) => provider.replaceable)).toBe(true)
  })

  it('denies unauthorized and forbidden AI tool actions by default', () => {
    const deniedDb = evaluateAiToolInvocation(
      {
        actorId: 'agent-1',
        actorType: 'AGENT',
        customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
        toolKey: 'db.rawQuery',
        requestId: 'req-db',
        inputHash: 'hash-db',
      },
      [],
    )
    expect(deniedDb.decision).toBe('DENIED')
    const deniedSend = evaluateAiToolInvocation(
      {
        actorId: 'agent-1',
        actorType: 'AGENT',
        customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
        toolKey: 'messages.sendLive',
        requestId: 'req-send',
        inputHash: 'hash-send',
      },
      [
        {
          actorId: 'agent-1',
          actorType: 'AGENT',
          customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
          toolKey: 'messages.sendLive',
          approvalRequired: false,
        },
      ],
    )
    expect(deniedSend.decision).toBe('DENIED')
    const allowedRead = evaluateAiToolInvocation(
      {
        actorId: 'agent-1',
        actorType: 'AGENT',
        customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
        toolKey: 'projects.readMilestones',
        requestId: 'req-read',
        inputHash: 'hash-read',
      },
      [
        {
          actorId: 'agent-1',
          actorType: 'AGENT',
          customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
          toolKey: 'projects.readMilestones',
          approvalRequired: false,
        },
      ],
    )
    expect(allowedRead.decision).toBe('ALLOWED')
    const siblingDenied = evaluateAiToolInvocation(
      {
        actorId: 'agent-1',
        actorType: 'AGENT',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        toolKey: 'crm.contacts.search',
        requestId: 'req-sibling',
        inputHash: 'hash-sibling',
      },
      [
        {
          actorId: 'agent-1',
          actorType: 'AGENT',
          customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
          toolKey: 'crm.contacts.search',
          approvalRequired: false,
        },
      ],
    )
    expect(siblingDenied).toMatchObject({ decision: 'DENIED', denialReason: 'NO_GRANT' })
  })

  it('keeps existing project authorization and module contracts', () => {
    expect(canAccessExistingProject(EXISTING_ABMED_ACCOUNT_ID, EXISTING_ABMED_ACCOUNT_ID)).toBe(true)
    expect(canAccessExistingProject(EXISTING_ABMED_ACCOUNT_ID, ABMED_AESTHETICS_ACCOUNT_ID)).toBe(false)
    expect(canAccessProject(EXISTING_ABMED_ACCOUNT_ID, EXISTING_ABMED_PROJECT_ID)).toBe(false)
    expect(canAccessProject(EXISTING_ABMED_ACCOUNT_ID, EXISTING_ABMED_ACCOUNT_ID)).toBe(true)
    expect(PLATFORM_MODULE_CONTRACTS.find((item) => item.moduleKey === 'crm')?.includedOrPaid).toBe('INCLUDED_FREE')
    expect(PLATFORM_MODULE_CONTRACTS.find((item) => item.moduleKey === 'ai')?.availabilityStatus).toBe('DISABLED')
  })
})

describe('FOUND-01 Prisma schema and migration', () => {
  it('adds billing, wallet, provider, and tool models without removing existing entities', () => {
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20261017220000_found01_platform_identity/migration.sql'),
      'utf8',
    )
    for (const model of [
      'CustomerAccount',
      'CustomerMembership',
      'Project',
      'ManagedSite',
      'ServiceOrder',
      'CustomerService',
      'BillingGroup',
      'BillingGroupMembership',
      'BillingGroupRole',
      'BillingProfile',
      'SiteSpendingPolicy',
      'CreditWallet',
      'WalletLedgerEntry',
      'CreditReservation',
      'MessageUsage',
      'ProviderConnection',
      'AgentToolGrant',
    ]) {
      expect(schema).toContain(`model ${model}`)
    }
    expect(schema).toContain('enum BillingGroupRoleKind')
    expect(schema).toContain('billingGroupId')
    expect(migration).toContain('CREATE TABLE "BillingGroup"')
    expect(migration).toContain('ALTER TABLE "ServiceOrder" ADD COLUMN "billingGroupId"')
    expect(migration).not.toContain('DROP TABLE "CustomerAccount"')
    expect(migration).not.toContain('DROP TABLE "Project"')
    expect(migration).not.toContain('DROP TABLE "ServiceOrder"')
  })
})
