'use client'

import Link from 'next/link'
import { ArrowLeft, Eye, MessageSquareOff, UserRound } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Facts, LoadingRows, Section, StatusPill, WorkspaceState } from '@/components/crm/workspace-kit'
import { enumLabel, fill, formatDateTime } from '@/lib/crm-ui/workspace'
import { useComms } from '@/lib/comms-ui/use-comms'
import { COMMS_API, type ConversationDetail } from '@/lib/comms-ui/types'
import type { CommsViewProps } from '@/lib/comms-ui/server'
import { CommsGate, STATUS_TONE, SyncCell, isCommsGate } from './shared'

export function CommsConversationDetail({
  accountId,
  locale,
  copy,
  base,
  crmContactsBase,
  conversationId,
}: CommsViewProps & { conversationId: string }) {
  const res = useComms<{ conversation: ConversationDetail }>(COMMS_API.conversation(conversationId), accountId)
  const d = copy.detail

  const backLink = (
    <Link
      href={base}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {d.back}
    </Link>
  )

  if (res.error && isCommsGate(res.error)) return <CommsGate error={res.error} copy={copy} />

  if (res.error) {
    const notFound = res.error.kind === 'NOT_FOUND'
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        {notFound ? (
          <WorkspaceState kind="NOT_FOUND" kit={{ ...copy.kit, states: { ...copy.kit.states, NOT_FOUND: d.notFound } }} workspace={copy.name} />
        ) : (
          <WorkspaceState error={res.error} kit={copy.kit} workspace={copy.name} onRetry={() => res.mutate()} />
        )}
      </div>
    )
  }

  if (res.isLoading || !res.data) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <LoadingRows label={copy.kit.loading} rows={5} />
      </div>
    )
  }

  const conv = res.data.conversation
  const title = fill(copy.inbox.reference, { id: conv.externalConversationId })

  return (
    <div className="flex flex-col gap-6">
      {backLink}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          <StatusPill label={enumLabel(copy.enums.status, conv.webxxlStatus)} tone={STATUS_TONE[conv.webxxlStatus] ?? 'neutral'} />
          <StatusPill label={enumLabel(copy.enums.priority, conv.priority)} tone="muted" />
          {conv.needsAttention && <StatusPill label={d.attentionYes} tone="danger" />}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5" aria-hidden="true" />
            {d.readOnly}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {enumLabel(copy.enums.channel, conv.channel)} · {fill(copy.inbox.inboxRef, { id: conv.externalInboxId })}
        </p>
      </header>

      {!conv.transcriptAvailable && (
        <div role="note" className="flex items-start gap-3 rounded-xl border bg-muted p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <MessageSquareOff className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">{d.transcript.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{d.transcript.body}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{d.transcript.noReply}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title={d.metadataTitle}>
            <Facts
              items={[
                [d.fields.conversationId, <span key="id" className="font-mono text-xs">{conv.externalConversationId}</span>],
                [d.fields.status, enumLabel(copy.enums.status, conv.webxxlStatus)],
                [d.fields.priority, enumLabel(copy.enums.priority, conv.priority)],
                [
                  d.fields.assignment,
                  conv.assignedUserRef ? fill(d.assignedRef, { ref: conv.assignedUserRef }) : d.unassigned,
                ],
                [d.fields.channel, enumLabel(copy.enums.channel, conv.channel)],
                [
                  d.fields.inbox,
                  conv.inboxMappingId ? (
                    <Link
                      key="inbox"
                      href={`${base}?inbox=${encodeURIComponent(conv.inboxMappingId)}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {fill(copy.inbox.inboxRef, { id: conv.externalInboxId })}
                    </Link>
                  ) : (
                    fill(copy.inbox.inboxRef, { id: conv.externalInboxId })
                  ),
                ],
                [d.fields.lastActivity, conv.lastActivityAt ? formatDateTime(conv.lastActivityAt, locale) : copy.sync.noActivity],
                [d.fields.coverage, enumLabel(copy.enums.coverage, conv.coverageState)],
                [d.fields.attention, conv.needsAttention ? d.attentionYes : d.attentionNo],
              ]}
            />
          </Section>

          <Section title={d.syncTitle}>
            <Facts
              items={[
                [
                  d.syncFields.lastSync,
                  <SyncCell key="sync" lastSyncAt={conv.lastSyncAt} syncStale={conv.syncStale} locale={locale} copy={copy} />,
                ],
                [
                  d.syncFields.syncState,
                  !conv.lastSyncAt ? copy.sync.unknownHint : conv.syncStale ? copy.sync.stale : copy.sync.current,
                ],
                [
                  d.syncFields.syncError,
                  conv.syncError ? <span key="err" className="font-mono text-xs">{conv.syncError}</span> : d.noSyncError,
                ],
                [
                  d.syncFields.provider,
                  <StatusPill
                    key="provider"
                    label={conv.providerConnected ? d.providerConnected : d.providerNotConnected}
                    tone={conv.providerConnected ? 'success' : 'muted'}
                  />,
                ],
                [d.syncFields.tenant, conv.tenantVerificationState ? enumLabel(copy.enums.verification, conv.tenantVerificationState) : copy.connections.notSet],
              ]}
            />
          </Section>
        </div>

        <Section title={d.contactTitle}>
          {conv.crmContact ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <p className={conv.crmContact.displayName ? 'font-medium text-foreground' : 'text-sm text-muted-foreground'}>
                  {conv.crmContact.displayName ?? d.contactUnnamed}
                </p>
              </div>
              <Link
                href={`${crmContactsBase}/${encodeURIComponent(conv.crmContact.id)}`}
                className={buttonVariants({ size: 'sm', className: 'self-start' })}
              >
                {d.openContact}
              </Link>
              <p className="text-xs leading-relaxed text-muted-foreground">{d.contactTimelineNote}</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{d.noContact}</p>
          )}
        </Section>
      </div>
    </div>
  )
}
