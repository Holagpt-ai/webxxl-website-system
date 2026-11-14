'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { replySupportRequestAction } from '@/lib/portal/actions'

type Message = {
  id: string
  body: string
  createdAt: Date
  author: { id: string; name: string | null; email: string }
}

export function SupportTicketThread({
  ticketId,
  status,
  messages,
  locale,
  labels,
}: {
  ticketId: string
  status: string
  messages: Message[]
  locale: string
  labels: {
    threadTitle: string
    replyLabel: string
    replyPlaceholder: string
    submit: string
    sending: string
    closedNote: string
    waitingNote: string
    success: string
    errors: Record<string, string>
  }
}) {
  const [body, setBody] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const canReply = status === 'OPEN' || status === 'IN_PROGRESS' || status === 'WAITING_ON_CUSTOMER'
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.threadTitle}</p>
      {messages.length > 0 && (
        <ul className="flex flex-col gap-2">
          {messages.map((msg) => (
            <li key={msg.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <p className="text-foreground">{msg.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {msg.author.name ?? msg.author.email} · {fmt.format(msg.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {status === 'WAITING_ON_CUSTOMER' && (
        <p className="text-sm text-muted-foreground">{labels.waitingNote}</p>
      )}
      {!canReply ? (
        <p className="text-sm text-muted-foreground">{labels.closedNote}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setFeedback(null)
            startTransition(async () => {
              const result = await replySupportRequestAction(ticketId, body)
              if (!result.ok) {
                setFeedback(labels.errors[result.error ?? 'unknown'] ?? labels.errors.unknown)
                return
              }
              setBody('')
              setFeedback(labels.success)
            })
          }}
        >
          <Label htmlFor={`support-reply-${ticketId}`} className="text-sm font-medium">
            {labels.replyLabel}
          </Label>
          <Textarea
            id={`support-reply-${ticketId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={labels.replyPlaceholder}
            rows={3}
            required
            disabled={pending}
            className="mt-1"
          />
          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
          <Button type="submit" size="sm" className="self-start" disabled={pending || !body.trim()}>
            {pending ? labels.sending : labels.submit}
          </Button>
        </form>
      )}
    </div>
  )
}