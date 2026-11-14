'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

/** Open the matching CRM record once workspace data is loaded (Business Center deep links). */
export function useQueryRecordFocus(
  param: string,
  ready: boolean,
  recordIds: readonly string[],
  onMatch: (id: string) => void,
  scrollToId?: (id: string) => void,
) {
  const search = useSearchParams()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return
    const id = search.get(param)
    if (!id || handled.current === id) return
    if (!recordIds.includes(id)) return
    handled.current = id
    onMatch(id)
    scrollToId?.(id)
  }, [param, ready, recordIds, search, onMatch, scrollToId])
}

export function scrollToDomId(domId: string) {
  requestAnimationFrame(() => {
    document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}