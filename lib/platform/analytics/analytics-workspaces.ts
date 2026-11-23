import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'

export const ANALYTICS_WORKSPACES = {
  overview: '/dashboard/analytics',
  traffic: '/dashboard/analytics?tab=traffic',
  search: '/dashboard/analytics?tab=search',
  local: '/dashboard/analytics?tab=local',
  conversions: '/dashboard/analytics?tab=conversions',
} as const

export function analyticsAccountApiPath(customerAccountId: string, suffix: string): string {
  return `/api/v1/analytics/accounts/${encodeURIComponent(customerAccountId)}/${suffix}`
}