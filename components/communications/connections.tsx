'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'
import {
  EmptyNote,
  Facts,
  LoadingRows,
  PlainTable,
  Section,
  SectionHeading,
  StatTile,
  StatusPill,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { enumLabel, formatNumber } from '@/lib/crm-ui/workspace'
import { useComms } from '@/lib/comms-ui/use-comms'
import {
  COMMS_API,
  channelFromInboxType,
  connectionDisplayState,
  isFilterableInbox,
  type CommsConnections as Connections,
  type CommsInbox,
} from '@/lib/comms-ui/types'
import type { CommsViewProps } from '@/lib/comms-ui/server'
import { CONNECTION_TONE, CommsGate, SyncCell, VISIBILITY_TONE, isCommsGate } from './shared'

export function CommsConnections({ accountId, locale, copy, base }: CommsViewProps) {
  const conn = useComms<Connections>(COMMS_API.connections, accountId)
  const inboxes = useComms<{ inboxes: CommsInbox[] }>(COMMS_API.inboxes, accountId)
  const c = copy.connections

  if (conn.error && isCommsGate(conn.error)) return <CommsGate error={conn.error} copy={copy} />
  if (inboxes.error && isCommsGate(inboxes.error)) return <CommsGate error={inboxes.error} copy={copy} />

  const rows = inboxes.data?.inboxes ?? []
  const verified = rows.filter(isFilterableInbox).length
  const pendingOrRevoked = rows.filter((i) => i.visibilityState === 'MAPPING_PENDING' || i.visibilityState === 'DISCONNECTED').length
  const stale = rows.filter((i) => i.visibilityState === 'STALE_SYNC').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SectionHeading title={c.title} description={c.description} />
        <p className="-mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" />
          {c.readOnlyNote}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title={c.providerTitle} description={c.providerDescription}>
            {conn.isLoading ? (
              <LoadingRows label={copy.kit.loading} rows={3} />
            ) : conn.error || !conn.data ? (
              <WorkspaceState error={conn.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => conn.mutate()} />
            ) : (
              <ProviderStatus data={conn.data} copy={copy} />
            )}
          </Section>
        </div>
        <Section title={c.outboundTitle}>
          {conn.isLoading ? (
            <LoadingRows label={copy.kit.loading} rows={1} />
          ) : conn.data ? (
            <div className="flex flex-col items-start gap-3">
              <StatusPill
                label={enumLabel(copy.enums.outbound, conn.data.outbound.dataState)}
                tone={conn.data.outbound.enabled ? 'info' : 'muted'}
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {conn.data.outbound.enabled ? c.outboundBody.ENABLED : c.outboundBody.DISABLED}
              </p>
            </div>
          ) : null}
        </Section>
      </div>

      {inboxes.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label={c.tiles.verified} value={formatNumber(verified, locale)} hint={c.tiles.verifiedHint} />
          <StatTile label={c.tiles.pending} value={formatNumber(pendingOrRevoked, locale)} hint={c.tiles.pendingHint} />
          <StatTile label={c.tiles.stale} value={formatNumber(stale, locale)} hint={c.tiles.staleHint} />
        </div>
      )}

      <Section title={c.inboxesTitle} description={c.inboxesDescription}>
        {inboxes.isLoading ? (
          <LoadingRows label={copy.kit.loading} rows={3} />
        ) : inboxes.error ? (
          <WorkspaceState error={inboxes.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => inboxes.mutate()} />
        ) : !rows.length ? (
          <EmptyNote>{c.inboxesEmpty}</EmptyNote>
        ) : (
          <PlainTable
            label={c.inboxesTable}
            headers={[
              c.columns.inbox,
              c.columns.channel,
              c.columns.visibility,
              c.columns.verification,
              c.columns.tenant,
              c.columns.lastSync,
              c.columns.filter,
            ]}
          >
            {rows.map((inbox) => {
              const filterable = isFilterableInbox(inbox)
              return (
                <tr key={inbox.id}>
                  <td className={`${td} whitespace-nowrap font-medium text-foreground`}>
                    {`#${inbox.externalInboxId}`}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {enumLabel(copy.enums.channel, channelFromInboxType(inbox.channelType))}
                  </td>
                  <td className={td}>
                    <StatusPill
                      label={enumLabel(copy.enums.visibility, inbox.visibilityState)}
                      tone={VISIBILITY_TONE[inbox.visibilityState] ?? 'muted'}
                    />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{enumLabel(copy.enums.verification, inbox.verificationState)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {inbox.tenantRevoked
                      ? c.revoked
                      : inbox.tenantVerificationState
                        ? enumLabel(copy.enums.verification, inbox.tenantVerificationState)
                        : c.notSet}
                  </td>
                  <td className={td}>
                    <SyncCell lastSyncAt={inbox.lastSyncAt} syncStale={inbox.syncStale} locale={locale} copy={copy} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {filterable ? (
                      <Link
                        href={`${base}?inbox=${encodeURIComponent(inbox.id)}`}
                        className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {c.filterAvailable}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{c.filterUnavailable}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function ProviderStatus({ data, copy }: { data: Connections; copy: CommsViewProps['copy'] }) {
  const c = copy.connections
  const state = connectionDisplayState(data.chatwoot)
  const yesNo = (v: boolean) => (v ? c.yes : c.no)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-2">
        <StatusPill label={enumLabel(copy.enums.connection, state)} tone={CONNECTION_TONE[state] ?? 'muted'} />
        <p className="text-sm leading-relaxed text-muted-foreground">{c.stateBody[state]}</p>
      </div>
      {state !== 'NOT_CONNECTED' && (
        <Facts
          items={[
            [
              c.facts.tenant,
              data.chatwoot.verificationState ? enumLabel(copy.enums.verification, data.chatwoot.verificationState) : c.notSet,
            ],
            [c.facts.verifiedInboxes, String(data.chatwoot.verifiedInboxCount)],
            [c.facts.authorizedInboxes, String(data.chatwoot.authorizedInboxCount)],
            [c.facts.mappingPending, yesNo(data.chatwoot.mappingPending)],
            [c.facts.staleRisk, yesNo(data.chatwoot.staleSyncRisk)],
          ]}
        />
      )}
    </div>
  )
}
