'use client'

import { useState, useTransition } from 'react'
import { updateNotificationPreferencesAction } from '@/lib/automation/customer-actions'
import { Button } from '@/components/ui/button'

type Props = {
  initial: {
    projectUpdates: boolean
    messagesAndApprovals: boolean
    serviceOrders: boolean
    infrastructureRenewals: boolean
    transactionalEmail: boolean
  }
  labels: {
    projectUpdates: string
    messagesAndApprovals: string
    serviceOrders: string
    infrastructureRenewals: string
    transactionalEmail: string
    save: string
    saved: string
    essentialNote: string
  }
}

export function NotificationPreferencesForm({ initial, labels }: Props) {
  const [prefs, setPrefs] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        startTransition(async () => {
          const result = await updateNotificationPreferencesAction(prefs)
          if (result.ok) setSaved(true)
        })
      }}
    >
      {(
        [
          ['projectUpdates', labels.projectUpdates],
          ['messagesAndApprovals', labels.messagesAndApprovals],
          ['serviceOrders', labels.serviceOrders],
          ['infrastructureRenewals', labels.infrastructureRenewals],
          ['transactionalEmail', labels.transactionalEmail],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs[key]}
            onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
          />
          {label}
        </label>
      ))}
      <p className="text-xs text-muted-foreground">{labels.essentialNote}</p>
      <Button type="submit" disabled={pending}>
        {labels.save}
      </Button>
      {saved && <p className="text-xs text-muted-foreground">{labels.saved}</p>}
    </form>
  )
}
