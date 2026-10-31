'use client'

import {
  AlertCircle,
  Ban,
  Clock,
  CopyX,
  FileQuestion,
  Gauge,
  Lock,
  LogIn,
  PauseCircle,
  ServerCrash,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill, type PillTone } from '@/components/commerce/ui'
import type { CrmLeadsCopy } from '@/lib/i18n/dictionaries/crm-leads-en'
import { leadIssue, type LeadIssue, type LeadStatus } from '@/lib/crm-ui/leads'
import type { WorkspaceError } from '@/lib/crm-ui/workspace'
import { cn } from '@/lib/utils'

const ISSUE_ICONS: Record<LeadIssue, typeof AlertCircle> = {
  intakeDisabled: PauseCircle,
  crmDisabled: PauseCircle,
  ineligible: Ban,
  policyUnresolved: ShieldAlert,
  unauthorized: LogIn,
  forbidden: Lock,
  notFound: FileQuestion,
  rateLimited: Gauge,
  unavailable: ServerCrash,
  statusConflict: CopyX,
  identityConflict: Users,
  conversionPending: Clock,
  conflict: AlertCircle,
  validation: AlertCircle,
  error: AlertCircle,
}

const RETRYABLE_LOADS: ReadonlySet<LeadIssue> = new Set(['unavailable', 'rateLimited', 'error', 'policyUnresolved'])

export function LeadIssueState({
  error,
  lc,
  retryLabel,
  onRetry,
  compact,
}: {
  error: WorkspaceError
  lc: CrmLeadsCopy
  retryLabel?: string
  onRetry?: () => void
  compact?: boolean
}) {
  const issue = leadIssue(error)
  const state = lc.issues[issue]
  const Icon = ISSUE_ICONS[issue]
  const detail = issue === 'validation' && error.detail ? error.detail : null
  const retry = onRetry && retryLabel && RETRYABLE_LOADS.has(issue)

  if (compact) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border bg-muted px-3 py-2.5 text-sm">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{state.title}.</span> {state.body}
          {detail && <span className="mt-1 block font-mono text-xs">{detail}</span>}
        </p>
      </div>
    )
  }

  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{state.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      {retry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

const STATUS_TONES: Record<LeadStatus, PillTone> = {
  RECEIVED: 'info',
  PENDING_REVIEW: 'neutral',
  QUALIFIED: 'success',
  REJECTED: 'muted',
  CONVERTED: 'success',
  DUPLICATE_REVIEW: 'danger',
}

export function LeadStatusPill({ status, lc, className }: { status: LeadStatus; lc: CrmLeadsCopy; className?: string }) {
  return <StatusPill label={lc.statuses[status] ?? status} tone={STATUS_TONES[status] ?? 'neutral'} className={cn(className)} />
}
