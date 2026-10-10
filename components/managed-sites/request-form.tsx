'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitManagedSiteRequestAction } from '@/lib/managed-sites/customer-actions'

export function SiteCapabilityRequestForm({
  siteId,
  capabilityKey,
  submitLabel,
  placeholder,
  messages,
}: {
  siteId: string
  capabilityKey: string
  submitLabel: string
  placeholder: string
  messages: {
    saved: string
    unavailable: string
    escalated: string
    draft: string
    projectRequired: string
    failed: string
  }
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await submitManagedSiteRequestAction(siteId, capabilityKey, text)
          if (!result.ok) {
            if (result.error === 'unavailable') setMessage(messages.unavailable)
            else if (result.error === 'project_required') setMessage(messages.projectRequired)
            else setMessage(messages.failed)
            return
          }
          setText('')
          if (result.status === 'ESCALATED') setMessage(messages.escalated)
          else if (result.status === 'DRAFT') setMessage(messages.draft)
          else setMessage(messages.saved)
        })
      }}
    >
      <Textarea value={text} onChange={(event) => setText(event.target.value)} required rows={3} placeholder={placeholder} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}
