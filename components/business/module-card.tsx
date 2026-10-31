'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Ban,
  CircleOff,
  LayoutTemplate,
  Lock,
  MapPin,
  Megaphone,
  MessagesSquare,
  PauseCircle,
  ShieldAlert,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { StatusPill, type PillTone } from '@/components/crm/workspace-kit'
import { fill, formatDateTime, formatNumber } from '@/lib/crm-ui/workspace'
import type { Locale } from '@/lib/i18n/config'
import { localizePath } from '@/lib/i18n/localize'
import type { BusinessCenterCopy } from '@/lib/i18n/dictionaries/business-center-en'
import {
  HEADLINE_METRICS,
  MODULE_WORKSPACE_PATH,
  totalMetric,
  type BusinessModule,
  type ModuleSnapshot,
  type ReadinessState,
} from '@/lib/business-ui/types'

export const MODULE_ICONS: Record<BusinessModule, LucideIcon> = {
  crm: Users,
  marketing: Megaphone,
  local_seo: MapPin,
  communications: MessagesSquare,
  website_projects: LayoutTemplate,
}

const READINESS_TONE: Record<ReadinessState, PillTone> = {
  available: 'success',
  disabled: 'muted',
  not_configured: 'muted',
  policy_unresolved: 'neutral',
  not_eligible: 'muted',
  unauthorized: 'danger',
  unavailable: 'danger',
}

const READINESS_ICON: Record<Exclude<ReadinessState, 'available'>, LucideIcon> = {
  disabled: PauseCircle,
  not_configured: Ban,
  policy_unresolved: ShieldAlert,
  not_eligible: CircleOff,
  unauthorized: Lock,
  unavailable: TriangleAlert,
}

/** Modules where the workspace itself would only repeat the gate are not linked. */
const HIDE_LINK: ReadonlySet<ReadinessState> = new Set(['disabled', 'unauthorized'])

export function ModuleCard({
  snapshot,
  listCount,
  locale,
  copy,
  onShowInList,
}: {
  snapshot: ModuleSnapshot
  listCount: number
  locale: Locale
  copy: BusinessCenterCopy
  onShowInList: (module: BusinessModule) => void
}) {
  const { module, readiness, summary } = snapshot
  const Icon = MODULE_ICONS[module]
  const name = copy.modules[module].name
  const headingId = `business-module-${module}`
  const available = readiness.state === 'available'
  const metrics = available
    ? HEADLINE_METRICS[module]
        .map((key) => ({ key, value: totalMetric(summary, key) }))
        .filter((m): m is { key: string; value: number } => m.value !== null)
    : []

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <h3 id={headingId} className="font-semibold leading-tight text-foreground">
            {name}
          </h3>
        </div>
        <StatusPill label={copy.readiness[readiness.state].label} tone={READINESS_TONE[readiness.state]} />
      </header>

      <div className="flex flex-1 flex-col gap-3">
        {readiness.state === 'available' ? (
          readiness.empty ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.emptyModule}</p>
          ) : metrics.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {metrics.map((m) => (
                <div key={m.key} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{copy.metrics[m.key] ?? m.key}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatNumber(m.value, locale)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.emptyModule}</p>
          )
        ) : (
          <NotAvailableBody state={readiness.state} reasonCode={readiness.reasonCode} copy={copy} />
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground">
        {readiness.state === 'available' && (
          <time dateTime={readiness.sourceCheckedAt}>
            {fill(copy.checkedAt, { time: formatDateTime(readiness.sourceCheckedAt, locale) })}
          </time>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!HIDE_LINK.has(readiness.state) ? (
            <Link
              href={localizePath(locale, MODULE_WORKSPACE_PATH[module])}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {copy.modules[module].open}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
          {available && listCount > 0 && (
            <button
              type="button"
              onClick={() => onShowInList(module)}
              aria-label={fill(copy.showInList, { module: name })}
              className="rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {fill(copy.inList, { count: formatNumber(listCount, locale) })}
            </button>
          )}
        </div>
      </footer>
    </article>
  )
}

function NotAvailableBody({
  state,
  reasonCode,
  copy,
}: {
  state: Exclude<ReadinessState, 'available'>
  reasonCode: string
  copy: BusinessCenterCopy
}) {
  const Icon = READINESS_ICON[state]
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.readiness[state].body}</p>
        {reasonCode && reasonCode !== 'MODULE_MISSING' && (
          <p className="font-mono text-xs text-muted-foreground">{fill(copy.referenceCode, { code: reasonCode })}</p>
        )}
      </div>
    </div>
  )
}
