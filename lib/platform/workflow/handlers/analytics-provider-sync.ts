import { prisma } from '@/lib/db'
import { runAnalyticsProviderIngest } from '@/lib/platform/analytics/ingestion/provider-ingest'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'
import type { SeoAnalyticsProvider } from '@prisma/client'

export async function executeAnalyticsProviderSyncWorkflow(
  ctx: HandlerExecutionContext,
  payload: Record<string, unknown>,
): Promise<HandlerExecutionResult> {
  const customerAccountId = ctx.job.customerAccountId
  const managedSiteId = ctx.job.managedSiteId
  if (!customerAccountId || !managedSiteId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'CONFIGURATION_MISSING', errorCode: 'MISSING_SITE_SCOPE' }
  }
  if (typeof payload.managedSiteId === 'string' && payload.managedSiteId !== managedSiteId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'FOREIGN_MANAGED_SITE' }
  }
  const provider = (payload.provider as SeoAnalyticsProvider | undefined) ?? 'GSC'
  const connection = await prisma.siteAnalyticsConnection.findFirst({
    where: { customerAccountId, managedSiteId, provider },
  })
  const outcome = await runAnalyticsProviderIngest({
    customerAccountId,
    managedSiteId,
    provider,
    idempotencyKey: ctx.job.idempotencyKey,
    connectionDataState: connection?.dataState ?? 'NOT_CONNECTED',
    backfillDays: typeof payload.backfillDays === 'number' ? payload.backfillDays : undefined,
  })
  if (outcome.status === 'BLOCKED') {
    return { outcome: 'BLOCKED', errorCode: 'EXTERNAL_EFFECTS_DISABLED' }
  }
  return { outcome: 'COMPLETED', resultRef: `${outcome.provider}:${outcome.status}:${outcome.reason}` }
}
