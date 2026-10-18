export type ProviderKind =
  | 'crm'
  | 'conversation'
  | 'social'
  | 'workforce'
  | 'workflow'
  | 'sms'
  | 'email'
  | 'payment'
  | 'voice'
  | 'seo'
  | 'domain'

export type ProviderAvailability = 'EXISTING_ADAPTER' | 'CANDIDATE' | 'NOT_INSTALLED' | 'NOT_ACTIVATED'

export type ProviderAuthContext = {
  customerAccountId: string
  managedSiteId?: string
  billingGroupId?: string
  actorId: string
  actorType: 'USER' | 'SERVICE' | 'AGENT'
  requestId: string
  idempotencyKey: string
}

export type ProviderResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      code: 'NOT_CONFIGURED' | 'UNAUTHORIZED' | 'DENIED' | 'UNAVAILABLE' | 'UNKNOWN'
      message: string
    }

export type PlatformProvider = {
  kind: ProviderKind
  key: string
  displayName: string
  availability: ProviderAvailability
  replaceable: true
  installed: boolean
}

export type CrmProvider = PlatformProvider & {
  kind: 'crm'
  searchContacts(context: ProviderAuthContext, query: string): Promise<ProviderResult<never[]>>
}

export type ConversationProvider = PlatformProvider & {
  kind: 'conversation'
  listConversations(context: ProviderAuthContext): Promise<ProviderResult<never[]>>
}

export type SocialChannelSummary = {
  id: string
  name: string
  providerIdentifier: string
}

export type SocialPublisherProvider = PlatformProvider & {
  kind: 'social'
  listChannels(context: ProviderAuthContext): Promise<ProviderResult<SocialChannelSummary[]>>
  getChannelStatus?(
    context: ProviderAuthContext,
    externalIntegrationId: string,
  ): Promise<ProviderResult<{ connected: boolean; name: string; providerIdentifier: string }>>
  schedulePost?(input: {
    customerAccountId: string
    externalIntegrationId: string
    caption: string
    scheduledAt: Date
    platformType: string
    idempotencyKey: string
  }): Promise<ProviderResult<{ externalPostId: string }> | { ok: false; code: 'UNKNOWN'; message: string }>
  getPostStatus?(externalPostId: string): Promise<ProviderResult<{ state: string; releaseURL?: string; publishDate?: string }>>
  cancelScheduledPost?(externalPostId: string): Promise<ProviderResult<{ cancelled: boolean; providerConfirmed: boolean }>>
}

export type WorkforceProvider = PlatformProvider & {
  kind: 'workforce'
  listAgents(context: ProviderAuthContext): Promise<ProviderResult<never[]>>
}

export type WorkflowProvider = PlatformProvider & {
  kind: 'workflow'
  enqueue(context: ProviderAuthContext, jobType: string): Promise<ProviderResult<{ accepted: boolean }>>
}

export type SmsProvider = PlatformProvider & {
  kind: 'sms'
  send(context: ProviderAuthContext): Promise<ProviderResult<never>>
}

export type EmailProvider = PlatformProvider & {
  kind: 'email'
  send(context: ProviderAuthContext): Promise<ProviderResult<{ accepted: boolean }>>
}

export type PaymentProvider = PlatformProvider & {
  kind: 'payment'
  startCheckout(context: ProviderAuthContext): Promise<ProviderResult<never>>
}

export type VoiceAgentProvider = PlatformProvider & {
  kind: 'voice'
  startCall(context: ProviderAuthContext): Promise<ProviderResult<never>>
}

export type SeoSourceProvider = PlatformProvider & {
  kind: 'seo'
  readOverview(context: ProviderAuthContext): Promise<ProviderResult<{ status: 'NOT_CONNECTED' }>>
}

export type DomainRegistrarProvider = PlatformProvider & {
  kind: 'domain'
  quote(context: ProviderAuthContext): Promise<ProviderResult<never>>
}

export type AnyPlatformProvider =
  | CrmProvider
  | ConversationProvider
  | SocialPublisherProvider
  | WorkforceProvider
  | WorkflowProvider
  | SmsProvider
  | EmailProvider
  | PaymentProvider
  | VoiceAgentProvider
  | SeoSourceProvider
  | DomainRegistrarProvider
