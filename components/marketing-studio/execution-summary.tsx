'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingRows, Section } from '@/components/commerce/ui'
import { WorkspaceState, selectClass } from '@/components/crm/workspace-kit'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { fill, formatDateTime } from '@/lib/crm-ui/workspace'
import { MKT_API, type MarketingExecutionSummaryEnvelope } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { AudiencePlanningPanel, ReviewEvidencePanel, SocialReadinessPanel, WorkflowPanel } from './execution-panels'

type Props = Pick<MarketingViewProps, 'accountId' | 'locale' | 'copy' | 'base' | 'sites'>

/** Mount with `key={accountId}` so the site filter resets when the session account changes. */
export function MarketingExecutionSummary({ accountId, locale, copy, base, sites }: Props) {
  const e = copy.execution
  const selectId = useId()
  const [siteId, setSiteId] = useState('')
  const site = sites.find((s) => s.id === siteId) ?? null
  const summary = useWorkspace<MarketingExecutionSummaryEnvelope>(MKT_API.executionSummary(site?.id), accountId)

  // Only render a payload that matches the current account and scope; anything else is in flight.
  const raw = summary.data?.summary
  const data = raw && raw.customerAccountId === accountId && raw.managedSiteId === (site?.id ?? null) ? raw : undefined

  return (
    <Section
      id="marketing-execution"
      title={e.title}
      description={e.description}
      action={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {sites.length > 0 && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <label htmlFor={selectId} className="text-sm text-muted-foreground">
                {e.siteLabel}
              </label>
              <select id={selectId} value={site?.id ?? ''} onChange={(ev) => setSiteId(ev.target.value)} className={selectClass}>
                <option value="">{e.allSites}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.domain ? `${s.name} (${s.domain})` : s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button size="sm" variant="outline" disabled={summary.isValidating} onClick={() => summary.mutate()}>
            {summary.isValidating && data ? e.refreshing : e.refresh}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-foreground">{site ? fill(e.scopeSite, { site: site.name }) : e.scopeAccount}</p>
        <p className="text-muted-foreground">{e.accountLevelNote}</p>
        {data && <p className="text-xs text-muted-foreground">{fill(e.assembledAt, { date: formatDateTime(data.assembledAt, locale) })}</p>}
      </div>

      {summary.error ? (
        <WorkspaceState error={summary.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => summary.mutate()} />
      ) : !data ? (
        <LoadingRows label={copy.kit.loading} rows={4} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{e.provenance}</span>{' '}
            <span className="block pt-1 text-xs">
              {e.sourceNotice}: {data.provenanceNotice}
            </span>
          </p>
          <WorkflowPanel slice={data.workflowCounts} copy={copy} locale={locale} />
          <ReviewEvidencePanel slice={data.reviewEvidence} copy={copy} locale={locale} base={base} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AudiencePlanningPanel
              slice={data.crmAudiencePlanning}
              planningDisclosure={data.planningDisclosure}
              copy={copy}
              locale={locale}
            />
            <SocialReadinessPanel
              readiness={data.socialProviderReadiness}
              policy={data.socialHandoffPolicy}
              copy={copy}
              locale={locale}
            />
          </div>
        </div>
      )}
    </Section>
  )
}
