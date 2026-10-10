import { getPortalModuleRegistry } from '@/lib/portal/modules'

/** Entitlement keys that may be stored on CustomerService — sourced from the module registry. */
export function getRegistryEntitlementServiceKeys(): Set<string> {
  return new Set(
    getPortalModuleRegistry()
      .map((m) => m.entitlementRequired)
      .filter((key): key is string => Boolean(key)),
  )
}

export function isRegistryEntitlementServiceKey(serviceKey: string): boolean {
  return getRegistryEntitlementServiceKeys().has(serviceKey)
}
