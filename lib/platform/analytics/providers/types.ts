import type { ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'
import type { AnalyticsProviderKey } from '@/lib/platform/analytics/types'

export type AnalyticsProviderConnectionState = {
  provider: AnalyticsProviderKey
  status: 'NOT_CONNECTED' | 'PENDING' | 'READY' | 'NOT_SUPPORTED'
  propertyRef?: string
  message?: string
}

export type AnalyticsSourceProvider = {
  key: AnalyticsProviderKey
  displayName: string
  describeConnection(context: ProviderAuthContext): Promise<ProviderResult<AnalyticsProviderConnectionState>>
}
