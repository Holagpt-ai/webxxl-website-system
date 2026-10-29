'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/dashboard/primitives'
import { LoadingRows, PlainTable, Section, StatusPill, selectClass, td } from '@/components/crm/workspace-kit'
import { enumLabel, fill, formatDateTime, withQuery } from '@/lib/crm-ui/workspace'
import { useComms, useCursorStack } from '@/lib/comms-ui/use-comms'
import {
  COMMS_API,
  COMMS_PAGE_SIZE,
  CONVERSATION_FILTERS,
  channelFromInboxType,
  isFilterableInbox,
  parseConversationFilter,
  type CommsInbox,
  type ConversationListResponse,
} from '@/lib/comms-ui/types'
import type { CommsViewProps } from '@/lib/comms-ui/server'
import { cn } from '@/lib/utils'
import { CommsGate, CursorPager, STATUS_TONE, SyncCell, isCommsGate } from './shared'

export function CommsInbox({ accountId, locale, copy, base, crmContactsBase }: CommsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const inboxSelectId = useId()
  const channelSelectId = useId()
  const c = copy.inbox

  const filter = parseConversationFilter(search.get('filter'))
  const inboxId = search.get('inbox') ?? ''
  const channel = search.get('channel') ?? ''
  const hasFilters = Boolean(filter || inboxId || channel)

  const inboxes = useComms<{ inboxes: CommsInbox[] }>(COMMS_API.inboxes, accountId)
  const verifiedInboxes = useMemo(() => (inboxes.data?.inboxes ?? []).filter(isFilterableInbox), [inboxes.data])

  const pages = useCursorStack([accountId, filter, inboxId, channel].join('|'))
  const list = useComms<ConversationListResponse>(
    withQuery(COMMS_API.conversations, { take: COMMS_PAGE_SIZE, filter, inboxId, channel, cursor: pages.cursor }),
    accountId,
  )

  const channelOptions = useMemo(() => {
    const set = new Set<string>()
    for (const inbox of verifiedInboxes) set.add(channelFromInboxType(inbox.channelType))
    for (const row of list.data?.conversations ?? []) set.add(row.channel)
    if (channel) set.add(channel)
    return [...set].sort()
  }, [verifiedInboxes, list.data, channel])

  function setParam(key: 'filter' | 'inbox' | 'channel', value: string) {
    const next = new URLSearchParams(search.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const clearFilters = () => router.replace(pathname, { scroll: false })

  if (list.error && isCommsGate(list.error)) return <CommsGate error={list.error} copy={copy} />
  if (inboxes.error && isCommsGate(inboxes.error)) return <CommsGate error={inboxes.error} copy={copy} />

  const rows = list.data?.conversations ?? []

  return (
    <Section title={c.title} description={c.description}>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label={c.filtersLabel} className="-mx-1 flex flex-wrap gap-2 px-1">
          {(['', ...CONVERSATION_FILTERS] as const).map((value) => {
            const active = filter === value
            return (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setParam('filter', value)}
                className={cn(
                  'inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {value ? enumLabel(copy.enums.filter, value) : c.filterAll}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inboxSelectId}>{c.inboxLabel}</Label>
            <select
              id={inboxSelectId}
              value={inboxId}
              disabled={inboxes.isLoading || Boolean(inboxes.error) || (!verifiedInboxes.length && !inboxId)}
              onChange={(e) => setParam('inbox', e.target.value)}
              className={selectClass}
            >
              <option value="">{verifiedInboxes.length ? c.inboxAll : c.inboxNone}</option>
              {verifiedInboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  {fill(c.inboxOption, {
                    id: inbox.externalInboxId,
                    channel: enumLabel(copy.enums.channel, channelFromInboxType(inbox.channelType)),
                  })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={channelSelectId}>{c.channelLabel}</Label>
            <select
              id={channelSelectId}
              value={channel}
              disabled={!channelOptions.length}
              onChange={(e) => setParam('channel', e.target.value)}
              className={selectClass}
            >
              <option value="">{c.channelAll}</option>
              {channelOptions.map((value) => (
                <option key={value} value={value}>
                  {enumLabel(copy.enums.channel, value)}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-end">
              {c.clearFilters}
            </Button>
          )}
        </div>
        {inboxes.error && <p className="text-xs text-muted-foreground">{c.inboxUnavailable}</p>}
      </div>

      {list.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={6} />
      ) : list.error?.kind === 'VALIDATION' ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted p-6">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <AlertCircle className="size-4" aria-hidden="true" />
            {c.invalid.title}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {pages.hasPrevious ? c.invalid.bodyCursor : c.invalid.bodyFilter}
          </p>
          <div className="flex flex-wrap gap-2">
            {pages.hasPrevious && (
              <Button size="sm" onClick={pages.first}>
                {c.invalid.backToFirst}
              </Button>
            )}
            {hasFilters && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                {c.clearFilters}
              </Button>
            )}
          </div>
        </div>
      ) : list.error ? (
        <CommsStateInline copy={copy} error={list.error} onRetry={() => list.mutate()} />
      ) : !rows.length ? (
        <InboxEmpty
          copy={copy}
          base={base}
          laterPage={pages.hasPrevious}
          filtered={hasFilters}
          noVerifiedInbox={Boolean(inboxes.data) && !verifiedInboxes.length}
          onFirst={pages.first}
        />
      ) : (
        <PlainTable
          label={c.tableLabel}
          headers={[
            c.columns.conversation,
            c.columns.status,
            c.columns.channel,
            c.columns.lastActivity,
            c.columns.lastSync,
            c.columns.contact,
            c.columns.coverage,
            c.columns.attention,
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className={cn(row.needsAttention && 'bg-muted')}>
              <td className={td}>
                <Link
                  href={`${base}/conversations/${encodeURIComponent(row.id)}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {fill(c.reference, { id: row.externalConversationId })}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{fill(c.inboxRef, { id: row.externalInboxId })}</p>
              </td>
              <td className={td}>
                <StatusPill label={enumLabel(copy.enums.status, row.webxxlStatus)} tone={STATUS_TONE[row.webxxlStatus] ?? 'neutral'} />
              </td>
              <td className={`${td} whitespace-nowrap`}>{enumLabel(copy.enums.channel, row.channel)}</td>
              <td className={`${td} whitespace-nowrap`}>
                {row.lastActivityAt ? formatDateTime(row.lastActivityAt, locale) : <span className="text-muted-foreground">{copy.sync.noActivity}</span>}
              </td>
              <td className={td}>
                <SyncCell lastSyncAt={row.lastSyncAt} syncStale={row.syncStale} locale={locale} copy={copy} />
              </td>
              <td className={`${td} whitespace-nowrap`}>
                {row.crmContactId ? (
                  <Link
                    href={`${crmContactsBase}/${encodeURIComponent(row.crmContactId)}`}
                    className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.openContact}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{c.notLinked}</span>
                )}
              </td>
              <td className={td}>
                <StatusPill label={enumLabel(copy.enums.coverage, row.coverageState)} tone="muted" />
              </td>
              <td className={td}>
                {row.needsAttention ? (
                  <StatusPill label={copy.enums.filter.needs_attention} tone="danger" />
                ) : (
                  <span className="text-muted-foreground">{c.attentionNone}</span>
                )}
              </td>
            </tr>
          ))}
        </PlainTable>
      )}

      {!list.error && !list.isLoading && (
        <CursorPager
          page={pages.page}
          hasPrevious={pages.hasPrevious}
          nextCursor={list.data?.nextCursor}
          count={rows.length}
          onFirst={pages.first}
          onPrevious={pages.previous}
          onNext={pages.next}
          copy={copy}
        />
      )}
    </Section>
  )
}

function CommsStateInline({
  copy,
  error,
  onRetry,
}: {
  copy: CommsViewProps['copy']
  error: NonNullable<ReturnType<typeof useComms>['error']>
  onRetry: () => void
}) {
  const state = copy.kit.states[error.kind]
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6">
      <p className="font-semibold text-foreground">{fill(state.title, { workspace: copy.name })}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{fill(state.body, { workspace: copy.name })}</p>
      {error.kind === 'ERROR' && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {copy.kit.retry}
        </Button>
      )}
    </div>
  )
}

function InboxEmpty({
  copy,
  base,
  laterPage,
  filtered,
  noVerifiedInbox,
  onFirst,
}: {
  copy: CommsViewProps['copy']
  base: string
  laterPage: boolean
  filtered: boolean
  noVerifiedInbox: boolean
  onFirst: () => void
}) {
  const c = copy.inbox
  if (laterPage) {
    return (
      <div className="flex flex-col items-center gap-3">
        <EmptyState title={c.emptyLaterPage.title} body={c.emptyLaterPage.body} />
        <Button variant="outline" size="sm" onClick={onFirst}>
          {c.invalid.backToFirst}
        </Button>
      </div>
    )
  }
  if (filtered) return <EmptyState title={c.emptyFiltered.title} body={c.emptyFiltered.body} />
  if (noVerifiedInbox) {
    return (
      <div className="flex flex-col items-center gap-3">
        <EmptyState title={c.emptyNoInbox.title} body={c.emptyNoInbox.body} />
        <Link href={`${base}/connections`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {c.viewConnections}
        </Link>
      </div>
    )
  }
  return <EmptyState title={c.emptyNone.title} body={c.emptyNone.body} />
}
