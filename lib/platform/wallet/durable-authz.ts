import type { BillingGroupRoleKind } from '@/lib/platform/wallet/types'
import type { WalletMutationOperation, WalletMutationPrincipal } from '@/lib/platform/wallet/mutation-principal'
import { assertServicePrincipalForOperation } from '@/lib/platform/wallet/mutation-principal'
import { ledgerActorAttributionFromPrincipal } from '@/lib/platform/wallet/ledger-actor-attribution'
import type { LedgerActorAttribution } from '@/lib/platform/wallet/ledger-actor-attribution'
import { isEffectiveFundingMembership, type FundingMembership } from '@/lib/platform/billing-authz'
import type { PrismaClient } from '@prisma/client'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

const PRIVILEGED_ROLES: BillingGroupRoleKind[] = ['GROUP_OWNER', 'BILLING_ADMIN']

export async function assertBillingGroupActive(tx: Tx, billingGroupId: string): Promise<boolean> {
  const group = await tx.billingGroup.findUnique({ where: { id: billingGroupId }, select: { status: true } })
  return group?.status === 'ACTIVE'
}

export async function assertFundingMembershipActive(
  tx: Tx,
  billingGroupId: string,
  customerAccountId: string,
  at: Date,
): Promise<boolean> {
  const rows = await tx.billingGroupMembership.findMany({ where: { billingGroupId, customerAccountId } })
  const funding: FundingMembership[] = rows.map((item) => ({
    billingGroupId: item.billingGroupId,
    customerAccountId: item.customerAccountId,
    status: item.status,
    validFrom: item.validFrom,
    validTo: item.validTo,
    walletUseAllowed: item.walletUseAllowed,
  }))
  return funding.some(
    (item) =>
      item.customerAccountId === customerAccountId &&
      item.billingGroupId === billingGroupId &&
      isEffectiveFundingMembership(item, at),
  )
}

async function userHasBillingRole(
  tx: Tx,
  userId: string,
  billingGroupId: string,
  roles: BillingGroupRoleKind[],
): Promise<boolean> {
  const role = await tx.billingGroupRole.findUnique({
    where: { billingGroupId_userId: { billingGroupId, userId } },
  })
  return Boolean(role && roles.includes(role.role))
}

async function userHasOperatingMembership(tx: Tx, userId: string, customerAccountId: string): Promise<boolean> {
  const membership = await tx.customerMembership.findFirst({
    where: { userId, customerAccountId },
  })
  return Boolean(membership)
}

export async function assertWalletMutationAuthorized(
  tx: Tx,
  input: {
    principal: WalletMutationPrincipal
    operation: WalletMutationOperation
    billingGroupId: string
    customerAccountId?: string
    at: Date
  },
): Promise<
  | ({ ok: true } & LedgerActorAttribution)
  | { ok: false; error: import('@/lib/platform/wallet/types').WalletDenial }
> {
  const groupActive = await assertBillingGroupActive(tx, input.billingGroupId)
  if (!groupActive) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }

  if (input.principal.kind === 'SERVICE') {
    const serviceCheck = assertServicePrincipalForOperation(input.principal, input.operation)
    if (!serviceCheck.ok) return serviceCheck
    return { ok: true, ...ledgerActorAttributionFromPrincipal(input.principal) }
  }

  const userId = input.principal.userId
  switch (input.operation) {
    case 'RESERVE': {
      if (!input.customerAccountId) return { ok: false, error: 'UNAUTHORIZED_SPEND' }
      const funded = await assertFundingMembershipActive(tx, input.billingGroupId, input.customerAccountId, input.at)
      if (!funded) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }
      const operating = await userHasOperatingMembership(tx, userId, input.customerAccountId)
      if (!operating) return { ok: false, error: 'UNAUTHORIZED_SPEND' }
      return { ok: true, actorUserId: userId, actorServiceId: null }
    }
    case 'SETTLE':
    case 'RELEASE':
    case 'REFUND':
    case 'RECONCILE':
    case 'FUND': {
      const privileged = await userHasBillingRole(tx, userId, input.billingGroupId, PRIVILEGED_ROLES)
      if (!privileged) return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
      return { ok: true, actorUserId: userId, actorServiceId: null }
    }
    case 'EXPIRE': {
      const viewer = await userHasBillingRole(tx, userId, input.billingGroupId, [
        ...PRIVILEGED_ROLES,
        'BILLING_VIEWER',
      ])
      if (!viewer) return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
      return { ok: true, actorUserId: userId, actorServiceId: null }
    }
    default:
      return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
}
