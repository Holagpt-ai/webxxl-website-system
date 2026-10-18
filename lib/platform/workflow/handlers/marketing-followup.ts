import { isMktLeadMonitorEnabled } from '@/config/mkt-backend'
import { evaluateAccountLeadFollowUps } from '@/lib/platform/marketing/follow-up-evaluation-service'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'

export async function executeMarketingFollowUpWorkflow(
  ctx: HandlerExecutionContext,
  payload: Record<string, unknown>,
): Promise<HandlerExecutionResult> {
  if (!isMktLeadMonitorEnabled()) {
    return { outcome: 'BLOCKED', errorCode: 'NOT_CONFIGURED' }
  }
  const customerAccountId = ctx.job.customerAccountId
  if (!customerAccountId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'CONFIGURATION_MISSING', errorCode: 'MISSING_ACCOUNT' }
  }
  if (payload.customerAccountId && payload.customerAccountId !== customerAccountId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'TENANT_MISMATCH' }
  }
  const managedSiteId = ctx.job.managedSiteId ?? undefined
  if (
    ctx.job.managedSiteId &&
    typeof payload.managedSiteId === 'string' &&
    payload.managedSiteId !== ctx.job.managedSiteId
  ) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'FOREIGN_MANAGED_SITE' }
  }
  const result = await evaluateAccountLeadFollowUps({
    customerAccountId,
    managedSiteId,
    idempotencyKey: ctx.job.idempotencyKey,
    limit: typeof payload.limit === 'number' ? payload.limit : 25,
  })
  if (!result.ok) {
    if (result.code === 'NOT_CONFIGURED') {
      return { outcome: 'BLOCKED', errorCode: 'NOT_CONFIGURED' }
    }
    return { outcome: 'RETRY', errorClass: 'TRANSIENT', errorCode: result.code }
  }
  const unknown = result.value.summary.UNKNOWN_COVERAGE ?? 0
  return {
    outcome: 'COMPLETED',
    resultRef: JSON.stringify({ evaluated: result.value.rows.length, unknownCoverage: unknown }),
  }
}
