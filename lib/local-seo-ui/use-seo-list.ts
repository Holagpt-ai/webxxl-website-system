'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { workspaceGet, type WorkspaceError } from '@/lib/crm-ui/workspace'

/**
 * Like `useWorkspace`, but keeps the previous page on screen while the next search or page loads so
 * inputs stay mounted. Kept data is only returned for the same `scope` (the selected site), so one
 * site's rows never appear under another. The account id stays in the cache key.
 */
export function useSeoList<T>(scope: string, url: string | null, accountId: string) {
  const res = useSWR<{ scope: string; body: T }, WorkspaceError>(
    url ? [url, accountId, scope] : null,
    async ([path, , s]: [string, string, string]) => ({ scope: s, body: await workspaceGet<T>(path) }),
    { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true },
  )
  const data = res.data?.scope === scope ? res.data.body : undefined
  return {
    data,
    error: res.error,
    isLoading: !!url && !data && !res.error,
    isRefreshing: !!data && res.isValidating,
    mutate: res.mutate,
  }
}

/**
 * Opaque-cursor paging. The API returns only `nextCursor`, so Previous walks back through cursors
 * already visited. A new `resetKey` (site, search or filters) drops the history and returns to page 1.
 */
export function useCursorPages(resetKey: string) {
  const [state, setState] = useState<{ key: string; stack: string[] }>({ key: resetKey, stack: [] })
  const stack = state.key === resetKey ? state.stack : []

  const next = useCallback(
    (cursor: string) => setState((s) => ({ key: resetKey, stack: [...(s.key === resetKey ? s.stack : []), cursor] })),
    [resetKey],
  )
  const previous = useCallback(
    () => setState((s) => ({ key: resetKey, stack: (s.key === resetKey ? s.stack : []).slice(0, -1) })),
    [resetKey],
  )
  const first = useCallback(() => setState({ key: resetKey, stack: [] }), [resetKey])

  return { cursor: stack.at(-1), page: stack.length + 1, hasPrevious: stack.length > 0, next, previous, first }
}

/** Reset opaque cursor paging when the API rejects a stale or malformed cursor. */
export function useRecoverInvalidCursor(error: WorkspaceError | undefined, hasCursor: boolean, reset: () => void) {
  const recovered = useRef(false)
  useEffect(() => {
    if (!error || error.kind !== 'VALIDATION' || !hasCursor) {
      recovered.current = false
      return
    }
    if (recovered.current) return
    recovered.current = true
    reset()
  }, [error, hasCursor, reset])
}
