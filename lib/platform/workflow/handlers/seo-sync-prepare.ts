import { prisma } from '@/lib/db'
import { isSeoGscApiEnabled } from '@/config/seo-backend'
import { prepareSeoProviderSyncRun } from '@/lib/platform/seo/sync-run-service'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'
import type { SeoAnalyticsProvider } from '@prisma/client'

export async function executeSeoSyncPrepareWorkflow(
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
  const oauthReady =
    connection != null &&
    connection.revokedAt == null &&
    (connection.verificationState === 'VERIFIED' || connection.dataState === 'READY')
  const intent = prepareSeoProviderSyncRun({
    provider,
    connectionDataState: connection?.dataState ?? 'NOT_CONNECTED',
    idempotencyKey: ctx.job.idempotencyKey,
    oauthEnabled: oauthReady,
    apiEnabled: isSeoGscApiEnabled(),
  })
  if (intent.dataState === 'NOT_CONNECTED' || intent.status === 'SKIPPED') {
    return { outcome: 'COMPLETED', resultRef: intent.reason ?? 'NOT_CONNECTED' }
  }
  return { outcome: 'BLOCKED', errorCode: 'EXTERNAL_EFFECTS_DISABLED' }
}
