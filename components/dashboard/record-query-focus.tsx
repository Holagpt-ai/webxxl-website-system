'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { scrollToDomId } from '@/lib/crm-ui/deep-link'

/** Scroll to a dashboard record when its query param is present (Business Center deep links). */
export function RecordQueryFocus({ param, domIdPrefix, ready }: { param: string; domIdPrefix: string; ready?: boolean }) {
  const search = useSearchParams()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (ready === false) return
    const id = search.get(param)
    if (!id || handled.current === id) return
    handled.current = id
    scrollToDomId(`${domIdPrefix}${id}`)
  }, [param, domIdPrefix, ready, search])

  return null
}