'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill } from '@/components/commerce/ui'
import {
  Facts,
  FormActions,
  JsonBlock,
  SuccessNote,
  TextAreaField,
  TextField,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDateTime, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  type MarketingArtifact,
  type MarketingArtifactRevision,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { REVIEW_TONE, flagBody } from './shared'

type ArtifactResponse = { artifact: MarketingArtifact; revisions: MarketingArtifactRevision[] }

export function MarketingDeliverableDetail({ accountId, locale, copy, base, artifactId }: MarketingViewProps & { artifactId: string }) {
  const detail = useWorkspace<ArtifactResponse>(MKT_API.artifact(artifactId), accountId)
  const [reviewId, setReviewId] = useState('')
  const d = copy.deliverable
  const kit = copy.kit

  const back = (
    <Button asChild variant="ghost" size="sm" className="self-start">
      <Link href={`${base}/deliverables`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {d.back}
      </Link>
    </Button>
  )

  if (detail.isLoading) return <LoadingRows label={kit.loading} rows={4} />
  if (detail.error || !detail.data) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <WorkspaceState error={detail.error} kit={kit} workspace={copy.name} onRetry={() => detail.mutate()} />
      </div>
    )
  }

  const { artifact, revisions } = detail.data
  const latest = revisions[0]

  return (
    <div className="flex flex-col gap-6">
      {back}
      <Section title={enumLabel(copy.enums.artifactType, artifact.artifactType)} description={copy.flags.deterministic}>
        <div className="flex flex-col gap-4">
          <Facts
            items={[
              [
                copy.deliverables.review,
                <StatusPill
                  key="r"
                  label={enumLabel(copy.enums.reviewStatus, artifact.reviewStatus)}
                  tone={REVIEW_TONE[artifact.reviewStatus] ?? 'muted'}
                />,
              ],
              [copy.deliverables.generation, enumLabel(copy.enums.generation, artifact.generationMode)],
              [copy.requests.language, enumLabel(copy.enums.locale, artifact.locale)],
              [copy.deliverables.created, formatDateTime(artifact.createdAt, locale)],
              [d.hash, <span key="h" className="break-all font-mono text-xs">{artifact.revisionHash}</span>],
            ]}
          />
          <JsonBlock label={d.payload} value={artifact.payload} />
        </div>
      </Section>

      <Section title={d.revisionsTitle}>
        {!revisions.length ? (
          <EmptyNote>{d.revisionsEmpty}</EmptyNote>
        ) : (
          <ol className="flex flex-col gap-4">
            {revisions.map((rev) => (
              <li key={rev.id} className="flex flex-col gap-2 rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {fill(d.revision, { number: rev.revisionNumber })} · {formatDateTime(rev.createdAt, locale)}
                </p>
                <JsonBlock label={d.content} value={rev.structuredContent} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <RevisionForm
        key={latest?.id ?? 'none'}
        artifactId={artifactId}
        initial={latest?.structuredContent ?? artifact.payload}
        copy={copy}
        onSaved={() => detail.mutate()}
      />

      <SubmitReviewForm
        artifact={artifact}
        copy={copy}
        onSubmitted={(id) => {
          setReviewId(id)
          detail.mutate()
        }}
      />

      <DecideForm reviewId={reviewId} setReviewId={setReviewId} copy={copy} onDecided={() => detail.mutate()} />
    </div>
  )
}

function RevisionForm({
  artifactId,
  initial,
  copy,
  onSaved,
}: {
  artifactId: string
  initial: unknown
  copy: MarketingViewProps['copy']
  onSaved: () => void
}) {
  const d = copy.deliverable
  const [text, setText] = useState(() => JSON.stringify(initial ?? {}, null, 2))
  const [invalid, setInvalid] = useState(false)
  const action = useAction<{ revision?: { revisionNumber: number } }>()

  return (
    <Section title={d.addRevision} description={d.addRevisionBody}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            parsed = null
          }
          const isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
          setInvalid(!isObject)
          if (!isObject) return
          const result = await action.run(() => workspaceSend(MKT_API.revisions(artifactId), { structuredContent: parsed }))
          if (result.ok) onSaved()
        }}
      >
        <TextAreaField label={d.contentLabel} value={text} onChange={setText} rows={10} mono />
        {invalid && (
          <p role="alert" className="text-sm text-destructive">
            {d.invalidJson}
          </p>
        )}
        {action.data?.revision && <SuccessNote>{fill(d.revisionSaved, { number: action.data.revision.revisionNumber })}</SuccessNote>}
        {action.error && (
          <WorkspaceState
            error={action.error}
            kit={copy.kit}
            workspace={copy.name}
            body={flagBody(action.error, copy.flags.draftPreparation)}
            compact
          />
        )}
        <FormActions>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? copy.kit.saving : d.addRevision}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}

function SubmitReviewForm({
  artifact,
  copy,
  onSubmitted,
}: {
  artifact: MarketingArtifact
  copy: MarketingViewProps['copy']
  onSubmitted: (reviewId: string) => void
}) {
  const d = copy.deliverable
  const [intended, setIntended] = useState('')
  const [channel, setChannel] = useState('')
  const action = useAction<{ reviewId?: string; id?: string }>()
  const returnedId = action.data?.reviewId ?? action.data?.id

  return (
    <Section title={d.submitTitle} description={d.submitBody}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await action.run(() =>
            workspaceSend<{ reviewId?: string; id?: string }>(MKT_API.submitReview(artifact.id), {
              revisionHash: artifact.revisionHash,
              intendedAction: intended.trim(),
              allowedChannel: channel.trim() || undefined,
            }),
          )
          if (result.ok) {
            const id = result.data.reviewId ?? result.data.id
            if (id) onSubmitted(id)
          }
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label={d.intendedAction} hint={d.intendedHint} value={intended} onChange={setIntended} required />
          <TextField label={d.allowedChannel} value={channel} onChange={setChannel} />
        </div>
        {returnedId && <SuccessNote>{fill(d.submitted, { id: returnedId })}</SuccessNote>}
        {action.error && (
          <WorkspaceState
            error={action.error}
            kit={copy.kit}
            workspace={copy.name}
            body={flagBody(action.error, copy.flags.approval)}
            compact
          />
        )}
        <FormActions>
          <Button type="submit" disabled={action.pending || !intended.trim()}>
            {action.pending ? d.submitting : d.submit}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}

function DecideForm({
  reviewId,
  setReviewId,
  copy,
  onDecided,
}: {
  reviewId: string
  setReviewId: (id: string) => void
  copy: MarketingViewProps['copy']
  onDecided: () => void
}) {
  const d = copy.deliverable
  const action = useAction<unknown>()

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    const result = await action.run(() => workspaceSend(MKT_API.decide(reviewId.trim()), { decision }))
    if (result.ok) onDecided()
  }

  return (
    <Section title={d.decideTitle} description={d.decideBody}>
      <div className="flex flex-col gap-4">
        <div className="max-w-md">
          <TextField label={d.reviewId} value={reviewId} onChange={setReviewId} />
        </div>
        {action.data !== null && !action.error && !action.pending && <SuccessNote>{d.decided}</SuccessNote>}
        {action.error && (
          <WorkspaceState
            error={action.error}
            kit={copy.kit}
            workspace={copy.name}
            body={flagBody(action.error, copy.flags.approval)}
            compact
          />
        )}
        <FormActions>
          <Button disabled={action.pending || !reviewId.trim()} onClick={() => decide('APPROVED')}>
            {action.pending ? d.deciding : d.approve}
          </Button>
          <Button variant="outline" disabled={action.pending || !reviewId.trim()} onClick={() => decide('REJECTED')}>
            {d.reject}
          </Button>
        </FormActions>
      </div>
    </Section>
  )
}
