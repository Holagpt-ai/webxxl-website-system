'use client'

import { useState, useTransition } from 'react'
import { submitInfrastructureRequestAction } from '@/lib/infrastructure/customer-actions'
import type { InfrastructureRequestType } from '@/lib/infrastructure/requests'
import { Button } from '@/components/ui/button'

type Props = {
  locale: string
  requestType: InfrastructureRequestType
  requestTypeLabel: string
  messageLabel: string
  submitLabel: string
  projectId?: string
  assetPublicId?: string
  successMessage: string
  duplicateMessage: string
  reviewNotice: string
  selectProjectLabel?: string
  projects?: { id: string; name: string }[]
}

export function InfrastructureRequestForm({
  locale,
  requestType,
  requestTypeLabel,
  messageLabel,
  submitLabel,
  projectId: defaultProjectId,
  assetPublicId,
  successMessage,
  duplicateMessage,
  reviewNotice,
  projects,
  selectProjectLabel,
}: Props) {
  const [message, setMessage] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        startTransition(async () => {
          const result = await submitInfrastructureRequestAction({
            locale,
            type: requestType,
            message,
            projectId: projectId || undefined,
            assetPublicId,
          })
          if (!result.ok) {
            setFeedback(reviewNotice)
            return
          }
          setFeedback(result.duplicate ? duplicateMessage : successMessage)
          if (!result.duplicate) setMessage('')
        })
      }}
    >
      <p className="text-sm font-medium">{requestTypeLabel}</p>
      {projects && projects.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{selectProjectLabel}</span>
          <select
            className="rounded-md border bg-background px-3 py-2"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{messageLabel}</span>
        <textarea
          required
          rows={4}
          className="rounded-md border bg-background px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">{reviewNotice}</p>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
      {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
    </form>
  )
}
