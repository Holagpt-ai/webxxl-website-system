export type WalletPermission =
  | 'wallet.balance.read'
  | 'wallet.usage.read'
  | 'wallet.quote.prepare'
  | 'wallet.reservation.prepare'
  | 'wallet.ledger.read'
  | 'wallet.refund.approve'
  | 'wallet.group.manage'
  | 'wallet.admin'

export type WalletRoleContext = {
  billingGroupRole?: 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER' | null
  isTrustedService?: boolean
}

const ROLE_MATRIX: Record<NonNullable<WalletRoleContext['billingGroupRole']>, WalletPermission[]> = {
  GROUP_OWNER: [
    'wallet.balance.read',
    'wallet.usage.read',
    'wallet.quote.prepare',
    'wallet.reservation.prepare',
    'wallet.ledger.read',
    'wallet.refund.approve',
    'wallet.group.manage',
    'wallet.admin',
  ],
  BILLING_ADMIN: [
    'wallet.balance.read',
    'wallet.usage.read',
    'wallet.quote.prepare',
    'wallet.reservation.prepare',
    'wallet.ledger.read',
    'wallet.refund.approve',
    'wallet.group.manage',
  ],
  BILLING_VIEWER: ['wallet.balance.read', 'wallet.usage.read', 'wallet.ledger.read'],
}

export function assertWalletPermission(context: WalletRoleContext, permission: WalletPermission): void {
  if (context.isTrustedService) return
  const role = context.billingGroupRole
  if (!role) throw new Error('FORBIDDEN')
  if (!ROLE_MATRIX[role].includes(permission)) throw new Error('FORBIDDEN')
}
