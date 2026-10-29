'use client'

import { useCallback, useState } from 'react'

/**
 * Opaque-cursor paging. The API returns only `nextCursor`, so Previous walks back through the
 * cursors already visited. Changing `filterKey` drops the history and returns to the first page.
 */
export function useCursorPages(filterKey: string) {
  const [state, setState] = useState<{ key: string; stack: string[] }>({ key: filterKey, stack: [] })
  const stack = state.key === filterKey ? state.stack : []

  const next = useCallback(
    (cursor: string) => setState((s) => ({ key: filterKey, stack: [...(s.key === filterKey ? s.stack : []), cursor] })),
    [filterKey],
  )
  const previous = useCallback(
    () => setState((s) => ({ key: filterKey, stack: (s.key === filterKey ? s.stack : []).slice(0, -1) })),
    [filterKey],
  )
  const first = useCallback(() => setState({ key: filterKey, stack: [] }), [filterKey])

  return {
    cursor: stack.at(-1),
    page: stack.length + 1,
    hasPrevious: stack.length > 0,
    next,
    previous,
    first,
  }
}
