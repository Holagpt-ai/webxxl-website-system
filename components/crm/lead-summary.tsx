'use client'

import { StatTile } from './workspace-kit'
import { LeadIssueState } from './lead-shared'
import type { CrmLeadsCopy } from '@/lib/i18n/dictionaries/crm-leads-en'
import { LEAD_SUMMARY_KEYS, type LeadSummaryResponse } from '@/lib/crm-ui/leads'
import { DASH, formatNumber, type WorkspaceError } from '@/lib/crm-ui/workspace'

export function LeadSummary({
  data,
  error,
  isLoading,
  locale,
  lc,
  retryLabel,
  siteScoped,
  onRetry,
}: {
  data: LeadSummaryResponse | undefined
  error: WorkspaceError | undefined
  isLoading: boolean
  locale: string
  lc: CrmLeadsCopy
  retryLabel: string
  siteScoped: boolean
  onRetry: () => void
}) {
  const s = lc.summary
  return (
    <section aria-labelledby="lead-summary-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="lead-summary-title" className="text-lg font-semibold tracking-tight text-foreground">
          {s.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{siteScoped ? s.siteScoped : s.description}</p>
      </div>
      {error ? (
        <LeadIssueState error={error} lc={lc} retryLabel={retryLabel} onRetry={onRetry} compact />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-busy={isLoading}>
          {LEAD_SUMMARY_KEYS.map((key) => {
            const metric = data?.summary[key]
            const isTotal = metric?.scope === 'account_total'
            return (
              <StatTile
                key={key}
                label={s.metrics[key]}
                value={isLoading ? '…' : isTotal ? formatNumber(metric.value, locale) : DASH}
                hint={metric && !isTotal ? s.notTotal : s.hints[key]}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
