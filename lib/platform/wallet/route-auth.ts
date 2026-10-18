import { isWalletBackendEnabled, isWalletGroupReadEnabled } from '@/config/wallet-backend'
import { prisma } from '@/lib/db'
import { canAccessOperatingAccount, canViewGroupWallet } from '@/lib/platform/billing-authz'
import { assertWalletPermission, type WalletPermission } from '@/lib/platform/wallet/permissions'
import { WalletApiError } from '@/lib/platform/wallet/wallet-api-error'
import { requireCustomerMembership } from '@/lib/portal/authz'

export { WalletApiError }

export async function requireWalletApiActor(requiredPermission: WalletPermission = 'wallet.balance.read') {
  if (!isWalletBackendEnabled()) {
    throw new WalletApiError(503, 'Wallet backend is disabled', 'WALLET_DISABLED')
  }
  const portal = await requireCustomerMembership()
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    requiredPermission,
  }
}

export async function requireBillingGroupWalletAccess(billingGroupId: string, permission: WalletPermission) {
  const base = await requireWalletApiActor(permission)
  if (!isWalletGroupReadEnabled() && permission !== 'wallet.admin') {
    throw new WalletApiError(503, 'Wallet group read API is disabled', 'WALLET_READ_DISABLED')
  }

  const role = await prisma.billingGroupRole.findUnique({
    where: { billingGroupId_userId: { billingGroupId, userId: base.userId } },
  })
  if (!role) {
    const operating = await prisma.customerMembership.findFirst({
      where: { userId: base.userId, customerAccountId: base.customerAccountId },
    })
    if (!operating) throw new WalletApiError(403, 'Not authorized for billing group wallet', 'FORBIDDEN')
    if (permission !== 'wallet.usage.read') {
      throw new WalletApiError(403, 'Operating account members may only read attributed usage', 'FORBIDDEN')
    }
    const funded = await prisma.billingGroupMembership.findFirst({
      where: {
        billingGroupId,
        customerAccountId: base.customerAccountId,
        status: 'ACTIVE',
        walletUseAllowed: true,
      },
    })
    if (!funded) throw new WalletApiError(403, 'Account not funded by billing group', 'FORBIDDEN')
    return { ...base, billingGroupId, scopedAccountId: base.customerAccountId }
  }

  assertWalletPermission({ billingGroupRole: role.role }, permission)
  if (!canViewGroupWallet([{ userId: base.userId, billingGroupId, role: role.role }], base.userId, billingGroupId)) {
    throw new WalletApiError(403, 'Insufficient billing group wallet permission', 'FORBIDDEN')
  }
  return { ...base, billingGroupId, billingGroupRole: role.role, scopedAccountId: null as string | null }
}

export async function assertOperatingAccountAccess(userId: string, customerAccountId: string) {
  const memberships = await prisma.customerMembership.findMany({ where: { userId } })
  if (!canAccessOperatingAccount(memberships, userId, customerAccountId)) {
    throw new WalletApiError(403, 'Operating account access denied', 'FORBIDDEN')
  }
}
