'use client'

import Link from 'next/link'
import { ArrowRight, FolderKanban, Globe, UserRound } from 'lucide-react'
import { StatusPill, type PillTone } from '@/components/crm/workspace-kit'
import { fill, formatDate, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import type { Locale } from '@/lib/i18n/config'
import type { BusinessCenterCopy } from '@/lib/i18n/dictionaries/business-center-en'
import { finiteCount, safeDestination, type OperationsLeadLineage } from '@/lib/business-ui/types'

type OpsCopy = BusinessCenterCopy['operations']

const STATUS_TONE: Record<string, PillTone> = {
  RECEIVED: 'neutral',
  PENDING_REVIEW: 'neutral',
  DUPLICATE_REVIEW: 'neutral',
  QUALIFIED: 'success',
  CONVERTED: 'success',
  REJECTED: 'muted',
}

export function LineageRow({
  lead,
  locale,
  copy,
}: {
  lead: OperationsLeadLineage
  locale: Locale
  copy: OpsCopy
}) {
  const reviewHref = safeDestination(locale, lead.destinations?.leadReview?.path)
  const q = lead.qualification ?? { qualifiedAt: null, convertedAt: null, rejectedAt: null }
  const milestones = [
    q.qualifiedAt && fill(copy.qualifiedAt, { time: formatDateTime(q.qualifiedAt, locale) }),
    q.convertedAt && fill(copy.convertedAt, { time: formatDateTime(q.convertedAt, locale) }),
    q.rejectedAt && fill(copy.rejectedAt, { time: formatDateTime(q.rejectedAt, locale) }),
  ].filter(Boolean) as string[]

  return (
    <li className="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground lg:grid-cols-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={copy.leadStatus[lead.status] ?? copy.unknownStatus} tone={STATUS_TONE[lead.status] ?? 'muted'} />
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{lead.managedSiteName || copy.unnamedSite}</span>
        </p>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <li>
            <time dateTime={lead.submittedAt}>{fill(copy.submitted, { time: formatDateTime(lead.submittedAt, locale) })}</time>
          </li>
          {milestones.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        {reviewHref && <RowLink href={reviewHref} label={copy.reviewLead} />}
      </div>

      <CrmColumn lead={lead} locale={locale} copy={copy} />
      <ProjectColumn lead={lead} locale={locale} copy={copy} />
    </li>
  )
}

function CrmColumn({ lead, locale, copy }: { lead: OperationsLeadLineage; locale: Locale; copy: OpsCopy }) {
  const crm = lead.crm
  const href = crm ? safeDestination(locale, crm.destination?.path) : null
  return (
    <div className="flex flex-col gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
      <ColumnTitle icon={UserRound} title={copy.crmTitle} />
      {crm ? (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Count label={copy.openDeals} value={finiteCount(crm.openDeals)} locale={locale} copy={copy} />
            <Count label={copy.openTasks} value={finiteCount(crm.openTasks)} locale={locale} copy={copy} />
          </dl>
          {href && <RowLink href={href} label={copy.openContact} />}
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.crmNone}</p>
      )}
    </div>
  )
}

function ProjectColumn({ lead, locale, copy }: { lead: OperationsLeadLineage; locale: Locale; copy: OpsCopy }) {
  const project = lead.project
  if (!project) {
    return (
      <div className="flex flex-col gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <ColumnTitle icon={FolderKanban} title={copy.projectTitle} />
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.projectNone}</p>
      </div>
    )
  }
  const raw = finiteCount(project.progressPercent)
  const percent = raw === null ? null : Math.min(100, Math.round(raw))
  const href = safeDestination(locale, project.destination?.path)

  return (
    <div className="flex flex-col gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
      <ColumnTitle icon={FolderKanban} title={copy.projectTitle} />
      <p className="truncate text-sm font-medium text-foreground">{project.projectName}</p>
      {percent !== null && (
        <div className="flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label={copy.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{fill(copy.progressValue, { percent })}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {project.estimatedCompletionDate
          ? fill(copy.eta, { date: formatDate(project.estimatedCompletionDate, locale) })
          : copy.etaNone}
      </p>
      <dl className="grid grid-cols-2 gap-2">
        <Count label={copy.pendingApprovals} value={finiteCount(project.pendingApprovals)} locale={locale} copy={copy} />
        <Count label={copy.openDependencies} value={finiteCount(project.openDependencies)} locale={locale} copy={copy} />
      </dl>
      {project.nextMilestoneTitle && (
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {fill(copy.nextMilestone, { title: project.nextMilestoneTitle })}
        </p>
      )}
      {href && <RowLink href={href} label={copy.openProject} />}
    </div>
  )
}

function ColumnTitle({ icon: Icon, title }: { icon: typeof Globe; title: string }) {
  return (
    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-4" aria-hidden="true" />
      {title}
    </h4>
  )
}

/** A missing count reads "Not reported", never zero. */
function Count({ label, value, locale, copy }: { label: string; value: number | null; locale: Locale; copy: OpsCopy }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value === null ? 'text-sm text-muted-foreground' : 'text-lg font-semibold tabular-nums text-foreground'}>
        {value === null ? copy.notReported : formatNumber(value, locale)}
      </dd>
    </div>
  )
}

function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  )
}
