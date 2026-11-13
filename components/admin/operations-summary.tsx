'use client'

import { useId, useState } from 'react'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Section, StatusPill } from '@/components/commerce/ui'
import { FactRow, Metric, MetricSkeleton, Panel, SliceUnavailable } from '@/components/dashboard/readiness-kit'
import { selectClass } from '@/components/crm/workspace-kit'
import { fill } from '@/lib/commerce-ui/format'
import { formatDateTime } from '@/lib/crm-ui/workspace'
import {
  listSlices,
  useAdminOperations,
  type AdminAccountExecutionAttachment,
  type AdminOperationsSlice,
  type AdminOpsError,
  type AdminPlatformQueueCounts,
  type AdminRuntimeGateSnapshot,
} from '@/lib/admin-ui/operations'
import type { AdminOperationsCopy } from '@/lib/i18n/dictionaries/admin-operations-en'

type Site = { id: string; name: string; domain: string | null }

type Props = {
  locale: string
  prefix: string
  copy: AdminOperationsCopy
  /** Omit for the platform-wide overview. */
  customerAccountId?: string
  sites?: Site[]
  extraMetrics?: { label: string; value: number; href?: string }[]
}

const QUEUE_ORDER: { key: keyof AdminPlatformQueueCounts; path: string }[] = [
  { key: 'activeCustomerAccounts', path: '/admin/customers' },
  { key: 'activeProjects', path: '/admin/projects' },
  { key: 'pendingProjectApprovals', path: '/admin/approvals' },
  { key: 'websiteLeadsAwaitingReview', path: '/admin/leads' },
  { key: 'openServiceOrders', path: '/admin/service-orders' },
  { key: 'openSupportRequests', path: '/admin/support' },
  { key: 'openChangeRequests', path: '/admin/requests' },
  { key: 'blockedProjectTasks', path: '/admin/projects' },
  { key: 'overdueProjectTasks', path: '/admin/projects' },
]

const GATE_GROUPS: { group: keyof AdminOperationsCopy['runtime']['groups']; gates: (keyof AdminOperationsCopy['runtime']['gates'])[] }[] = [
  { group: 'ai', gates: ['customerAiExecutionEnabled', 'customerAiOutboundEnabled'] },
  { group: 'communications', gates: ['communicationsOutboundEnabled'] },
  { group: 'commerce', gates: ['commerceCheckoutEnabled'] },
  { group: 'automation', gates: ['workflowWorkerEnabled', 'workflowExternalEffectsEnabled'] },
]

const MODULES = ['communications', 'commerce', 'marketing', 'aiWorkforce'] as const

