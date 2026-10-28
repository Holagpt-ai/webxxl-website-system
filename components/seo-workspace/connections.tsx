'use client'

import {
  EmptyNote,
  LoadingRows,
  PlainTable,
  Section,
  StatusPill,
  UnavailableAction,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime } from '@/lib/crm-ui/workspace'
import { SEO_API, type SeoConnection } from '@/lib/seo-workspace-ui/types'
import type { SeoViewProps } from '@/lib/seo-workspace-ui/server'
import { DATA_TONE, SiteBar, useSelectedSite } from './shared'

export function SeoConnectionsView({ accountId, locale, copy, sites }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const res = useWorkspace<{ connections: SeoConnection[] }>(siteId ? SEO_API.connections(siteId) : null, accountId)
  const c = copy.connections
  const kit = copy.kit

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      <Section title={c.title} description={c.body} action={<UnavailableAction label={c.connect} reason={c.connectReason} />}>
        {res.isLoading ? (
          <LoadingRows label={kit.loading} rows={3} />
        ) : res.error ? (
          <WorkspaceState error={res.error} kit={kit} workspace={copy.name} compact onRetry={() => res.mutate()} />
        ) : !res.data?.connections.length ? (
          <EmptyNote>{c.none}</EmptyNote>
        ) : (
          <PlainTable label={c.title} headers={[c.provider, c.property, c.kind, c.verification, c.state, c.verified, c.revoked]}>
            {res.data.connections.map((row) => (
              <tr key={row.id}>
                <td className={td}>{row.provider}</td>
                <td className={`${td} break-all`}>{row.propertyRef ?? DASH}</td>
                <td className={td}>{row.propertyKind ?? DASH}</td>
                <td className={td}>{row.verificationState}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.dataStates, row.dataState)} tone={DATA_TONE[row.dataState] ?? 'muted'} />
                </td>
                <td className={td}>{formatDateTime(row.lastVerifiedAt, locale)}</td>
                <td className={td}>{formatDateTime(row.revokedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </SiteBar>
  )
}
