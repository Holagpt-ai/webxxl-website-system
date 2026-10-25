import {
  aggregateFirstPartyConversionsForSite,
  utcDayBounds,
} from '@/lib/platform/analytics/aggregation/conversion-daily'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'

export async function executeAnalyticsConversionAggregateWorkflow(
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
  const periodDate =
    typeof payload.periodDate === 'string' ? new Date(`${payload.periodDate}T00:00:00.000Z`) : new Date()
  const { start, end } = utcDayBounds(periodDate)
  const result = await aggregateFirstPartyConversionsForSite({
    customerAccountId,
    managedSiteId,
    periodStartUtc: start,
    periodEndUtc: end,
  })
  return {
    outcome: 'COMPLETED',
    resultRef: `events=${result.eventsProcessed};rows=${result.rowsWritten};day=${result.periodDate}`,
  }
}
