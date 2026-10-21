import { customerAiDefaultEntitlementKey } from '@/config/customer-ai-workforce'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'

export async function hasActiveAiEmployeeEntitlement(
  store: CustomerAiStore,
  customerAccountId: string,
  entitlementKey: string = customerAiDefaultEntitlementKey(),
): Promise<boolean> {
  const services = await store.listActiveCustomerServices(customerAccountId)
  return services.some((s) => s.serviceKey === entitlementKey && s.status === 'ACTIVE')
}
