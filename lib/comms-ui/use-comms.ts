'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { WorkspaceError, workspaceGet } from '@/lib/crm-ui/workspace'

/**
 * The shared classifier does not know `COMMS_DISABLED` (a 503) and would treat it as a retryable
 * server error. Communications maps it to the workspace DISABLED state here, without editing shared code.
 */
export function classifyCommsError(error: unknown): WorkspaceError {
  if (!(error instanceof WorkspaceError)) return new WorkspaceError(0, 'ERROR', null, null)
  if (error.code === 'COMMS_DISABLED') return new WorkspaceError(error.status, 'DISABLED', error.code, error.detail)
  if (error.code === 'POLICY_UNRESOLVED') return new WorkspaceError(error.status, 'POLICY_UNRESOLVED', error.code, error.detail)
  return error
}

export async function commsGet<T>(url: string): Promise<T> {
  try {
    return await workspaceGet<T>(url)
  } catch (error) {
    throw classifyCommsError(error)
  }
}

/**
 * Keys are namespaced and carry the session account id, so one customer account's conversations
 * never render from cache after switching accounts. The id is never sent to the API.
 * Feature-gated endpoints are not retried automatically.
 */
export function useComms<T>(url: string | null, accountId: string) {
  return useSWR<T, WorkspaceError>(url ? ['comms', accountId, url] : null, ([, , path]: [string, string, string]) => commsGet<T>(path), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
}

/**
 * Opaque-cursor paging. The API only returns `nextCursor`, so Previous walks back through visited
 * cursors. A new `resetKey` (account, filter, inbox, channel) drops the history.
 */
export function useCursorStack(resetKey: string) {
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
