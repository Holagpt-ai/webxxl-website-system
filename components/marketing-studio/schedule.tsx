'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import { FormActions, GapNotice, PlainTable, SectionHeading, TextField, WorkspaceState } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime, isGateError, withQuery } from '@/lib/crm-ui/workspace'
import { MKT_API, type SocialCampaign, type SocialPublication } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { campaignDates } from './campaigns'
import { CAMPAIGN_TONE, PUBLICATION_TONE, flagBody } from './shared'

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

export function MarketingSchedule({ accountId, locale, copy, base }: MarketingViewProps) {
  const s = copy.schedule
  const kit = copy.kit
  const [from, setFrom] = useState(day(0))
  const [to, setTo] = useState(day(30))
  const [applied, setApplied] = useState({ from: day(0), to: day(30) })
  const validRange = Boolean(from && to && from <= to)

  const calendar = useWorkspace<{ campaigns: SocialCampaign[] }>(
    withQuery(MKT_API.calendar, { from: `${applied.from}T00:00:00.000Z`, to: `${applied.to}T23:59:59.999Z` }),
    accountId,
  )
  const publications = useWorkspace<{ publications: SocialPublication[] }>(MKT_API.publications, accountId)

  if (isGateError(calendar.error)) {
    return (
      <>
        <SectionHeading title={s.title} description={s.description} />
        <WorkspaceState error={calendar.error} kit={kit} workspace={copy.name} body={flagBody(calendar.error, copy.flags.social)} />
      </>
    )
  }

  const campaignGoal = new Map((calendar.data?.campaigns ?? []).map((c) => [c.id, c.goal]))

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={s.title} description={s.description} />
      <GapNotice title={copy.campaign.schedule} body={copy.flags.scheduleSocial} />

      <Section title={s.calendarTitle} description={s.calendarNote}>
        <form
          className="mb-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (validRange) setApplied({ from, to })
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
            <TextField label={s.from} type="date" value={from} onChange={setFrom} required />
            <TextField label={s.to} type="date" value={to} onChange={setTo} required />
          </div>
          {!validRange && (
            <p role="alert" className="text-sm text-destructive">
              {s.invalidRange}
            </p>
          )}
          <FormActions>
            <Button type="submit" variant="outline" size="sm" disabled={!validRange}>
              {s.apply}
            </Button>
          </FormActions>
        </form>
        {calendar.isLoading ? (
          <LoadingRows label={kit.loading} rows={3} />
        ) : calendar.error ? (
          <WorkspaceState error={calendar.error} kit={kit} workspace={copy.name} compact onRetry={() => calendar.mutate()} />
        ) : !calendar.data?.campaigns.length ? (
          <EmptyNote>{s.calendarEmpty}</EmptyNote>
        ) : (
          <PlainTable label={s.calendarTitle} headers={[s.campaign, copy.campaigns.dates, s.status]}>
            {calendar.data.campaigns.map((c) => (
              <tr key={c.id}>
                <td className={`${td} font-medium text-foreground`}>
                  <Link href={`${base}/campaigns/${c.id}`} className="underline-offset-4 hover:underline">
                    {c.goal}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap`}>{campaignDates(c, locale)}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.campaignStatus, c.status)} tone={CAMPAIGN_TONE[c.status] ?? 'muted'} />
                </td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>

      <Section title={s.publicationsTitle}>
        {publications.isLoading ? (
          <LoadingRows label={kit.loading} rows={3} />
        ) : publications.error ? (
          <WorkspaceState error={publications.error} kit={kit} workspace={copy.name} compact onRetry={() => publications.mutate()} />
        ) : !publications.data?.publications.length ? (
          <EmptyNote>{s.publicationsEmpty}</EmptyNote>
        ) : (
          <PlainTable label={s.publicationsTitle} headers={[s.campaign, s.channel, s.status, s.published, s.link]}>
            {publications.data.publications.map((p) => (
              <tr key={p.id}>
                <td className={td}>{campaignGoal.get(p.campaignId) ?? <span className="font-mono text-xs">{p.campaignId}</span>}</td>
                <td className={`${td} font-mono text-xs`}>{p.channelId}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.publicationStatus, p.status)} tone={PUBLICATION_TONE[p.status] ?? 'muted'} />
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(p.publishedAt, locale)}</td>
                <td className={td}>
                  {p.publishedUrl ? (
                    <a href={p.publishedUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {s.view}
                    </a>
                  ) : (
                    DASH
                  )}
                </td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}
