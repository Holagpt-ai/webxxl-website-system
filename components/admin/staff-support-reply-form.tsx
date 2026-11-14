'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { replyStaffSupportRequestAction } from '@/lib/admin/actions'

export function StaffSupportReplyForm({
  supportRequestId,
  labels,
}: {
  supportRequestId: string
  labels: {
    staffReplyLabel: string
    staffReplyPlaceholder: string
    staffReplySubmit: string
    staffReplySuccess: string
    staffReplyErrors: Record<string, string>
    save: string
  }
}) {
  const [body, setBody] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="mt-3 flex flex-col gap-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        startTransition(async () => {
          const result = await replyStaffSupportRequestAction(supportRequestId, body)
          if (!result.ok) {
            setFeedback(labels.staffReplyErrors[result.error ?? 'unknown'] ?? labels.staffReplyErrors.unknown)
            return
          }
          setBody('')
          setFeedback(labels.staffReplySuccess)
        })
      }}
    >
      <Label htmlFor={`staff-reply-${supportRequestId}`} className="text-xs font-medium">
        {labels.staffReplyLabel}
      </Label>
      <Textarea
        id={`staff-reply-${supportRequestId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={labels.staffReplyPlaceholder}
        rows={3}
        required
        disabled={pending}
        className="text-sm"
      />
      {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
      <Button type="submit" size="sm" className="self-start" disabled={pending || !body.trim()}>
        {pending ? labels.save : labels.staffReplySubmit}
      </Button>
    </form>
  )
}