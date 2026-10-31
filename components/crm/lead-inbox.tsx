'use client'

import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { LineChart } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingRows, SectionHeading, SelectField, TextField } from './workspace-kit'
import { LeadIssueState, LeadStatusPill } from './lead-shared'
import { LeadSummary } from './lead-summary'
import { LeadDetail } from './lead-detail'
import type { CrmLeadsViewProps } from '@/lib/crm-ui/server'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  GATE_ISSUES,
  LEAD_LIST_TAKE,
  LEAD_STATUSES,
  LEADS_API,
  dayEndIso,
  dayStartIso,
  leadIssue,
  shouldRefreshSiteLeadCache,
  type LeadListResponse,
  type LeadSummaryResponse,
  type SiteLead,
} from '@/lib/crm-ui/leads'
import { formatDateTime, withQuery } from '@/lib/crm-ui/workspace'
import { cn } from '@/lib/utils'

export function CrmLeadInbox({ accountId, locale, copy, base, leadsCopy: lc, sites }: CrmLeadsViewProps) {
  const [status, setStatus] = useState('')
  const [siteId, setSiteId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<{ accountId: string; id: string } | null>(null)
  const selectedId = selected?.accountId === accountId ? selected.id : null
  const detailRef = useRef<HTMLDivElement>(null)

  // Cursors belong to one filter set; changing a filter or account starts again at page one.
  const filterKey = `${accountId}|${status}|${siteId}|${from}|${to}`
  const [pager, setPager] = useState({ key: filterKey, cursors: [] as string[] })
  const cursors = pager.key === filterKey ? pager.cursors : []
  const cursor = cursors.at(-1) ?? null

  const summary = useWorkspace<LeadSummaryResponse>(withQuery(LEADS_API.summary, { managedSiteId: siteId || null }), accountId)
  const list = useWorkspace<LeadListResponse>(
    withQuery(LEADS_API.list, {
      managedSiteId: siteId || null,
      status: status || null,
      createdFrom: dayStartIso(from),
      createdTo: dayEndIso(to),
      cursor,
      take: LEAD_LIST_TAKE,
    }),
    accountId,
  )

  const { mutate } = useSWRConfig()
  const refreshSurfaces = useCallback(
    async (leadId?: string | null) => {
      await mutate((key) => shouldRefreshSiteLeadCache(key, accountId, leadId ?? selectedId))
    },
    [mutate, accountId, selectedId],
  )

  const siteNames = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites])
  const siteLabel = (id: string) => siteNames.get(id) ?? id

  const filtered = Boolean(status || siteId || from || to)
  const gate = [summary.error, list.error].find((e) => e && GATE_ISSUES.has(leadIssue(e)))

  function select(lead: SiteLead) {
    setSelected({ accountId, id: lead.id })
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  function clearFilters() {
    setStatus('')
    setSiteId('')
    setFrom('')
    setTo('')
  }

  if (gate) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading title={lc.title} description={lc.description} />
          <Link
            href={`${base}/leads/funnel`}
            className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LineChart className="size-4 text-muted-foreground" aria-hidden="true" />
            {lc.funnelLink}
          </Link>
        </div>
        <LeadIssueState error={gate} lc={lc} />
      </div>
    )
  }

  const leads = list.data?.leads ?? []
  const nextCursor = list.data?.nextCursor

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title={lc.title} description={lc.description} />
        <Link
          href={`${base}/leads/funnel`}
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LineChart className="size-4 text-muted-foreground" aria-hidden="true" />
          {lc.funnelLink}
        </Link>
      </div>

      <LeadSummary
        data={summary.data}
        error={summary.error}
        isLoading={summary.isLoading}
        locale={locale}
        lc={lc}
        retryLabel={copy.kit.retry}
        siteScoped={Boolean(siteId)}
        onRetry={() => summary.mutate()}
      />

      <form
        aria-label={lc.filters.label}
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <SelectField
          label={lc.filters.status}
          value={status}
          onChange={setStatus}
          options={[{ value: '', label: lc.filters.allStatuses }, ...LEAD_STATUSES.map((s) => ({ value: s, label: lc.statuses[s] }))]}
        />
        <SelectField
          label={lc.filters.site}
          value={siteId}
          onChange={setSiteId}
          options={[{ value: '', label: lc.filters.allSites }, ...sites.map((s) => ({ value: s.id, label: s.domain ? `${s.name} (${s.domain})` : s.name }))]}
        />
        <TextField label={lc.filters.from} type="date" value={from} onChange={setFrom} />
        <TextField label={lc.filters.to} type="date" value={to} onChange={setTo} />
        <Button type="button" variant="ghost" size="sm" disabled={!filtered} onClick={clearFilters} className="justify-self-start">
          {lc.filters.clear}
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <section aria-labelledby="lead-list-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="lead-list-title" className="text-lg font-semibold tracking-tight text-foreground">
            {lc.list.title}
          </h2>
          {list.error ? (
            <LeadIssueState
              error={list.error}
              lc={lc}
              retryLabel={copy.kit.retry}
              onRetry={() => (cursor ? setPager({ key: filterKey, cursors: [] }) : list.mutate())}
            />
          ) : !list.data ? (
            <LoadingRows rows={5} label={lc.list.loading} />
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted px-6 py-10 text-center">
              <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium text-foreground">{(filtered ? lc.list.emptyFiltered : lc.list.emptyAll).title}</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {(filtered ? lc.list.emptyFiltered : lc.list.emptyAll).body}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2" aria-busy={list.isValidating}>
              {leads.map((lead) => (
                <li key={lead.id}>
                  <LeadRow
                    lead={lead}
                    lc={lc}
                    locale={locale}
                    siteLabel={siteLabel(lead.managedSiteId)}
                    active={lead.id === selectedId}
                    onSelect={() => select(lead)}
                  />
                </li>
              ))}
            </ul>
          )}
          {(cursors.length > 0 || nextCursor) && !list.error && (
            <nav className="flex items-center justify-between gap-3" aria-label={lc.list.title}>
              <Button
                variant="outline"
                size="sm"
                disabled={cursors.length === 0}
                onClick={() => setPager({ key: filterKey, cursors: cursors.slice(0, -1) })}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {lc.list.previous}
              </Button>
              <span className="text-xs text-muted-foreground">{lc.list.page.replace('{page}', String(cursors.length + 1))}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextCursor}
                onClick={() => nextCursor && setPager({ key: filterKey, cursors: [...cursors, nextCursor] })}
              >
                {lc.list.next}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </section>

        <div ref={detailRef} className="scroll-mt-6 lg:sticky lg:top-6">
          {selectedId ? (
            <LeadDetail
              key={selectedId}
              leadId={selectedId}
              accountId={accountId}
              locale={locale}
              copy={copy}
              lc={lc}
              base={base}
              siteLabel={siteLabel}
              onChanged={refreshSurfaces}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed p-6">
              <p className="font-medium text-foreground">{lc.detail.placeholder.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{lc.detail.placeholder.body}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LeadRow({
  lead,
  lc,
  locale,
  siteLabel,
  active,
  onSelect,
}: {
  lead: SiteLead
  lc: CrmLeadsViewProps['leadsCopy']
  locale: string
  siteLabel: string
  active: boolean
  onSelect: () => void
}) {
  const name = lead.contactName || lc.list.noName
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={lc.list.openLead.replace('{name}', lead.contactName || lead.contactEmail)}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'border-primary ring-1 ring-primary',
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('font-medium text-foreground', !lead.contactName && 'text-muted-foreground')}>{name}</span>
        <LeadStatusPill status={lead.status} lc={lc} />
      </span>
      <span className="truncate text-sm text-foreground">
        {lead.contactEmail}
        {lead.contactPhone && <span className="text-muted-foreground">{` · ${lead.contactPhone}`}</span>}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{siteLabel}</span>
        {lead.formReference && <span>{lead.formReference}</span>}
        <time dateTime={lead.submittedAt}>{formatDateTime(lead.submittedAt, locale)}</time>
      </span>
      {lead.message && <span className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{lead.message}</span>}
    </button>
  )
}
