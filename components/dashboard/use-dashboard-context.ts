'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { PORTAL_DASHBOARD_API } from '@/lib/dashboard-ui/types'
import type { CustomerDashboardContextResponse } from '@/lib/platform/customer-dashboard/types'

export type DashboardContextState =
  | { status: 'loading' }
  | { status: 'ready'; context: CustomerDashboardContextResponse }
  | { status: 'unavailable'; httpStatus: number }

async function fetchDashboardContext(url: string): Promise<DashboardContextState> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) return { status: 'unavailable', httpStatus: response.status }
  const body = (await response.json()) as { context: CustomerDashboardContextResponse }
  return { status: 'ready', context: body.context }
}

/** Shared SWR key so the shell and module screens read one dashboard-context response. */
export function useDashboardContext(): DashboardContextState {
  const { data } = useSWR(PORTAL_DASHBOARD_API.context, fetchDashboardContext, {
    revalidateOnFocus: false,
  })
  return data ?? { status: 'loading' }
}

/**
 * Revalidates the cached context when it belongs to a different account than the session
 * (e.g. after an account switch), so module screens never read a stale tenant snapshot.
 */
export function useDashboardContextGuard(activeAccountId: string | undefined) {
  const { data, mutate } = useSWR(PORTAL_DASHBOARD_API.context, fetchDashboardContext, {
    revalidateOnFocus: false,
  })
  const loadedAccountId = data?.status === 'ready' ? data.context.customerAccountId : undefined
  useEffect(() => {
    if (activeAccountId && loadedAccountId && loadedAccountId !== activeAccountId) void mutate()
  }, [activeAccountId, loadedAccountId, mutate])
}

/** Locale-prefixed path for a server-provided, locale-neutral workspace path. */
export function localizeWorkspacePath(locale: string, path: string): string {
  return locale === 'es' ? `/es${path}` : path
}
