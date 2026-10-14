'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { recordOwnerReviewDecisionAction } from '@/lib/owner-approval/actions'
import type { OwnerReviewItemStatus } from '@/lib/owner-approval/types'

export function OwnerReviewItemForm({
  projectId,
  itemKey,
  initialStatus,
  initialFeedback,
  frozen,
  locale,
  copy,
}: {
  projectId: string
  itemKey: string
  initialStatus: OwnerReviewItemStatus
  initialFeedback: string | null
  frozen?: boolean
  locale: string
  copy: {
    statusLabel: string
    feedbackLabel: string
    feedbackPlaceholder: string
    save: string
    saved: string
    errors: Record<string, string>
    statuses: Record<OwnerReviewItemStatus, string>
    ownerConfirmed: string
  }
}) {
  const [status, setStatus] = useState(initialStatus)
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (frozen) {
    return <p className="text-sm font-medium text-muted-foreground">{copy.ownerConfirmed}</p>
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(null)
        startTransition(async () => {
          const result = await recordOwnerReviewDecisionAction(projectId, itemKey, status, feedback, locale)
          if (!result.ok) {
            setMessage(copy.errors[result.error] ?? copy.errors.failed)
            return
          }
          setMessage(copy.saved)
        })
      }}
    >
      <div>
        <Label htmlFor={`${itemKey}-status`}>{copy.statusLabel}</Label>
        <select
          id={`${itemKey}-status`}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as OwnerReviewItemStatus)}
          disabled={pending}
        >
          {(Object.keys(copy.statuses) as OwnerReviewItemStatus[]).map((key) => (
            <option key={key} value={key}>
              {copy.statuses[key]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${itemKey}-feedback`}>{copy.feedbackLabel}</Label>
        <textarea
          id={`${itemKey}-feedback`}
          className="mt-1 min-h-[4rem] w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={copy.feedbackPlaceholder}
          disabled={pending}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.save}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}
