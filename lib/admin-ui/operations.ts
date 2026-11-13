'use client'

import useSWR from 'swr'
import type {
  AdminAccountExecutionAttachment,
  AdminOperationsSlice,
  AdminOperationsSummaryResponse,
  AdminPlatformQueueCounts,
  AdminRuntimeGateSnapshot,
} from '@/lib/platform/admin-operations/types'

export type {
  AdminAccountExecutionAttachment,
  AdminOperationsSlice,
  AdminOperationsSummaryResponse,
  AdminPlatformQueueCounts,
  AdminRuntimeGateSnapshot,
}

export const ADMIN_OPS_ERROR_CODES = ['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION', 'NOT_FOUND', 'ERROR'] as const
export type AdminOpsErrorCode = (typeof ADMIN_OPS_ERROR_CODES)[number]

export class AdminOpsError extends Error {
  constructor(
    readonly status: number,
    readonly code: AdminOpsErrorCode,
    readonly detail?: string,
  ) {
    super(code)
  }
}

function normalizeCode(status: number, raw: unknown): AdminOpsErrorCode {
  if (typeof raw === 'string' && (ADMIN_OPS_ERROR_CODES as readonly string[]).includes(raw)) return raw as AdminOpsErrorCode
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 400) return 'VALIDATION'
  return 'ERROR'
}

async function fetcher(url: string): Promise<{ summary: AdminOperationsSummaryResponse }> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (!res.ok) {
    let body: { code?: unknown; message?: unknown } = {}
    try {
      body = (await res.json()) as typeof body
    } catch {
      body = {}
    }
    throw new AdminOpsError(res.status, normalizeCode(res.status, body.code), typeof body.message === 'string' ? body.message : undefined)
  }
  return (await res.json()) as { summary: AdminOperationsSummaryResponse }
}

/** `managedSiteId` is only sent alongside a customer account; the API rejects it otherwise. */
export function adminOperationsUrl(customerAccountId?: string | null, managedSiteId?: string | null) {
  const params = new URLSearchParams()
  if (customerAccountId) {
    params.set('customerAccountId', customerAccountId)
    if (managedSiteId) params.set('managedSiteId', managedSiteId)
  }
  const query = params.toString()
  return `/api/v1/admin/operations/summary${query ? `?${query}` : ''}`
}

export function useAdminOperations(customerAccountId?: string | null, managedSiteId?: string | null) {
  const swr = useSWR<{ summary: AdminOperationsSummaryResponse }, AdminOpsError>(
    adminOperationsUrl(customerAccountId, managedSiteId),
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true },
  )
  const raw = swr.data?.summary
  // keepPreviousData can briefly hold a different scope; never render it as the current one.
  const matches =
    raw && raw.customerAccountId === (customerAccountId ?? null) && raw.managedSiteId === ((customerAccountId && managedSiteId) || null)
  return { ...swr, summary: matches ? raw : undefined }
}

/** Every module summary is a flat object; its sections are the values carrying a slice `status`. */
export function listSlices(summary: object | null | undefined) {
  if (!summary) return []
  return Object.entries(summary).flatMap(([key, value]) =>
    value && typeof value === 'object' && 'status' in value && (value.status === 'AVAILABLE' || value.status === 'UNAVAILABLE')
      ? [{ key, status: value.status as 'AVAILABLE' | 'UNAVAILABLE', reasonCode: (value as { reasonCode?: string }).reasonCode }]
      : [],
  )
}
