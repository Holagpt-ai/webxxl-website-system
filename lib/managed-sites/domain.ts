export function customerOwnsManagedSite(customerAccountId: string, siteCustomerAccountId: string): boolean {
  return customerAccountId === siteCustomerAccountId
}

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, '').split('/')[0]?.split('?')[0]?.split('#')[0] ?? ''
  const host = withoutProtocol.replace(/\.$/, '').replace(/^www\./, '')
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) return null
  return host
}

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const EXECUTION_MODES = new Set(['SELF_SERVICE', 'AI_ASSISTED', 'HUMAN_REQUIRED', 'READ_ONLY'])

export function parseExecutionMode(value: unknown): 'SELF_SERVICE' | 'AI_ASSISTED' | 'HUMAN_REQUIRED' | 'READ_ONLY' | null {
  return typeof value === 'string' && EXECUTION_MODES.has(value)
    ? (value as 'SELF_SERVICE' | 'AI_ASSISTED' | 'HUMAN_REQUIRED' | 'READ_ONLY')
    : null
}

export const ADAPTER_KEYS = ['manual', 'abmed', 'webxxl-native', 'wordpress', 'custom-api'] as const
export type AdapterKey = (typeof ADAPTER_KEYS)[number]

export function parseAdapterKey(value: unknown): AdapterKey | null {
  return typeof value === 'string' && (ADAPTER_KEYS as readonly string[]).includes(value) ? (value as AdapterKey) : null
}

export const SITE_STATUSES = ['ACTIVE', 'SETUP', 'DISCONNECTED', 'PAUSED'] as const
export const SITE_PLATFORMS = ['NEXTJS', 'WORDPRESS', 'CUSTOM', 'OTHER'] as const
export const CONNECTION_TYPES = ['WEBXXL_NATIVE', 'API', 'EXTERNAL_ADMIN', 'MANUAL'] as const

export function parseEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
}
