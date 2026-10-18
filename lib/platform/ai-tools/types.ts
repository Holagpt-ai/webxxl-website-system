import type { ActorType } from '@/lib/platform/identity'

export type ToolRiskLevel = 0 | 1 | 2 | 3 | 4

export type ToolApprovalPolicy = 'NONE' | 'REQUIRED' | 'ALWAYS_DENY'

export type AiToolDefinition = {
  name: string
  domain:
    | 'projects'
    | 'sites'
    | 'crm'
    | 'communications'
    | 'marketing'
    | 'social'
    | 'seo'
    | 'hosting'
    | 'marketplace'
    | 'billing'
    | 'forbidden'
  riskLevel: ToolRiskLevel
  approvalPolicy: ToolApprovalPolicy
  enabled: boolean
}

export type AiToolGrant = {
  actorId: string
  actorType: ActorType
  customerAccountId: string
  managedSiteId?: string
  toolKey: string
  approvalRequired: boolean
  expiresAt?: Date | null
}

export type AiToolInvocationRequest = {
  actorId: string
  actorType: ActorType
  customerAccountId: string
  managedSiteId?: string
  toolKey: string
  requestId: string
  correlationId?: string
  approvalId?: string
  inputHash: string
  at?: Date
}

export type AiToolDecision = {
  decision: 'ALLOWED' | 'DENIED'
  denialReason?: string
  audit: {
    actorId: string
    customerAccountId: string
    managedSiteId?: string
    toolKey: string
    requestId: string
    correlationId?: string
    approvalId?: string
    inputHash: string
  }
}
