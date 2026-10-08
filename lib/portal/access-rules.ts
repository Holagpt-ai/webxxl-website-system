/** Pure access rules — unit-testable without database. */

export function canAccessProject(customerAccountId: string, projectCustomerAccountId: string): boolean {
  return customerAccountId === projectCustomerAccountId
}

export function filterCustomerComments<T extends { visibility: string }>(comments: T[]): T[] {
  return comments.filter((c) => c.visibility === 'CUSTOMER')
}

export function isModuleEnabledForServices(
  moduleKey: string,
  enabledKeys: Set<string>,
  entitlementRequired?: string | null,
): boolean {
  if (!enabledKeys.has(moduleKey)) return false
  if (!entitlementRequired) return true
  return enabledKeys.has(entitlementRequired)
}
