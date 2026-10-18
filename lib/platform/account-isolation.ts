import { canAccessProject } from '@/lib/portal/access-rules'
import { billingRoleGrantsCrmAccess } from '@/lib/platform/billing-authz'

export type IsolatedRecord = {
  customerAccountId: string
}

export function canReadAccountScopedRecord(
  authorizedAccountIds: ReadonlySet<string>,
  targetAccountId: string,
): boolean {
  return authorizedAccountIds.has(targetAccountId)
}

export function filterAccountScopedRecords<T extends IsolatedRecord>(
  authorizedAccountIds: ReadonlySet<string>,
  records: T[],
): T[] {
  return records.filter((record) => authorizedAccountIds.has(record.customerAccountId))
}

export function canAccessSiblingCrmThroughBillingGroup(): boolean {
  return billingRoleGrantsCrmAccess()
}

export function canAccessExistingProject(customerAccountId: string, projectCustomerAccountId: string): boolean {
  return canAccessProject(customerAccountId, projectCustomerAccountId)
}

export function assertNoCrossAccountMerge(leftAccountId: string, rightAccountId: string): boolean {
  return leftAccountId === rightAccountId
}
