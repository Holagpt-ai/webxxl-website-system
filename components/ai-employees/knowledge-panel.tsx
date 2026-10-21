'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  aiBase,
  aiMutate,
  useAi,
  withPage,
  type AiErrorCode,
  type AiKnowledgeItem,
  type AiRetrieval,
  type PageResult,
} from '@/lib/ai-employees-ui/client'
import { fill, formatDate } from '@/lib/commerce-ui/format'
import { AiPagination, AiState, EmptyNote, Field, LoadingRows, Section, StatusPill, TableFrame, knowledgeTone, localeLabel, selectClass, td, th } from './ui'
import type { WorkforceContext } from './workforce-view'

const PAGE = 10
const KINDS = ['FAQ', 'BUSINESS_INFO'] as const

export function KnowledgePanel({ ctx }: { ctx: WorkforceContext }) {
  const { copy, accountId, locale } = ctx
  const [skip, setSkip] = useState(0)
  const [editing, setEditing] = useState<AiKnowledgeItem | 'new' | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null)
  const base = `${aiBase(accountId)}/knowledge`
  const { data, error, isLoading, mutate } = useAi<PageResult<AiKnowledgeItem>>(withPage(base, PAGE, skip))
  const [previewLocale, setPreviewLocale] = useState(locale === 'es' ? 'es' : 'en')
  const preview = useAi<AiRetrieval>(`${aiBase(accountId)}/knowledge-retrieval?locale=${previewLocale}`)

  const approve = async (item: AiKnowledgeItem) => {
    setApproving(item.id)
    setFailure(null)
    const result = await aiMutate(`${base}/${encodeURIComponent(item.id)}/approve`, 'POST', {})
    setApproving(null)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    mutate()
    preview.mutate()
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={copy.knowledge.title}
        description={copy.knowledge.description}
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden="true" />
            {copy.knowledge.create}
          </Button>
        }
      >
        {error && !data ? (
          <AiState error={error} copy={copy} onRetry={() => mutate()} />
        ) : isLoading || !data ? (
          <LoadingRows label={copy.knowledge.loading} />
        ) : data.items.length === 0 ? (
          <EmptyNote>{copy.knowledge.empty}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
            <TableFrame label={copy.knowledge.title}>
              <thead>
                <tr>
                  <th className={th}>{copy.knowledge.titleField}</th>
                  <th className={th}>{copy.common.status}</th>
                  <th className={th}>{copy.common.language}</th>
                  <th className={th}>{copy.knowledge.revision}</th>
                  <th className={th}>
                    <span className="sr-only">{copy.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const locked = item.status === 'PUBLISHED' || item.status === 'ARCHIVED'
                  return (
                    <tr key={item.id} className="border-t align-top">
                      <td className={td}>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {copy.knowledge.kinds[item.kind] ?? item.kind}
                          {item.summary ? ` · ${item.summary}` : ''}
                        </p>
                      </td>
                      <td className={td}>
                        <StatusPill tone={knowledgeTone(item.status)} label={copy.knowledgeStatus[item.status] ?? item.status} />
                        {item.publishedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {copy.knowledge.published} {formatDate(item.publishedAt, locale)}
                          </p>
                        )}
                      </td>
                      <td className={td}>{localeLabel(copy, item.languageTag)}</td>
                      <td className={`${td} font-mono text-xs`}>
                        {item.currentRevisionNumber != null ? fill(copy.knowledge.revisionValue, { n: item.currentRevisionNumber }) : '—'}
                      </td>
                      <td className={`${td} text-right`}>
                        {locked ? (
                          <span className="text-xs text-muted-foreground">{copy.knowledge.immutable}</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                              {copy.knowledge.edit}
                              <span className="sr-only">: {item.title}</span>
                            </Button>
                            {item.status === 'IN_REVIEW' && (
                              <Button size="sm" disabled={approving !== null} onClick={() => approve(item)}>
                                {approving === item.id ? copy.knowledge.approving : copy.knowledge.approve}
                                <span className="sr-only">: {item.title}</span>
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </TableFrame>
            <AiPagination total={data.pagination.total} take={PAGE} skip={skip} onChange={setSkip} copy={copy} />
          </div>
        )}
      </Section>

      <Section
        title={copy.knowledge.previewTitle}
        description={copy.knowledge.previewDescription}
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="ai-preview-locale" className="sr-only">
              {copy.common.language}
            </label>
            <select id="ai-preview-locale" className={selectClass} value={previewLocale} onChange={(e) => setPreviewLocale(e.target.value)}>
              <option value="en">{copy.locales.en}</option>
              <option value="es">{copy.locales.es}</option>
            </select>
          </div>
        }
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.knowledge.previewExecution}</p>
        {preview.error && !preview.data ? (
          <AiState error={preview.error} copy={copy} onRetry={() => preview.mutate()} />
        ) : !preview.data ? (
          <LoadingRows rows={2} label={copy.knowledge.previewLoading} />
        ) : preview.data.chunks.length === 0 ? (
          <EmptyNote>{copy.knowledge.previewEmpty}</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {preview.data.chunks.map((chunk) => (
              <li key={`${chunk.knowledgePublicId}-${chunk.revisionNumber}`} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{chunk.title}</p>
                  <StatusPill tone="muted" label={copy.knowledge.kinds[chunk.kind] ?? chunk.kind} />
                  <span className="font-mono text-xs text-muted-foreground">{fill(copy.knowledge.revisionValue, { n: chunk.revisionNumber })}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{chunk.excerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <KnowledgeDialog
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        item={editing}
        ctx={ctx}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          mutate()
        }}
      />
    </div>
  )
}

function KnowledgeDialog({
  item,
  ctx,
  onClose,
  onSaved,
}: {
  item: AiKnowledgeItem | 'new' | null
  ctx: WorkforceContext
  onClose: () => void
  onSaved: () => void
}) {
  const { copy, accountId } = ctx
  const existing = item && item !== 'new' ? item : null
  const [kind, setKind] = useState<string>(existing?.kind ?? 'FAQ')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [summary, setSummary] = useState(existing?.summary ?? '')
  const [languageTag, setLanguageTag] = useState(existing?.languageTag ?? (ctx.locale === 'es' ? 'es' : 'en'))
  const [question, setQuestion] = useState('')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null)

  const save = async (status: 'DRAFT' | 'IN_REVIEW') => {
    if (!title.trim() || !body.trim()) {
      setFailure({ code: 'VALIDATION', detail: copy.knowledge.required })
      return
    }
    setPending(status)
    setFailure(null)
    const content = kind === 'FAQ' ? { question: question.trim() || title.trim(), answer: body.trim(), excerpt: body.trim() } : { body: body.trim(), excerpt: body.trim() }
    const result = await aiMutate(`${aiBase(accountId)}/knowledge`, 'POST', {
      knowledgeId: existing?.id,
      kind,
      title: title.trim(),
      summary: summary.trim() || null,
      languageTag,
      content,
      status,
    })
    setPending(null)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    onSaved()
  }

  const nextRevision = (existing?.currentRevisionNumber ?? 0) + 1

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? copy.knowledge.formEditTitle : copy.knowledge.formCreateTitle}</DialogTitle>
          <DialogDescription>{existing ? fill(copy.knowledge.formEditDescription, { n: nextRevision }) : copy.knowledge.description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save('DRAFT')
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Field id="ai-kn-kind" label={copy.knowledge.kind}>
                <select id="ai-kn-kind" className={selectClass} value={kind} disabled={existing !== null} onChange={(e) => setKind(e.target.value)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {copy.knowledge.kinds[k]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex-1">
              <Field id="ai-kn-lang" label={copy.common.language}>
                <select id="ai-kn-lang" className={selectClass} value={languageTag} onChange={(e) => setLanguageTag(e.target.value)}>
                  <option value="en">{copy.locales.en}</option>
                  <option value="es">{copy.locales.es}</option>
                </select>
              </Field>
            </div>
          </div>
          <Field id="ai-kn-title" label={copy.knowledge.titleField}>
            <Input id="ai-kn-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </Field>
          <Field id="ai-kn-summary" label={copy.knowledge.summaryField}>
            <Input id="ai-kn-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
          </Field>
          {kind === 'FAQ' && (
            <Field id="ai-kn-question" label={copy.knowledge.questionField}>
              <Input id="ai-kn-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} />
            </Field>
          )}
          <Field id="ai-kn-body" label={kind === 'FAQ' ? copy.knowledge.answerField : copy.knowledge.bodyField} hint={copy.knowledge.excerptHelp}>
            <Textarea id="ai-kn-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} required />
          </Field>
          {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.common.cancel}
            </Button>
            <Button type="submit" variant="secondary" disabled={pending !== null}>
              {pending === 'DRAFT' ? copy.common.saving : copy.knowledge.saveDraft}
            </Button>
            <Button type="button" disabled={pending !== null} onClick={() => save('IN_REVIEW')}>
              {pending === 'IN_REVIEW' ? copy.common.saving : copy.knowledge.saveReview}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
