'use client'

import useSWR from 'swr'
import type {
  CustomerAiChatSessionDto,
  CustomerAiEmployeeDto,
  CustomerAiHandoffDto,
  CustomerAiKnowledgeItemDto,
  CustomerAiToolPermissionDto,
  CustomerAiUsagePolicyDto,
  CustomerAiUsageSummaryDto,
} from '@/lib/platform/customer-ai-workforce/dto'
import type { CustomerAiKnowledgeRetrievalResult } from '@/lib/platform/customer-ai-workforce/retrieval-contract'
import type { CustomerAiToolDefinition } from '@/lib/platform/customer-ai-workforce/tool-catalog'
import type { PageResult } from '@/lib/platform/commerce/pagination'

export type {
  CustomerAiChatSessionDto as AiSession,
  CustomerAiEmployeeDto as AiEmployee,
  CustomerAiHandoffDto as AiHandoff,
  CustomerAiKnowledgeItemDto as AiKnowledgeItem,
  CustomerAiToolPermissionDto as AiToolPermission,
  CustomerAiUsagePolicyDto as AiUsagePolicy,
  CustomerAiUsageSummaryDto as AiUsageSummary,
  CustomerAiKnowledgeRetrievalResult as AiRetrieval,
  CustomerAiToolDefinition as AiToolDefinition,
  PageResult,
}

export type AiToolPermissionsResponse = {
  catalog: CustomerAiToolDefinition[]
  permissions: CustomerAiToolPermissionDto[]
}

export type AiConversationDetail = {
  session: CustomerAiChatSessionDto
  handoffs: CustomerAiHandoffDto[]
}

export const AI_ERROR_CODES = [
  'AI_WORKFORCE_DISABLED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TENANT_MISMATCH',
  'VALIDATION',
  'ENTITLEMENT_UNRESOLVED',
  'EXECUTION_DISABLED',
  'NOT_FOUND',
  'INVALID_TRANSITION',
  'POLICY_BLOCKED',
  'EMERGENCY_DISABLED',
  'RATE_LIMITED',
  'UNKNOWN',
] as const

export type AiErrorCode = (typeof AI_ERROR_CODES)[number]

export class AiApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: AiErrorCode,
    readonly detail?: string,
  ) {
    super(code)
  }
}

function normalizeCode(status: number, raw: unknown): AiErrorCode {
  if (typeof raw === 'string' && (AI_ERROR_CODES as readonly string[]).includes(raw)) return raw as AiErrorCode
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 400) return 'VALIDATION'
  if (status === 503) return 'AI_WORKFORCE_DISABLED'
  return 'UNKNOWN'
}

async function toError(res: Response): Promise<AiApiError> {
  let body: { code?: unknown; message?: unknown } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    body = {}
  }
  const code = normalizeCode(res.status, body.code)
  const detail = typeof body.message === 'string' && body.message !== body.code ? body.message : undefined
  return new AiApiError(res.status, code, detail)
}

async function aiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as T
}

export function useAi<T>(url: string | null) {
  return useSWR<T, AiApiError>(url, aiFetcher<T>, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  })
}

export type AiMutationResult<T> = { ok: true; data: T } | { ok: false; code: AiErrorCode; detail?: string }

export async function aiMutate<T>(url: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown): Promise<AiMutationResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    if (!res.ok) {
      const error = await toError(res)
      return { ok: false, code: error.code, detail: error.detail }
    }
    return { ok: true, data: (await res.json()) as T }
  } catch {
    return { ok: false, code: 'UNKNOWN' }
  }
}

export function aiBase(accountId: string) {
  return `/api/v1/customer-ai/accounts/${encodeURIComponent(accountId)}`
}

export function withPage(url: string, take: number, skip: number) {
  return `${url}?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
}
