import { getAiTool } from '@/lib/platform/ai-tools/registry'
import type { AiToolDecision, AiToolGrant, AiToolInvocationRequest } from '@/lib/platform/ai-tools/types'

export function evaluateAiToolInvocation(
  request: AiToolInvocationRequest,
  grants: AiToolGrant[],
): AiToolDecision {
  const audit = {
    actorId: request.actorId,
    customerAccountId: request.customerAccountId,
    managedSiteId: request.managedSiteId,
    toolKey: request.toolKey,
    requestId: request.requestId,
    correlationId: request.correlationId,
    approvalId: request.approvalId,
    inputHash: request.inputHash,
  }
  const tool = getAiTool(request.toolKey)
  if (!tool || !tool.enabled || tool.approvalPolicy === 'ALWAYS_DENY' || tool.riskLevel === 4) {
    return { decision: 'DENIED', denialReason: 'DENY_BY_DEFAULT', audit }
  }
  const at = request.at ?? new Date()
  const grant = grants.find((item) => {
    if (item.actorId !== request.actorId) return false
    if (item.actorType !== request.actorType) return false
    if (item.customerAccountId !== request.customerAccountId) return false
    if (item.toolKey !== request.toolKey) return false
    if (item.managedSiteId && item.managedSiteId !== request.managedSiteId) return false
    if (item.expiresAt && item.expiresAt <= at) return false
    return true
  })
  if (!grant) {
    return { decision: 'DENIED', denialReason: 'NO_GRANT', audit }
  }
  if ((tool.approvalPolicy === 'REQUIRED' || grant.approvalRequired) && !request.approvalId) {
    return { decision: 'DENIED', denialReason: 'APPROVAL_REQUIRED', audit }
  }
  return { decision: 'ALLOWED', audit }
}
