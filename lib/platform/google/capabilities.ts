import {
  isAnalyticsIngestionEnabled,
  isAnalyticsProviderFetchEnabled,
} from '@/config/analytics-backend'
import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import {
  isSeoGa4ApiEnabled,
  isSeoGbpApiEnabled,
  isSeoGoogleOauthEnabled,
  isSeoGscApiEnabled,
} from '@/config/seo-backend'
import { isWorkflowExternalEffectsEnabled } from '@/config/workflow-backend'
import type { GoogleAnalyticsProviderKey, GoogleProviderCapabilitiesSnapshot } from '@/lib/platform/google/types'

function providerApiEnabled(provider: GoogleAnalyticsProviderKey): boolean {
  switch (provider) {
    case 'GSC':
      return isSeoGscApiEnabled()
    case 'GA4':
      return isSeoGa4ApiEnabled()
    case 'GBP':
      return isSeoGbpApiEnabled()
    default:
      return false
  }
}

export function googleProviderPlatformFlags(provider: GoogleAnalyticsProviderKey): {
  apiEnabled: boolean
  oauthEnabled: boolean
  readinessModuleEnabled: boolean
} {
  return {
    apiEnabled: providerApiEnabled(provider),
    oauthEnabled: isSeoGoogleOauthEnabled(),
    readinessModuleEnabled: isGoogleProviderReadinessEnabled(),
  }
}

export function buildGoogleProviderCapabilities(provider: GoogleAnalyticsProviderKey): GoogleProviderCapabilitiesSnapshot {
  const flags = googleProviderPlatformFlags(provider)
  const ingestBase = isAnalyticsIngestionEnabled() && flags.apiEnabled && flags.oauthEnabled
  const liveFetch =
    ingestBase &&
    isAnalyticsProviderFetchEnabled() &&
    isWorkflowExternalEffectsEnabled() &&
    provider === 'GSC'

  return {
    storedReadApis: true,
    readinessAssess: flags.readinessModuleEnabled,
    providerIngest: provider === 'GSC' ? ingestBase : false,
    liveProviderFetch: liveFetch,
    liveOAuthActivation: false,
  }
}

export function googleProviderIngestSupported(provider: GoogleAnalyticsProviderKey): boolean {
  return provider === 'GSC' && buildGoogleProviderCapabilities(provider).providerIngest
}
