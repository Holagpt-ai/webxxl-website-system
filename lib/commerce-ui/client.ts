'use client'

import useSWR from 'swr'

export type CommerceUiErrorCode =
  | 'COMMERCE_DISABLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'POLICY_UNRESOLVED'
  | 'VALIDATION'
  | 'PRICE_UNAVAILABLE'
  | 'ACCOUNT_NOT_FUNDED'
  | 'UNKNOWN'

const KNOWN: CommerceUiErrorCode[] = [
  'COMMERCE_DISABLED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'POLICY_UNRESOLVED',
  'VALIDATION',
  'PRICE_UNAVAILABLE',
  'ACCOUNT_NOT_FUNDED',
]

export class CommerceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: CommerceUiErrorCode,
  ) {
    super(code)
  }
}

/** Collapses backend codes onto the states the UI distinguishes. */
function normalizeCode(status: number, raw: unknown): CommerceUiErrorCode {
  if (typeof raw === 'string') {
    if ((KNOWN as string[]).includes(raw)) return raw as CommerceUiErrorCode
    if (raw === 'TENANT_MISMATCH') return 'FORBIDDEN'
    if (raw === 'ORDER_NOT_FOUND') return 'PRICE_UNAVAILABLE'
  }
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 503) return 'COMMERCE_DISABLED'
  if (status === 400) return 'VALIDATION'
  return 'UNKNOWN'
}

async function toError(res: Response): Promise<CommerceApiError> {
  let code: unknown
  try {
    code = ((await res.json()) as { code?: unknown }).code
  } catch {
    code = undefined
  }
  return new CommerceApiError(res.status, normalizeCode(res.status, code))
}

export async function commerceFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (!res.ok) throw await toError(res)
  return (await res.json()) as T
}

export function useCommerce<T>(url: string | null) {
  return useSWR<T, CommerceApiError>(url, commerceFetcher<T>, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  })
}

export type MutationResult = { ok: true } | { ok: false; code: CommerceUiErrorCode }

export async function postActivation(url: string, status: string): Promise<MutationResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return { ok: false, code: (await toError(res)).code }
    return { ok: true }
  } catch {
    return { ok: false, code: 'UNKNOWN' }
  }
}

export function withPage(url: string, take: number, skip: number, extra?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams({ take: String(take), skip: String(skip) })
  for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value)
  return `${url}?${params.toString()}`
}
