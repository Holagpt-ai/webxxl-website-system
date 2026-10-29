'use client'

import { Link2 } from 'lucide-react'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import { PlainTable, SectionHeading, UnavailableAction, WorkspaceState } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, formatDateTime, isGateError } from '@/lib/crm-ui/workspace'
import { MKT_API, type SocialConnection } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { CONNECTION_TONE, flagBody } from './shared'

export function MarketingConnections({ accountId, locale, copy }: MarketingViewProps) {
  const list = useWorkspace<{ connections: SocialConnection[] }>(MKT_API.connections, accountId)
  const c = copy.connections
  const kit = copy.kit

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title={c.title} description={c.description} />
        <div className="sm:max-w-xs">
          <UnavailableAction label={c.connect} reason={c.connectReason} icon={Link2} />
        </div>
      </div>
      {isGateError(list.error) ? (
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} body={flagBody(list.error, copy.flags.social)} />
      ) : (
        <Section title={c.tableLabel}>
          {list.isLoading ? (
            <LoadingRows label={kit.loading} rows={3} />
          ) : list.error ? (
            <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
          ) : !list.data?.connections.length ? (
            <EmptyNote>{c.empty}</EmptyNote>
          ) : (
            <PlainTable label={c.tableLabel} headers={[c.platform, c.name, c.state, c.verified]}>
              {list.data.connections.map((row) => (
                <tr key={row.id}>
                  <td className={`${td} font-medium text-foreground`}>{enumLabel(copy.enums.platform, row.platform)}</td>
                  <td className={td}>{row.displayName}</td>
                  <td className={td}>
                    <StatusPill
                      label={enumLabel(copy.enums.connectionState, row.connectionState)}
                      tone={CONNECTION_TONE[row.connectionState] ?? 'muted'}
                    />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.lastVerifiedAt, locale)}</td>
                </tr>
              ))}
            </PlainTable>
          )}
        </Section>
      )}
    </div>
  )
}
