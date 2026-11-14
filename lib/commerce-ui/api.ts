export const COMMERCE_API = {
  catalog: '/api/v1/commerce/catalog',
  quotes: '/api/v1/commerce/quotes',
  orders: '/api/v1/commerce/orders',
  order: (id: string) => `/api/v1/commerce/orders/${encodeURIComponent(id)}`,
  orderCheckout: (id: string) => `/api/v1/commerce/orders/${encodeURIComponent(id)}/checkout`,
  accountOrders: (accountId: string) => `/api/v1/commerce/accounts/${encodeURIComponent(accountId)}/orders`,
  billingGroupSummary: (groupId: string) => `/api/v1/commerce/billing-groups/${encodeURIComponent(groupId)}/summary`,
  billingGroupWallet: (groupId: string) => `/api/v1/commerce/billing-groups/${encodeURIComponent(groupId)}/wallet-summary`,
  billingGroupOrders: (groupId: string) => `/api/v1/commerce/billing-groups/${encodeURIComponent(groupId)}/orders`,
  walletLedger: (groupId: string) => `/api/v1/billing-groups/${encodeURIComponent(groupId)}/ledger`,
} as const