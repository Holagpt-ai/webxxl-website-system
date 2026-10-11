'use client'

import { useState, useTransition } from 'react'
import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'
import {
  discardManagedSiteAiDraftAction,
  generateManagedSiteAiDraftAction,
  submitContentEditDirectToWebxxlAction,
  submitManagedSiteAiDraftForReviewAction,
} from '@/lib/managed-sites/customer-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type SiteAiContentDraftDict = {
  aiContentHelper: string
  aiGenerateDraft: string
  aiDraftTitle: string
  aiDraftSummary: string
  aiDraftProposedChanges: string
  aiDraftLocation: string
  aiDraftAction: string
  aiDraftProposedText: string
  aiDraftNotes: string
  aiDraftAssumptions: string
  aiDraftQuestions: string
  aiSubmitForReview: string
  aiDiscardDraft: string
  aiSendDirectToWebxxl: string
  aiDraftStatusDraft: string
  aiNotConfigured: string
  aiUnavailable: string
  aiInvalidOutput: string
  aiDraftGenerated: string
  aiDraftSubmitted: string
  aiDraftDiscarded: string
  aiDirectSubmitted: string
  projectRequired: string
  aiAvailableLabel: string
  aiUnavailableLabel: string
  siteRequestPlaceholder: string
}

const ACTION_LABEL: Record<AiContentDraftV1['proposedChanges'][number]['action'], string> = {
  replace: 'Replace',
  rewrite: 'Rewrite',
  add: 'Add',
  remove: 'Remove',
}

export function SiteAiContentDraft({
  siteId,
  locale,
  aiConfigured,
  initialDraft,
  dict,
}: {
  siteId: string
  locale: 'en' | 'es'
  aiConfigured: boolean
  initialDraft: { changeId: string; requestText: string; draft: AiContentDraftV1 } | null
  dict: SiteAiContentDraftDict
}) {
  const [requestText, setRequestText] = useState(initialDraft?.requestText ?? '')
  const [activeDraft, setActiveDraft] = useState(initialDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function mapAiError(code: string): string {
    if (code === 'ai_not_configured') return dict.aiNotConfigured
    if (code === 'ai_unavailable') return dict.aiUnavailable
    if (code === 'ai_invalid_output') return dict.aiInvalidOutput
    if (code === 'project_required') return dict.projectRequired
    return dict.aiUnavailable
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">{dict.aiContentHelper}</p>
      <p className="text-xs text-muted-foreground">
        {aiConfigured ? dict.aiAvailableLabel : dict.aiUnavailableLabel}
      </p>

      {!activeDraft && (
        <div className="space-y-3">
          <div>
            <Label htmlFor={`ai-content-request-${siteId}`}>Describe your change</Label>
            <Textarea
              id={`ai-content-request-${siteId}`}
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              rows={4}
              placeholder={dict.siteRequestPlaceholder}
              className="mt-1 w-full min-w-0"
              disabled={pending}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !requestText.trim() || !aiConfigured}
              onClick={() => {
                setError(null)
                setMessage(null)
                startTransition(async () => {
                  const result = await generateManagedSiteAiDraftAction(siteId, requestText, locale)
                  if (!result.ok) {
                    setError(mapAiError(result.error))
                    return
                  }
                  setActiveDraft({ changeId: result.changeId, requestText: requestText.trim(), draft: result.draft })
                  setMessage(dict.aiDraftGenerated)
                })
              }}
            >
              {dict.aiGenerateDraft}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !requestText.trim()}
              onClick={() => {
                setError(null)
                setMessage(null)
                startTransition(async () => {
                  const result = await submitContentEditDirectToWebxxlAction(siteId, requestText)
                  if (!result.ok) {
                    setError(mapAiError(result.error))
                    return
                  }
                  setRequestText('')
                  setMessage(dict.aiDirectSubmitted)
                })
              }}
            >
              {dict.aiSendDirectToWebxxl}
            </Button>
          </div>
        </div>
      )}

      {activeDraft && (
        <section className="space-y-4 rounded-lg border bg-background p-4" aria-labelledby={`ai-draft-${siteId}`}>
          <div>
            <h3 id={`ai-draft-${siteId}`} className="text-sm font-semibold">
              {dict.aiDraftTitle}
            </h3>
            <p className="text-xs text-muted-foreground">{dict.aiDraftStatusDraft}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dict.aiDraftSummary}</p>
            <p className="mt-1 text-sm">{activeDraft.draft.summary}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dict.aiDraftProposedChanges}</p>
            <ul className="mt-2 space-y-3">
              {activeDraft.draft.proposedChanges.map((change, index) => (
                <li key={`${change.location}-${index}`} className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="font-medium">{dict.aiDraftLocation}:</span> {change.location}
                  </p>
                  <p>
                    <span className="font-medium">{dict.aiDraftAction}:</span> {ACTION_LABEL[change.action]}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    <span className="font-medium">{dict.aiDraftProposedText}:</span> {change.proposedText}
                  </p>
                  {change.notes && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium">{dict.aiDraftNotes}:</span> {change.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {activeDraft.draft.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dict.aiDraftAssumptions}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {activeDraft.draft.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {activeDraft.draft.clarifyingQuestions.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dict.aiDraftQuestions}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {activeDraft.draft.clarifyingQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const result = await submitManagedSiteAiDraftForReviewAction(activeDraft.changeId)
                  if (!result.ok) {
                    setError(mapAiError(result.error))
                    return
                  }
                  setActiveDraft(null)
                  setRequestText('')
                  setMessage(dict.aiDraftSubmitted)
                })
              }}
            >
              {dict.aiSubmitForReview}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const result = await discardManagedSiteAiDraftAction(activeDraft.changeId)
                  if (!result.ok) {
                    setError(mapAiError(result.error))
                    return
                  }
                  setActiveDraft(null)
                  setMessage(dict.aiDraftDiscarded)
                })
              }}
            >
              {dict.aiDiscardDraft}
            </Button>
          </div>
        </section>
      )}

      {(message || error) && (
        <p className="text-sm text-muted-foreground" role="status">
          {error ?? message}
        </p>
      )}

      {!activeDraft && error && aiConfigured && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !requestText.trim()}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await submitContentEditDirectToWebxxlAction(siteId, requestText)
              if (!result.ok) {
                setError(mapAiError(result.error))
                return
              }
              setRequestText('')
              setMessage(dict.aiDirectSubmitted)
            })
          }}
        >
          {dict.aiSendDirectToWebxxl}
        </Button>
      )}
    </div>
  )
}
