'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { switchManagedSiteAction } from '@/lib/portal/customer-actions'

type ManagedSiteOption = { id: string; name: string }

export function ManagedSiteSwitcher({
  sites,
  activeSiteId,
  label,
  errorLabel,
}: {
  sites: ManagedSiteOption[]
  activeSiteId: string
  label: string
  errorLabel: string
}) {
  const router = useRouter()
  const selectId = useId()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  if (sites.length === 0) return null

  if (sites.length === 1) {
    return (
      <p className="min-w-0 break-words text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}: </span>
        {sites[0].name}
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={selectId}
        className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:opacity-60"
        value={activeSiteId}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => {
          const next = event.target.value
          if (next === activeSiteId) return
          setFailed(false)
          startTransition(async () => {
            const result = await switchManagedSiteAction(next)
            if (result.ok) router.refresh()
            else setFailed(true)
          })
        }}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          {errorLabel}
        </p>
      ) : null}
    </div>
  )
}
