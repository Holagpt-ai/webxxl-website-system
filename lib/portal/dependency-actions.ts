/** Customer dashboard destinations for open dependencies (tenant-neutral). */
export const DEPENDENCY_CUSTOMER_ACTION_KEYS = [
  'PROJECT',
  'FILES',
  'APPROVALS',
  'MESSAGES',
  'REQUESTS',
  'WEBSITE_REVIEW',
] as const

export type DependencyCustomerActionKey = (typeof DEPENDENCY_CUSTOMER_ACTION_KEYS)[number]

export function parseDependencyCustomerActionKey(value: unknown): DependencyCustomerActionKey | null {
  if (typeof value !== 'string') return null
  return DEPENDENCY_CUSTOMER_ACTION_KEYS.includes(value as DependencyCustomerActionKey)
    ? (value as DependencyCustomerActionKey)
    : null
}

export function dependencyActionHref(key: DependencyCustomerActionKey | null | undefined, localePrefix: string): string | null {
  if (!key) return null
  const base = localePrefix || ''
  switch (key) {
    case 'PROJECT':
      return `${base}/dashboard/project`
    case 'FILES':
      return `${base}/dashboard/files`
    case 'APPROVALS':
      return `${base}/dashboard/approvals`
    case 'MESSAGES':
      return `${base}/dashboard/messages`
    case 'REQUESTS':
      return `${base}/dashboard/requests`
    case 'WEBSITE_REVIEW':
      return `${base}/dashboard/project`
    default:
      return null
  }
}
