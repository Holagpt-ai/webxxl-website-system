'use client'

import { AlertCircle, Ban, CalendarX, Database, Gauge, Lock, LogIn, PauseCircle, ServerCrash, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RETRYABLE_FUNNEL_ISSUES, type FunnelIssue } from '@/lib/crm-ui/lead-funnel'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'

const ICONS: Record<FunnelIssue, typeof AlertCircle> = {
  crmDisabled: PauseCircle,
  ineligible: Ban,
  notConfigured: Database,
  policyUnresolved: ShieldAlert,
  unauthorized: LogIn,
  forbidden: Lock,
  siteForbidden: Lock,
  invalidDates: CalendarX,
  rateLimited: Gauge,
  unavailable: ServerCrash,
}

export function FunnelIssueState({
  issue,
  fc,
  detail,
  onRetry,
}: {
  issue: FunnelIssue
  fc: CrmLeadFunnelCopy
  detail?: string | null
  onRetry?: () => void
}) {
  const Icon = ICONS[issue]
  const state = fc.issues[issue]
  return (
    <div
      role={issue === 'invalidDates' || issue === 'siteForbidden' ? 'alert' : 'status'}
      className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{state.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      {onRetry && RETRYABLE_FUNNEL_ISSUES.has(issue) && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {fc.retry}
        </Button>
      )}
    </div>
  )
}

export function FunnelEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-1 rounded-xl border border-dashed bg-muted px-6 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
