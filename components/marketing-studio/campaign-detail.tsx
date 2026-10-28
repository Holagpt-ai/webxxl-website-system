'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, CheckCircle2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill } from '@/components/commerce/ui'
import {
  Facts,
  FormActions,
  SuccessNote,
  TextAreaField,
  UnavailableAction,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, asStringArray, enumLabel, fill, formatDateTime, workspaceSend } from '@/lib/crm-ui/workspace'
import { MKT_API, type SocialCampaign, type SocialConnection } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { campaignDates } from './campaigns'
import { CAMPAIGN_TONE, flagBody } from './shared'

/** There is no single-campaign GET yet, so the detail reads from the account's campaign list. */
export function MarketingCampaignDetail({ accountId, locale, copy, base, campaignId }: MarketingViewProps & { campaignId: string }) {
  const list = useWorkspace<{ campaigns: SocialCampaign[] }>(MKT_API.campaigns, accountId)
  const connections = useWorkspace<{ connections: SocialConnection[] }>(MKT_API.connections, accountId)
  const c = copy.campaign
  const kit = copy.kit

  const back = (
    <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })} href={`${base}/campaigns`}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {c.back}
      </Link>
  )

  if (list.isLoading) return <LoadingRows label={kit.loading} rows={4} />
  if (list.error) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <WorkspaceState
          error={list.error}
          kit={kit}
          workspace={copy.name}
          body={flagBody(list.error, copy.flags.social)}
          onRetry={() => list.mutate()}
        />
      </div>
    )
  }

  const campaign = list.data?.campaigns.find((x) => x.id === campaignId)
  if (!campaign) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <WorkspaceState kind="NOT_FOUND" kit={kit} workspace={copy.name} body={c.notFound} />
      </div>
    )
  }

  const live = (connections.data?.connections ?? []).filter((x) => x.connectionState === 'CONNECTED')

  return (
    <div className="flex flex-col gap-6">
      {back}
      <Section title={campaign.goal}>
        <Facts
          items={[
            [
              copy.campaigns.status,
              <StatusPill
                key="s"
                label={enumLabel(copy.enums.campaignStatus, campaign.status)}
                tone={CAMPAIGN_TONE[campaign.status] ?? 'muted'}
              />,
            ],
            [
              copy.campaigns.platforms,
              asStringArray(campaign.targetPlatforms)
                .map((p) => enumLabel(copy.enums.platform, p))
                .join(', ') || DASH,
            ],
            [copy.campaigns.audience, campaign.targetAudience ?? DASH],
            [copy.campaigns.language, enumLabel(copy.enums.locale, campaign.locale)],
            [copy.campaigns.dates, campaignDates(campaign, locale)],
            [copy.campaigns.updated, formatDateTime(campaign.updatedAt, locale)],
            [c.activeRevision, campaign.activeRevisionId ?? DASH],
            [c.approvedRevision, campaign.approvedRevisionId ?? DASH],
          ]}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2">
          <UnavailableAction label={c.approve} reason={copy.flags.approveSocial} icon={CheckCircle2} />
          <UnavailableAction label={c.schedule} reason={copy.flags.scheduleSocial} icon={CalendarClock} />
        </div>
      </Section>

      <Section title={c.revisionTitle} description={c.revisionBody}>
        {connections.isLoading ? (
          <LoadingRows label={kit.loading} rows={2} />
        ) : connections.error ? (
          <WorkspaceState error={connections.error} kit={kit} workspace={copy.name} compact onRetry={() => connections.mutate()} />
        ) : !live.length ? (
          <EmptyNote>{c.noChannels}</EmptyNote>
        ) : (
          <RevisionForm campaignId={campaign.id} channels={live} copy={copy} onSaved={() => list.mutate()} />
        )}
      </Section>
    </div>
  )
}

function RevisionForm({
  campaignId,
  channels,
  copy,
  onSaved,
}: {
  campaignId: string
  channels: SocialConnection[]
  copy: MarketingViewProps['copy']
  onSaved: () => void
}) {
  const c = copy.campaign
  const [captionEn, setCaptionEn] = useState('')
  const [captionEs, setCaptionEs] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const action = useAction<{ revision?: { revisionNumber?: number } }>()

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const result = await action.run(() =>
          workspaceSend(MKT_API.campaignRevisions(campaignId), {
            captionEn: captionEn.trim(),
            captionEs: captionEs.trim() || undefined,
            targetChannelIds: selected,
          }),
        )
        if (result.ok) onSaved()
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextAreaField label={c.captionEn} value={captionEn} onChange={setCaptionEn} required />
        <TextAreaField label={c.captionEs} value={captionEs} onChange={setCaptionEs} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">{c.channels}</legend>
        <p className="text-xs text-muted-foreground">{c.channelsHint}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {channels.map((ch) => (
            <label key={ch.id} className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(ch.id)}
                onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, ch.id] : prev.filter((x) => x !== ch.id)))}
              />
              {enumLabel(copy.enums.platform, ch.platform)} · {ch.displayName}
            </label>
          ))}
        </div>
      </fieldset>
      {action.data?.revision && <SuccessNote>{fill(c.saved, { number: action.data.revision.revisionNumber ?? 1 })}</SuccessNote>}
      {action.error && (
        <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} body={flagBody(action.error, copy.flags.social)} compact />
      )}
      <FormActions>
        <Button type="submit" disabled={action.pending || !captionEn.trim() || !selected.length}>
          {action.pending ? copy.kit.saving : c.revisionTitle}
        </Button>
      </FormActions>
    </form>
  )
}
