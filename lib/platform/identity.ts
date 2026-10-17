export type ActorType = 'USER' | 'SERVICE' | 'AGENT'

export type PlatformActionContext = {
  actorUserId?: string
  actorServiceId?: string
  actorType: ActorType
  actorRole?: string
  customerAccountId: string
  managedSiteId?: string
  projectId?: string
  billingGroupId?: string
  capability: string
  action: string
  consentScope?: string
  approvalId?: string
  idempotencyKey: string
  requestId: string
  correlationId?: string
}

export type ResolvedPlatformContext = PlatformActionContext & {
  billingGroupId: string | null
}

export function createRequestIds(prefix: string): { requestId: string; idempotencyKey: string } {
  const requestId = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  return { requestId, idempotencyKey: requestId }
}
