'use client'

import { useState } from 'react'
import { MessageSquareOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  aiBase,
  aiMutate,
  useAi,
  withPage,
  type AiConversationDetail,
  type AiEmployee,
  type AiErrorCode,
  type AiSession,
  type PageResult,
} from '@/lib/ai-employees-ui/client'
import { formatDate } from '@/lib/commerce-ui/format'
import { AiPagination, AiState, EmptyNote, Field, LoadingRows, Notice, Section, StatusPill, TableFrame, localeLabel, sessionTone, td, th } from './ui'
import type { WorkforceContext } from './workforce-view'

const PAGE = 10

export function ConversationsPanel({ ctx }: { ctx: WorkforceContext }) {
  const { copy, accountId, locale } = ctx
  const [skip, setSkip] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useAi<PageResult<AiSession>>(withPage(`${aiBase(accountId)}/conversations`, PAGE, skip))
  const employees = useAi<PageResult<AiEmployee>>(withPage(`${aiBase(accountId)}/employees`, 100, 0))
  const employeeName = (id: string | null) => (id ? employees.data?.items.find((e) => e.id === id)?.displayName ?? copy.conversations.employee : copy.conversations.unassigned)

  return (
    <Section title={copy.conversations.title} description={copy.conversations.description}>
      <div className="flex flex-col gap-4">
        <Notice icon={MessageSquareOff} title={copy.conversations.liveOff} body={copy.conversations.description} />
        {error && !data ? (
          <AiState error={error} copy={copy} onRetry={() => mutate()} />
        ) : isLoading || !data ? (
          <LoadingRows label={copy.conversations.loading} />
        ) : data.items.length === 0 ? (
          <EmptyNote>{copy.conversations.empty}</EmptyNote>
        ) : (
          <>
            <TableFrame label={copy.conversations.title}>
              <thead>
                <tr>
                  <th className={th}>{copy.conversations.visitor}</th>
                  <th className={th}>{copy.common.status}</th>
                  <th className={th}>{copy.conversations.employee}</th>
                  <th className={th}>{copy.conversations.lastMessage}</th>
                  <th className={th}>
                    <span className="sr-only">{copy.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((session) => (
                  <tr key={session.id} className="border-t">
                    <td className={td}>
                      <p className="font-medium text-foreground">{session.visitorRef ?? copy.conversations.anonymous}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {session.publicId}
                        {session.visitorLocale ? ` · ${localeLabel(copy, session.visitorLocale)}` : ''}
                      </p>
                    </td>
                    <td className={td}>
                      <StatusPill tone={sessionTone(session.status)} label={copy.sessionStatus[session.status] ?? session.status} />
                    </td>
                    <td className={td}>{employeeName(session.employeeId)}</td>
                    <td className={td}>{session.lastMessageAt ? formatDate(session.lastMessageAt, locale) : copy.conversations.noMessages}</td>
                    <td className={`${td} text-right`}>
                      <Button variant="outline" size="sm" onClick={() => setSelected(session.id)}>
                        {copy.conversations.view}
                        <span className="sr-only">: {session.publicId}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <AiPagination total={data.pagination.total} take={PAGE} skip={skip} onChange={setSkip} copy={copy} />
          </>
        )}
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{copy.conversations.detailTitle}</SheetTitle>
            <SheetDescription>{copy.conversations.liveOff}</SheetDescription>
          </SheetHeader>
          {selected && <ConversationDetail sessionId={selected} ctx={ctx} employeeName={employeeName} onChanged={() => mutate()} />}
        </SheetContent>
      </Sheet>
    </Section>
  )
}

function ConversationDetail({
  sessionId,
  ctx,
  employeeName,
  onChanged,
}: {
  sessionId: string
  ctx: WorkforceContext
  employeeName: (id: string | null) => string
  onChanged: () => void
}) {
  const { copy, accountId, locale } = ctx
  const url = `${aiBase(accountId)}/conversations/${encodeURIComponent(sessionId)}`
  const { data, error, isLoading, mutate } = useAi<AiConversationDetail>(url)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null)
  const [done, setDone] = useState(false)

  if (error && !data) return <div className="p-4"><AiState error={error} copy={copy} onRetry={() => mutate()} /></div>
  if (isLoading || !data) return <div className="p-4"><LoadingRows rows={3} label={copy.common.loading} /></div>

  const { session, handoffs } = data
  const openHandoff = handoffs.some((h) => h.status === 'REQUESTED' || h.status === 'ASSIGNED' || h.status === 'ACCEPTED')
  const canHandoff = session.status !== 'CLOSED' && !openHandoff

  const requestHandoff = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setFailure(null)
    const result = await aiMutate(`${url}/handoffs`, 'POST', { reason: reason.trim() || undefined })
    setPending(false)
    if (!result.ok) return setFailure({ code: result.code, detail: result.detail })
    setReason('')
    setDone(true)
    mutate()
    onChanged()
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{copy.conversations.visitor}</dt>
          <dd className="text-foreground">{session.visitorRef ?? copy.conversations.anonymous}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.common.status}</dt>
          <dd>
            <StatusPill tone={sessionTone(session.status)} label={copy.sessionStatus[session.status] ?? session.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.conversations.employee}</dt>
          <dd className="text-foreground">{employeeName(session.employeeId)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.common.language}</dt>
          <dd className="text-foreground">{session.visitorLocale ? localeLabel(copy, session.visitorLocale) : copy.common.none}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.common.reference}</dt>
          <dd className="font-mono text-xs text-foreground">{session.publicId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{copy.common.created}</dt>
          <dd className="text-foreground">{formatDate(session.createdAt, locale)}</dd>
        </div>
      </dl>

      <section aria-labelledby="ai-conv-messages" className="flex flex-col gap-2">
        <h3 id="ai-conv-messages" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.conversations.messages}
        </h3>
        <EmptyNote>{copy.conversations.messagesUnavailable}</EmptyNote>
      </section>

      <section aria-labelledby="ai-conv-handoffs" className="flex flex-col gap-3">
        <h3 id="ai-conv-handoffs" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.conversations.handoffs}
        </h3>
        {handoffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.conversations.handoffsEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {handoffs.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill tone={h.status === 'COMPLETED' ? 'success' : h.status === 'CANCELLED' ? 'muted' : 'info'} label={copy.handoffStatus[h.status] ?? h.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(h.createdAt, locale)}</span>
                </div>
                {h.reason && <p className="text-sm leading-relaxed text-foreground">{h.reason}</p>}
                {h.assignedUserId && <p className="text-xs text-muted-foreground">{copy.conversations.assignedTo}</p>}
              </li>
            ))}
          </ul>
        )}

        {canHandoff && (
          <form onSubmit={requestHandoff} className="flex flex-col gap-3 rounded-lg border p-3">
            <Field id="ai-handoff-reason" label={copy.conversations.handoffReason} hint={copy.conversations.handoffNote}>
              <Textarea
                id="ai-handoff-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={copy.conversations.handoffReasonPlaceholder}
                rows={3}
                maxLength={1000}
              />
            </Field>
            {failure && <AiState compact code={failure.code} detail={failure.detail} copy={copy} />}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? copy.common.saving : copy.conversations.handoffSubmit}
              </Button>
            </div>
          </form>
        )}
        <span role="status" className="text-sm text-muted-foreground">
          {done ? copy.conversations.handoffRequested : ''}
        </span>
      </section>
    </div>
  )
}
