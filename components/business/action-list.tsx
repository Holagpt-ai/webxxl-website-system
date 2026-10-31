'use client'

import Link from 'next/link'
import { forwardRef } from 'react'
import { ArrowUpRight, CalendarClock, Clock } from 'lucide-react'
import { EmptyNote, StatusPill, type PillTone } from '@/components/crm/workspace-kit'
import { fill, formatDate, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import type { Locale } from '@/lib/i18n/config'
import type { BusinessCenterCopy } from '@/lib/i18n/dictionaries/business-center-en'
import {
  BUSINESS_MODULES,
  safeDestination,
  type ActionPriority,
  type BusinessAction,
  type BusinessModule,
} from '@/lib/business-ui/types'
import { cn } from '@/lib/utils'
import { MODULE_ICONS } from './module-card'

const PRIORITY_TONE: Record<ActionPriority, PillTone> = {
  high: 'danger',
  medium: 'neutral',
  normal: 'info',
  low: 'muted',
}

export type ModuleFilter = BusinessModule | 'all'

type Props = {
  actions: BusinessAction[]
  counts: Record<BusinessModule, number>
  filter: ModuleFilter
  highOnly: boolean
  onFilter: (filter: ModuleFilter) => void
  onHighOnly: (value: boolean) => void
  limits: { maxActionsReturned: number; maxActionsPerModule: number }
  notReporting: string[]
  locale: Locale
  copy: BusinessCenterCopy
}

/** Keeps the backend's priority/timestamp order; filtering only removes rows. */
export const ActionList = forwardRef<HTMLElement, Props>(function ActionList(
  { actions, counts, filter, highOnly, onFilter, onHighOnly, limits, notReporting, locale, copy },
  ref,
) {
  const visible = actions.filter((a) => (filter === 'all' || a.module === filter) && (!highOnly || a.priority === 'high'))
  const highCount = actions.filter((a) => (filter === 'all' || a.module === filter) && a.priority === 'high').length

  return (
    <section ref={ref} id="business-actions" aria-labelledby="business-actions-title" tabIndex={-1} className="flex flex-col gap-4 focus:outline-none">
      <div className="flex flex-col gap-1">
        <h2 id="business-actions-title" className="text-lg font-semibold text-foreground">
          {copy.actions.title}
        </h2>
        <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">{copy.actions.description}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label={copy.actions.filterLabel} className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => onFilter('all')} label={copy.actions.all} count={actions.length} locale={locale} />
          {BUSINESS_MODULES.map((m) => (
            <FilterChip
              key={m}
              active={filter === m}
              onClick={() => onFilter(m)}
              label={copy.modules[m].name}
              count={counts[m]}
              locale={locale}
            />
          ))}
        </div>
        <button
          type="button"
          aria-pressed={highOnly}
          onClick={() => onHighOnly(!highOnly)}
          className={cn(
            'inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            highOnly ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          <span className={cn('size-2 rounded-full', highOnly ? 'bg-destructive' : 'bg-muted-foreground/40')} aria-hidden="true" />
          {copy.actions.highOnly}
          <span className="tabular-nums">({formatNumber(highCount, locale)})</span>
        </button>
      </div>

      {actions.length === 0 ? (
        <EmptyNote>{copy.actions.empty}</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote>{copy.actions.emptyFiltered}</EmptyNote>
      ) : (
        <ol className="flex flex-col overflow-hidden rounded-xl border bg-card">
          {visible.map((action) => (
            <ActionRow key={`${action.actionType}:${action.recordRef.kind}:${action.recordRef.id}`} action={action} locale={locale} copy={copy} />
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">{fill(copy.actions.shown, { count: formatNumber(visible.length, locale) })}</p>
        <p>
          {fill(copy.actions.limitNote, {
            max: formatNumber(limits.maxActionsReturned, locale),
            perModule: formatNumber(limits.maxActionsPerModule, locale),
          })}
        </p>
      </div>
      {notReporting.length > 0 && (
        <p className="text-xs text-muted-foreground">{fill(copy.actions.notReporting, { modules: notReporting.join(', ') })}</p>
      )}
    </section>
  )
})

function FilterChip({
  active,
  onClick,
  label,
  count,
  locale,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  locale: Locale
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{formatNumber(count, locale)}</span>
    </button>
  )
}

function ActionRow({ action, locale, copy }: { action: BusinessAction; locale: Locale; copy: BusinessCenterCopy }) {
  const href = safeDestination(locale, action.destination?.path)
  const Icon = MODULE_ICONS[action.module]
  const typeLabel = copy.actionTypes[action.actionType] ?? copy.unknownAction
  const high = action.priority === 'high'
  const priorityLabel = copy.priority[action.priority] ?? action.priority

  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
            high ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={priorityLabel} tone={PRIORITY_TONE[action.priority] ?? 'neutral'} />
            <span className="text-xs text-muted-foreground">{copy.modules[action.module]?.name ?? action.module}</span>
          </div>
          <p className="font-medium text-foreground">{typeLabel}</p>
          <p className="break-words text-sm text-muted-foreground">{action.title}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 pl-11 sm:flex-col sm:items-end sm:justify-center sm:pl-0">
        <ActionTime action={action} locale={locale} copy={copy} />
        {href ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
            {copy.actions.open}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{copy.actions.linkUnavailable}</span>
        )}
      </div>
    </>
  )

  const rowClass = cn(
    'flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6',
    high && 'bg-destructive/5',
  )

  return (
    <li className="border-b last:border-b-0">
      {href ? (
        <Link
          href={href}
          className={cn(rowClass, 'group transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  )
}

/** Due dates come first when the source record has one; otherwise the backend's evidence timestamp. */
function ActionTime({ action, locale, copy }: { action: BusinessAction; locale: Locale; copy: BusinessCenterCopy }) {
  if (action.dueAt) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        <time dateTime={action.dueAt}>{fill(copy.actions.due, { date: formatDate(action.dueAt, locale) })}</time>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <Clock className="size-3.5" aria-hidden="true" />
      <time dateTime={action.timestamp}>{fill(copy.actions.updated, { time: formatDateTime(action.timestamp, locale) })}</time>
    </span>
  )
}
