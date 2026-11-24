'use client'

import { EmptyNote, LoadingRows, Section, StatusPill, type PillTone } from '@/components/commerce/ui'
import { WorkspaceState } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, formatDateTime } from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  type SocialCampaignApproval,
  type SocialConnection,
  type SocialSchedulingIntent,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { flagBody } from './shared'

const STATUS_TONE: Record<string, PillTone> = {
  APPROVED: 'success',
  PENDING: 'info',
  SUBMITTED: 'info',
  REQUESTED: 'info',
  REJECTED: 'danger',
  EXPIRED: 'muted',
  REVOKED: 'muted',
  BLOCKED: 'danger',
  CANCELLED: 'muted',
}

function humanize(value: string) {
  const text = value.replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type PanelProps = Pick<MarketingViewProps, 'accountId' | 'locale' | 'copy'> & { campaignId: string }

function Row({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CampaignApprovalTimeline({ accountId, locale, copy, campaignId }: PanelProps) {
  const res = useWorkspace<{ approvals: SocialCampaignApproval[] }>(MKT_API.campaignApprovals(campaignId), accountId)
  const c = copy.campaign
  const rows = res.data?.approvals ?? []

  return (
    <Section title={c.approvalsTitle} description={c.approvalsBody}>
      {res.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={2} />
      ) : res.error ? (
        <WorkspaceState
          error={res.error}
          kit={copy.kit}
          workspace={copy.name}
          body={flagBody(res.error, copy.flags.social)}
          compact
          onRetry={() => res.mutate()}
        />
      ) : !rows.length ? (
        <EmptyNote>{c.approvalsEmpty}</EmptyNote>
      ) : (
        <ol className="flex flex-col divide-y">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <StatusPill label={humanize(a.status)} tone={STATUS_TONE[a.status] ?? 'muted'} />
              <Row
                items={[
                  [c.approvalRevision, <span key="r" className="font-mono text-xs break-all">{a.revisionId}</span>],
                  [c.approvalRequested, formatDateTime(a.createdAt, locale)],
                  [c.approvalDecided, a.decidedAt ? formatDateTime(a.decidedAt, locale) : DASH],
                  [c.approvalExpires, formatDateTime(a.expiresAt, locale)],
                ]}
              />
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

export function CampaignSchedulingStatus({
  accountId,
  locale,
  copy,
  campaignId,
  connections,
}: PanelProps & { connections: SocialConnection[] }) {
  const res = useWorkspace<{ intents: SocialSchedulingIntent[] }>(MKT_API.campaignScheduling(campaignId), accountId)
  const c = copy.campaign
  const rows = res.data?.intents ?? []
  const channelName = (id: string) => connections.find((x) => x.id === id)?.displayName ?? id

  return (
    <Section title={c.schedulingTitle} description={c.schedulingBody}>
      {res.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={2} />
      ) : res.error ? (
        <WorkspaceState
          error={res.error}
          kit={copy.kit}
          workspace={copy.name}
          body={flagBody(res.error, copy.flags.scheduleSocial)}
          compact
          onRetry={() => res.mutate()}
        />
      ) : !rows.length ? (
        <EmptyNote>{c.schedulingEmpty}</EmptyNote>
      ) : (
        <ol className="flex flex-col divide-y">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={humanize(s.status)} tone={STATUS_TONE[s.status] ?? 'info'} />
                {s.dispatchBlockedCode && (
                  <StatusPill label={`${c.schedulingBlocked}: ${humanize(s.dispatchBlockedCode)}`} tone="neutral" />
                )}
              </div>
              <Row
                items={[
                  [c.schedulingFor, formatDateTime(s.scheduledAt, locale)],
                  [c.schedulingChannel, <span key="ch" className="break-all">{channelName(s.channelId)}</span>],
                  [c.schedulingPublication, s.publicationStatus ? humanize(s.publicationStatus) : c.notPublished],
                ]}
              />
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
