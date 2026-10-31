'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingRows, SelectField, TextField } from './workspace-kit'
import { FunnelEmptyState, FunnelIssueState } from './lead-funnel-state'
import { FunnelCohortMetrics, FunnelEventMetrics } from './lead-funnel-metrics'
import { FunnelTrend } from './lead-funnel-trend'
import { FunnelStatusDistribution } from './lead-funnel-status'
import { FunnelBreakdown } from './lead-funnel-breakdown'
import { FunnelAttribution } from './lead-funnel-attribution'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  EVENT_KEYS,
  FUNNEL_API,
  FUNNEL_GATE_ISSUES,
  checkDateRange,
  funnelIssue,
  totalOf,
  type FunnelReport,
  type FunnelReportResponse,
} from '@/lib/crm-ui/lead-funnel'
import { fill, formatDateTime, withQuery, type ManagedSiteOption } from '@/lib/crm-ui/workspace'
import { formatUtcDay } from '@/lib/analytics-ui/range'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'

type Filters = { from: string; to: string; siteId: string; form: string }
const NO_FILTERS: Filters = { from: '', to: '', siteId: '', form: '' }

export function CrmLeadFunnelDashboard({
  accountId,
  locale,
  base,
  sites,
  fc,
}: {
  accountId: string
  locale: string
  base: string
  sites: ManagedSiteOption[]
  fc: CrmLeadFunnelCopy
}) {
  // Filters belong to one account; switching accounts starts again from the API defaults.
  const [state, setState] = useState({ accountId, filters: NO_FILTERS, formDraft: '' })
  const current = state.accountId === accountId ? state : { accountId, filters: NO_FILTERS, formDraft: '' }
  const { filters, formDraft } = current

  const setFilters = (patch: Partial<Filters>) =>
    setState({ ...current, filters: { ...filters, ...patch }, formDraft: 'form' in patch ? (patch.form ?? '') : formDraft })
  const setFormDraft = (value: string) => setState({ ...current, formDraft: value })

  const rangeProblem = checkDateRange(filters.from, filters.to)
  const siteId = sites.some((s) => s.id === filters.siteId) ? filters.siteId : ''
  const url = rangeProblem
    ? null
    : withQuery(FUNNEL_API, {
        createdFrom: filters.from || null,
        createdTo: filters.to || null,
        managedSiteId: siteId || null,
        formReference: filters.form || null,
      })
  const result = useWorkspace<FunnelReportResponse>(url, accountId)

  // A response for another account is never shown, even for one render.
  const report: FunnelReport | undefined =
    result.data?.report.customerAccountId === accountId ? result.data.report : undefined

  const siteNames = useMemo(() => new Map(sites.map((s) => [s.id, s.domain ? `${s.name} (${s.domain})` : s.name])), [sites])
  const siteLabel = useCallback((id: string) => siteNames.get(id) ?? id, [siteNames])
  const formLabel = useCallback((key: string) => key, [])
  const isUnknownSite = useCallback((id: string) => !siteNames.has(id), [siteNames])

  const filtered = Boolean(filters.from || filters.to || siteId || filters.form)
  const issue = result.error ? funnelIssue(result.error, Boolean(siteId)) : null
  const formListId = useId()
  const formInputId = useId()

  const header = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <Link
          href={`${base}/leads`}
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fc.backToInbox}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{fc.title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{fc.description}</p>
      </div>
      {!issue || !FUNNEL_GATE_ISSUES.has(issue) ? (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => result.mutate()}
            disabled={!url || result.isValidating}
            aria-live="polite"
          >
            <RefreshCw className={result.isValidating ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            {result.isValidating && report ? fc.refreshing : fc.refresh}
          </Button>
          {report && (
            <p className="text-xs text-muted-foreground">
              {fill(fc.generatedAt, { time: formatDateTime(report.generatedAt, locale) })}
            </p>
          )}
        </div>
      ) : null}
    </header>
  )

  if (issue && FUNNEL_GATE_ISSUES.has(issue)) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <FunnelIssueState issue={issue} fc={fc} onRetry={() => result.mutate()} />
      </div>
    )
  }

  const formOptions = report && !report.filters.formReference ? report.byFormReference.map((r) => r.key) : []
  const hasActivity =
    report &&
    ((totalOf(report.summary.leadsReceived) ?? 1) > 0 || EVENT_KEYS.some((key) => (totalOf(report[key]) ?? 1) > 0))

  return (
    <div className="flex flex-col gap-8">
      {header}

      <form
        aria-label={fc.filters.label}
        onSubmit={(e) => {
          e.preventDefault()
          setFilters({ form: formDraft.trim() })
        }}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <TextField label={fc.filters.from} type="date" value={filters.from} onChange={(from) => setFilters({ from })} />
          <TextField label={fc.filters.to} type="date" value={filters.to} onChange={(to) => setFilters({ to })} />
          <SelectField
            label={fc.filters.site}
            value={siteId}
            onChange={(value) => setFilters({ siteId: value })}
            options={[{ value: '', label: fc.filters.allSites }, ...sites.map((s) => ({ value: s.id, label: siteLabel(s.id) }))]}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={formInputId}>{fc.filters.form}</Label>
            <div className="flex gap-2">
              <Input
                id={formInputId}
                value={formDraft}
                onChange={(e) => setFormDraft(e.target.value)}
                placeholder={fc.filters.formPlaceholder}
                list={formOptions.length ? formListId : undefined}
                aria-describedby={`${formInputId}-hint`}
                maxLength={200}
              />
              <Button type="submit" variant="secondary" size="sm" className="h-9" disabled={formDraft.trim() === filters.form}>
                {fc.filters.apply}
              </Button>
            </div>
            {formOptions.length > 0 && (
              <datalist id={formListId}>
                {formOptions.map((key) => (
                  <option key={key} value={key} />
                ))}
              </datalist>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!filtered && !formDraft}
            onClick={() => setState({ accountId, filters: NO_FILTERS, formDraft: '' })}
            className="justify-self-start"
          >
            {fc.filters.clear}
          </Button>
        </div>
        <p id={`${formInputId}-hint`} className="flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            {report
              ? fill(fc.filters.activeRange, {
                  from: formatUtcDay(report.filters.createdFrom, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
                  to: formatUtcDay(report.filters.createdTo, locale, { year: 'numeric', month: 'short', day: 'numeric' }),
                })
              : !filters.from && !filters.to
                ? fc.filters.defaultRange
                : null}
          </span>
          <span>{fc.filters.utcNote}</span>
          <span>{fc.filters.formHint}</span>
        </p>
      </form>

      {rangeProblem ? (
        <FunnelIssueState issue="invalidDates" fc={fc} detail={fc.filters.rangeProblems[rangeProblem]} />
      ) : issue ? (
        <FunnelIssueState
          issue={issue}
          fc={fc}
          detail={issue === 'invalidDates' ? result.error?.detail : null}
          onRetry={() => result.mutate()}
        />
      ) : !report ? (
        <LoadingRows rows={5} label={fc.loading} />
      ) : !hasActivity ? (
        <FunnelEmptyState
          title={filtered ? fc.empty.filteredTitle : fc.empty.title}
          body={filtered ? fc.empty.filteredBody : fc.empty.body}
        />
      ) : (
        <div className="flex flex-col gap-8" aria-busy={result.isValidating}>
          <FunnelCohortMetrics report={report} locale={locale} fc={fc} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <FunnelTrend report={report} locale={locale} fc={fc} />
            <FunnelStatusDistribution report={report} locale={locale} fc={fc} />
          </div>
          <FunnelEventMetrics report={report} locale={locale} fc={fc} />
          <FunnelBreakdown
            id="funnel-by-site"
            title={fc.breakdown.siteTitle}
            description={fc.breakdown.siteDescription}
            keyColumn={fc.breakdown.siteColumn}
            rows={report.byManagedSite}
            filteredNote={report.filters.managedSiteId ? fc.breakdown.siteFiltered : null}
            emptyNote={fc.breakdown.empty}
            label={siteLabel}
            isUnknown={isUnknownSite}
            locale={locale}
            fc={fc}
          />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <FunnelBreakdown
              id="funnel-by-form"
              title={fc.breakdown.formTitle}
              description={fc.breakdown.formDescription}
              keyColumn={fc.breakdown.formColumn}
              rows={report.byFormReference}
              filteredNote={report.filters.formReference ? fc.breakdown.formFiltered : null}
              emptyNote={fc.breakdown.formEmpty}
              footnote={fc.breakdown.formNullNote}
              label={formLabel}
              locale={locale}
              fc={fc}
            />
            <FunnelAttribution report={report} locale={locale} fc={fc} />
          </div>
        </div>
      )}
    </div>
  )
}
