'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

const FOCUS_ATTR = 'data-query-focus'
const MAX_FRAMES = 30

/**
 * Scroll to a deep-linked record, mark it with the shared focus ring, and move keyboard focus to it.
 * Retries for a few frames because client-loaded lists can mount the target after the query is read.
 */
export function focusRecordElement(domId: string) {
  let frame = 0
  const attempt = () => {
    const el = document.getElementById(domId)
    if (!el) {
      if (frame++ < MAX_FRAMES) requestAnimationFrame(attempt)
      return
    }
    document.querySelectorAll(`[${FOCUS_ATTR}]`).forEach((node) => {
      if (node !== el) node.removeAttribute(FOCUS_ATTR)
    })
    el.setAttribute(FOCUS_ATTR, 'true')
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.focus({ preventScroll: true })
  }
  requestAnimationFrame(attempt)
}

/** Scroll to and highlight a dashboard record when its query param is present (Business Center deep links). */
export function RecordQueryFocus({ param, domIdPrefix, ready }: { param: string; domIdPrefix: string; ready?: boolean }) {
  const search = useSearchParams()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (ready === false) return
    const id = search.get(param)
    if (!id || handled.current === id) return
    handled.current = id
    focusRecordElement(`${domIdPrefix}${id}`)
  }, [param, domIdPrefix, ready, search])

  return null
}
