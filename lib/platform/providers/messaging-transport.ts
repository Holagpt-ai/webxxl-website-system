import type { ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'

export type TransportLifecycleStatus =
  | 'NOT_CONFIGURED'
  | 'BLOCKED'
  | 'PREPARED'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNKNOWN'

export type PreparedSmsMessage = {
  status: TransportLifecycleStatus
  fromRef: string
  to: string
  body: string
  segmentEstimate: number
  externalRequest?: Record<string, unknown>
  externalMessageRef?: string
  rateMetadata?: { rateVersion: string; creditsEstimate: number }
}

export type PreparedEmailMessage = {
  status: TransportLifecycleStatus
  from: string
  to: string[]
  subject: string
  domainRef: string
  externalRequest?: Record<string, unknown>
  externalMessageRef?: string
}

export type HttpJsonTransport = {
  postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; json: unknown }>
}

export type SmsPrepareInput = {
  messagingTenantRef: string
  senderRef: string
  to: string
  body: string
}

export type EmailPrepareInput = {
  verifiedDomainRef: string
  from: string
  to: string[]
  subject: string
  html: string
}

export type MessagingSmsAdapter = {
  describeStatus(context: ProviderAuthContext): Promise<ProviderResult<{ status: TransportLifecycleStatus }>>
  prepareSend(context: ProviderAuthContext, input: SmsPrepareInput): Promise<ProviderResult<PreparedSmsMessage>>
  mapProviderStatus(raw: string): TransportLifecycleStatus
}

export type MessagingEmailAdapter = {
  describeStatus(context: ProviderAuthContext): Promise<ProviderResult<{ status: TransportLifecycleStatus }>>
  prepareSend(context: ProviderAuthContext, input: EmailPrepareInput): Promise<ProviderResult<PreparedEmailMessage>>
  mapProviderStatus(raw: string): TransportLifecycleStatus
}