/** Mount with `key={customerAccountId}` so the site filter resets between accounts. */
export function AdminOperationsSummary({ locale, prefix, copy, customerAccountId, sites = [], extraMetrics = [] }: Props) {
  const selectId = useId()
  const [siteId, setSiteId] = useState('')
  const site = customerAccountId ? (sites.find((s) => s.id === siteId) ?? null) : null
  const { summary, error, isValidating, mutate } = useAdminOperations(customerAccountId, site?.id)
  const accountScope = Boolean(customerAccountId)

  return (
    <Section
      id={accountScope ? 'account-operations' : 'platform-operations'}
      title={accountScope ? copy.accountTitle : copy.title}
      description={accountScope ? copy.accountDescription : copy.description}
      action={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {accountScope && sites.length > 0 && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <label htmlFor={selectId} className="text-sm text-muted-foreground">
                {copy.siteLabel}
              </label>
              <select id={selectId} value={site?.id ?? ''} onChange={(ev) => setSiteId(ev.target.value)} className={selectClass}>
                <option value="">{copy.allSites}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.domain ? `${s.name} (${s.domain})` : s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button size="sm" variant="outline" disabled={isValidating} onClick={() => mutate()}>
            {isValidating && summary ? copy.refreshing : copy.refresh}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill label={copy.readOnly} tone="muted" />
        <span className="text-foreground">{accountScope ? copy.scopeAccount : copy.scopePlatform}</span>
        {site && <span className="text-muted-foreground">· {site.name}</span>}
        {summary && (
          <span className="text-xs text-muted-foreground">· {fill(copy.generatedAt, { date: formatDateTime(summary.generatedAt, locale) })}</span>
        )}
      </div>

      {error ? (
        <OpsError error={error} copy={copy} onRetry={() => mutate()} />
      ) : !summary ? (
        <MetricSkeleton count={8} label={copy.loading} />
      ) : (
        <div className="flex flex-col gap-4">
          {summary.disclosure && <p className="text-xs leading-relaxed text-muted-foreground">{summary.disclosure}</p>}
          <QueuesPanel
            slice={summary.platformQueues}
            copy={copy}
            hrefFor={accountScope ? undefined : (path) => `${prefix}${path}`}
            extraMetrics={accountScope ? [] : extraMetrics}
          />
          <RuntimePanel slice={summary.runtimeGates} copy={copy} />
          {accountScope && <ExecutionPanel slice={summary.accountExecution} copy={copy} locale={locale} />}
        </div>
      )}
    </Section>
  )
}

function Unavailable({ slice, copy }: { slice: AdminOperationsSlice<unknown>; copy: AdminOperationsCopy }) {
  return (
    <SliceUnavailable
      title={copy.unavailable.title}
      reason={slice.reasonCode ? copy.reasons[slice.reasonCode] : undefined}
      reasonCode={slice.reasonCode}
      message={slice.message}
      reasonLabel={copy.unavailable.reason}
      serverMessageLabel={copy.unavailable.serverMessage}
    />
  )
}

function QueuesPanel({
  slice,
  copy,
  hrefFor,
  extraMetrics,
}: {
  slice: AdminOperationsSlice<AdminPlatformQueueCounts>
  copy: AdminOperationsCopy
  hrefFor?: (path: string) => string
  extraMetrics: { label: string; value: number; href?: string }[]
}) {
  return (
    <Panel title={copy.queues.title} note={copy.queues.note}>
      {slice.status !== 'AVAILABLE' || !slice.data ? (
        <Unavailable slice={slice} copy={copy} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {QUEUE_ORDER.map(({ key, path }) => (
            <Metric key={key} label={copy.queues[key]} value={slice.data![key]} href={hrefFor?.(path)} />
          ))}
          {extraMetrics.map((m) => (
            <Metric key={m.label} label={m.label} value={m.value} href={m.href} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function RuntimePanel({ slice, copy }: { slice: AdminOperationsSlice<AdminRuntimeGateSnapshot>; copy: AdminOperationsCopy }) {
  const r = copy.runtime
  return (
    <Panel title={r.title} note={r.note}>
      {slice.status !== 'AVAILABLE' || !slice.data ? (
        <Unavailable slice={slice} copy={copy} />
      ) : (
        <>
          {slice.data.liveActivationBlocked && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{r.liveBlocked}.</span> {r.liveBlockedBody}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
            {GATE_GROUPS.map(({ group, gates }) => (
              <div key={group} className="flex flex-col">
                <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.groups[group]}</p>
                <dl>
                  {gates.map((gate) => {
                    const on = slice.data![gate]
                    return <FactRow key={gate} label={r.gates[gate]} value={on ? r.on : r.off} tone={on ? 'info' : 'muted'} />
                  })}
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}

function ExecutionPanel({
  slice,
  copy,
  locale,
}: {
  slice: AdminOperationsSlice<AdminAccountExecutionAttachment>
  copy: AdminOperationsCopy
  locale: string
}) {
  const e = copy.execution
  if (slice.status !== 'AVAILABLE' || !slice.data) {
    return (
      <Panel title={e.title} note={e.description}>
        <Unavailable slice={slice} copy={copy} />
      </Panel>
    )
  }
  const data = slice.data
  return (
    <Panel
      title={e.title}
      note={e.description}
      action={
        <div className="flex flex-wrap gap-2">
          <StatusPill label={e.staffComposition} tone="muted" />
          <StatusPill label={`${e.accountStatus}: ${data.accountStatus}`} tone="neutral" />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MODULES.map((key) => {
          const moduleSummary = data[key]
          const slices = listSlices(moduleSummary)
          const availableCount = slices.filter((s) => s.status === 'AVAILABLE').length
          const assembledAt =
            moduleSummary && 'assembledAt' in moduleSummary && typeof moduleSummary.assembledAt === 'string'
              ? moduleSummary.assembledAt
              : null
          return (
            <div key={key} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{e.modules[key]}</h4>
                {!moduleSummary ? (
                  <StatusPill label={e.notComposed} tone="muted" />
                ) : slices.length === 0 ? (
                  <StatusPill label={e.notReported} tone="muted" />
                ) : (
                  <StatusPill
                    label={fill(e.sectionsAvailable, { available: String(availableCount), total: String(slices.length) })}
                    tone={availableCount === slices.length ? 'success' : 'info'}
                  />
                )}
              </div>
              {!moduleSummary ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{e.notComposedBody}</p>
              ) : slices.length === 0 ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{e.notReportedBody}</p>
              ) : (
                <>
                  <ul className="flex flex-col text-sm">
                    {slices.map((s) => (
                      <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5 last:border-0">
                        <code className="font-mono text-xs text-foreground">{s.key}</code>
                        <span className="flex items-center gap-2">
                          {s.reasonCode && <code className="font-mono text-xs text-muted-foreground">{s.reasonCode}</code>}
                          <StatusPill label={s.status === 'AVAILABLE' ? e.available : e.unavailable} tone={s.status === 'AVAILABLE' ? 'success' : 'muted'} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {assembledAt && (
                    <p className="text-xs text-muted-foreground">{fill(e.assembledAt, { date: formatDateTime(assembledAt, locale) })}</p>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function OpsError({ error, copy, onRetry }: { error: AdminOpsError; copy: AdminOperationsCopy; onRetry: () => void }) {
  const state = copy.errors[error.code] ?? copy.errors.ERROR
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <p className="font-medium text-foreground">{state.title}</p>
        <p className="leading-relaxed text-muted-foreground">{state.body}</p>
        {error.detail && (
          <p className="text-xs text-muted-foreground">
            {copy.unavailable.serverMessage}: {error.detail}
          </p>
        )}
      </div>
      {error.code === 'ERROR' && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {copy.retry}
        </Button>
      )}
    </div>
  )
}
