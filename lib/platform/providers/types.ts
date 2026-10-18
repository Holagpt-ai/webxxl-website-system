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

export type CrmContactSummary = {
  id: string
  displayName: string
  primaryEmail?: string
  primaryPhone?: string
}

export type CrmCompanySummary = {
  id: string
  name: string
  websiteDomain?: string
}

export type CrmPipelineSummary = {
  id: string
  name: string
  stages: { id: string; name: string; sortOrder: number }[]
}

export type CrmDealSummary = {
  id: string
  title: string
  stageId: string
  status: string
  amountMinorUnits?: number
}

export type CrmProviderCapabilities = {
  contacts: boolean
  companies: boolean
  pipelines: boolean
  deals: boolean
  tasks: boolean
  customFields: boolean
  activities: boolean
  sync: boolean
  export: boolean
}

export type CrmProvider = PlatformProvider & {
  kind: 'crm'
  describeCapabilities(): CrmProviderCapabilities
  searchContacts(context: ProviderAuthContext, query: string): Promise<ProviderResult<CrmContactSummary[]>>
  getContact?(context: ProviderAuthContext, contactId: string): Promise<ProviderResult<CrmContactSummary>>
  createContact?(
    context: ProviderAuthContext,
    input: { displayName: string; email?: string; phone?: string },
  ): Promise<ProviderResult<{ id: string }>>
  updateContact?(
    context: ProviderAuthContext,
    contactId: string,
    patch: { displayName?: string },
  ): Promise<ProviderResult<{ id: string }>>
  searchCompanies?(context: ProviderAuthContext, query: string): Promise<ProviderResult<CrmCompanySummary[]>>
  listPipelines?(context: ProviderAuthContext): Promise<ProviderResult<CrmPipelineSummary[]>>
  createDeal?(
    context: ProviderAuthContext,
    input: { pipelineId: string; stageId: string; title: string; contactId?: string },
  ): Promise<ProviderResult<{ id: string }>>
  updateDealStatus?(
    context: ProviderAuthContext,
    dealId: string,
    input: { stageId?: string; status?: string },
  ): Promise<ProviderResult<{ id: string }>>
  listTasks?(context: ProviderAuthContext): Promise<ProviderResult<{ id: string; title: string; status: string }[]>>
  syncWorkspace?(context: ProviderAuthContext): Promise<ProviderResult<{ accepted: boolean }>>
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
