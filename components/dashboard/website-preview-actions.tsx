'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { previewActionError } from '@/lib/website-preview/display'
import {
  approveWebsitePreviewVersionAction,
  requestWebsitePreviewChangesAction,
} from '@/lib/website-preview/customer-actions'

type ErrorLabels = {
  unauthorized: string
  notFound: string
  invalid: string
  superseded: string
  failed: string
  notesRequired: string
}

export function WebsitePreviewActions({
  versionId,
  canDecide,
  approveLabel,
  changesLabel,
  notesPlaceholder,
  notesRequired,
  awaitingReview,
  errors,
}: {
  versionId: string
  canDecide: boolean
  approveLabel: string
  changesLabel: string
  notesPlaceholder: string
  notesRequired: string
  awaitingReview: string
  errors: ErrorLabels
}) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(kind: 'approve' | 'changes') {
    setError(null)
    if (kind === 'changes' && !notes.trim()) {
      setError(notesRequired)
      return
    }
    startTransition(async () => {
      const result =
        kind === 'approve'
          ? await approveWebsitePreviewVersionAction(versionId, notes)
          : await requestWebsitePreviewChangesAction(versionId, notes)
      if (!result.ok) {
        setError(previewActionError(result.error, errors))
        return
      }
      setNotes('')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={notesPlaceholder} rows={3} />
      {!canDecide && <p className="text-sm text-muted-foreground">{awaitingReview}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !canDecide} onClick={() => run('approve')}>
          {approveLabel}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run('changes')}>
          {changesLabel}
        </Button>
      </div>
    </div>
  )
}
