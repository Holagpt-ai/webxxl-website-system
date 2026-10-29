import { parseAnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { analyticsDisabledResponse, analyticsResultResponse } from '@/lib/platform/analytics/http'
import {
  AnalyticsApiError,
  analyticsErrorFromApiCode,
  requireAnalyticsApiActor,
} from '@/lib/platform/analytics/route-auth'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import type { AnalyticsActor } from '@/lib/platform/analytics/types'

export type AnalyticsRouteContext = {
  actor: AnalyticsActor
  customerAccountId: string
  range: AnalyticsDateRange
  managedSiteId: string | null
}

export async function parseAnalyticsRouteContext(
  request: Request,
  accountId: string,
): Promise<
  | { ok: true; ctx: AnalyticsRouteContext }
  | { ok: false; response: ReturnType<typeof analyticsResultResponse> }
> {
  const disabled = analyticsDisabledResponse()
  if (disabled) return { ok: false, response: disabled }
  try {
    const portal = await requireAnalyticsApiActor()
    if (portal.customerAccountId !== accountId) {
      return {
        ok: false,
        response: analyticsResultResponse({
          ok: false,
          error: 'TENANT_MISMATCH',
          message: 'Account id does not match active membership',
        }),
      }
    }
    const url = new URL(request.url)
    const rangeResult = parseAnalyticsDateRange(url.searchParams)
    if (!rangeResult.ok) {
      return { ok: false, response: analyticsResultResponse(rangeResult) }
    }
    return {
      ok: true,
      ctx: {
        actor: { userId: portal.userId, platformRole: portal.isStaff ? 'ADMIN' : 'CUSTOMER' },
        customerAccountId: accountId,
        range: rangeResult.value,
        managedSiteId: url.searchParams.get('siteId'),
      },
    }
  } catch (error) {
    if (error instanceof AnalyticsApiError) {
      return {
        ok: false,
        response: analyticsResultResponse({
          ok: false,
          error: analyticsErrorFromApiCode(error.code),
          message: error.message,
        }),
      }
    }
    throw error
  }
}

export async function parseAnalyticsRouteContextNoRange(
  request: Request,
  accountId: string,
): Promise<
  | { ok: true; ctx: Omit<AnalyticsRouteContext, 'range'> & { range?: AnalyticsDateRange } }
  | { ok: false; response: ReturnType<typeof analyticsResultResponse> }
> {
  const disabled = analyticsDisabledResponse()
  if (disabled) return { ok: false, response: disabled }
  try {
    const portal = await requireAnalyticsApiActor()
    if (portal.customerAccountId !== accountId) {
      return {
        ok: false,
        response: analyticsResultResponse({
          ok: false,
          error: 'TENANT_MISMATCH',
          message: 'Account id does not match active membership',
        }),
      }
    }
    const url = new URL(request.url)
    return {
      ok: true,
      ctx: {
        actor: { userId: portal.userId, platformRole: portal.isStaff ? 'ADMIN' : 'CUSTOMER' },
        customerAccountId: accountId,
        managedSiteId: url.searchParams.get('siteId'),
      },
    }
  } catch (error) {
    if (error instanceof AnalyticsApiError) {
      return {
        ok: false,
        response: analyticsResultResponse({
          ok: false,
          error: analyticsErrorFromApiCode(error.code),
          message: error.message,
        }),
      }
    }
    throw error
  }
}
