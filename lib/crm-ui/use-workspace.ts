'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { workspaceGet, type MutationResult, type WorkspaceError } from './workspace'

/**
 * The active account id is part of the cache key so switching accounts never shows another tenant's
 * cached rows. It is not sent to the API; the server derives the account from the session.
 */
export function useWorkspace<T>(url: string | null, accountId: string) {
  return useSWR<T, WorkspaceError>(url ? [url, accountId] : null, ([path]: [string, string]) => workspaceGet<T>(path), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
}

/** Tracks one mutation: pending flag, last error, last success payload. */
export function useAction<T>() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<WorkspaceError | null>(null)
  const [data, setData] = useState<T | null>(null)

  const run = useCallback(async (send: () => Promise<MutationResult<T>>) => {
    setPending(true)
    setError(null)
    setData(null)
    const result = await send()
    setPending(false)
    if (result.ok) setData(result.data)
    else setError(result.error)
    return result
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setData(null)
  }, [])

  return { run, pending, error, data, reset }
}
