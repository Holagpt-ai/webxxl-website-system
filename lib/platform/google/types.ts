import type { SeoAnalyticsProvider } from '@prisma/client'

export const GOOGLE_ANALYTICS_PROVIDERS = ['GSC', 'GA4', 'GBP'] as const satisfies readonly SeoAnalyticsProvider[]

export type GoogleAnalyticsProviderKey = (typeof GOOGLE_ANALYTICS_PROVIDERS)[number]

export type GoogleCredentialLifecycle = 'MISSING' | 'INCOMPLETE' | 'ACTIVE' | 'REVOKED'

export type GoogleProviderReadinessState =
  | 'NOT_CONNECTED'
  | 'BLOCKED'
  | 'PENDING_VERIFICATION'
  | 'READY_FOR_INGEST'
  | 'NOT_SUPPORTED'

export type GoogleProviderCapabilitiesSnapshot = {
  storedReadApis: boolean
  readinessAssess: boolean
  providerIngest: boolean
  liveProviderFetch: boolean
  liveOAuthActivation: boolean
}

export type StoredGoogleConnectionSnapshot = {
  id: string
  managedSiteId: string
  customerAccountId: string
  provider: GoogleAnalyticsProviderKey
  propertyRef: string
  propertyKind: string
  verificationState: string
  dataState: string
  lastVerifiedAt: Date | null
  revokedAt: Date | null
  secretRef: string | null
  updatedAt: Date
}

export type GoogleProviderReadinessRow = {
  provider: GoogleAnalyticsProviderKey
  connection: {
    id: string | null
    propertyRef: string | null
    propertyKind: string | null
    verificationState: string | null
    dataState: string | null
    lastVerifiedAt: string | null
    revokedAt: string | null
    secretRefConfigured: boolean
  } | null
  platformFlags: {
    apiEnabled: boolean
    oauthEnabled: boolean
    readinessModuleEnabled: boolean
  }
  readinessState: GoogleProviderReadinessState
  ownershipVerified: boolean
  siteMappingOk: boolean
  credentialLifecycle: GoogleCredentialLifecycle
  capabilities: GoogleProviderCapabilitiesSnapshot
  limitations: string[]
  assessedAt: string
  provenance: 'STORED_CONNECTION'
  freshness: {
    connectionUpdatedAt: string | null
    lastVerifiedAt: string | null
  }
}

export type GoogleSiteReadinessDto = {
  managedSiteId: string
  customerAccountId: string
  providers: GoogleProviderReadinessRow[]
  assessedAt: string
}

export type GoogleAccountReadinessDto = {
  customerAccountId: string
  managedSiteId: string | null
  sites: GoogleSiteReadinessDto[]
  assessedAt: string
}

export type GoogleReadinessOperationOutcome = {
  provider: GoogleAnalyticsProviderKey
  readinessState: GoogleProviderReadinessState
  syncRunStatus: 'READINESS_RECORDED'
  idempotencyKey: string
  reason: string
  externalFetchAttempted: false
}
