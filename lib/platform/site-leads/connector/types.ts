/** Public intake JSON — must match `SiteLeadIntakeBody` / Batch 28A contract. */
export type SiteLeadConnectorPayload = {
  contactEmail: string
  contactName?: string
  contactPhone?: string
  message?: string
  formReference?: string
  locale?: string
  submittedAt?: string
  fields?: Record<string, unknown>
  analyticsProvenance?: { eventId?: string; captureSessionId?: string }
}

export type SiteLeadConnectorConfig = {
  /** Absolute base URL of the WebXXL app (no trailing slash), e.g. `https://app.example.com`. */
  intakeBaseUrl: string
  /** `ManagedSiteLeadIntakeCredential.publicKeyId` — identifies the site credential, not the tenant. */
  publicKeyId: string
  /** HMAC signing secret — server-side only; never expose to browsers or public config. */
  signingSecret: string
  timeoutMs?: number
  /** Safe retries for transient failures only (default 2). */
  maxRetries?: number
}

export type SiteLeadConnectorSuccess = {
  ok: true
  leadId: string
  status: string
  duplicate: boolean
  httpStatus: number
}

export type SiteLeadConnectorFailureCode =
  | 'CONFIG'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'DISABLED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'ERROR'

export type SiteLeadConnectorFailure = {
  ok: false
  code: SiteLeadConnectorFailureCode
  message: string
  httpStatus?: number
}

export type SiteLeadConnectorResult = SiteLeadConnectorSuccess | SiteLeadConnectorFailure
