'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingRows, WorkspaceState } from '@/components/crm/workspace-kit'
import { fill, formatDateTime, withQuery, workspaceGet, type WorkspaceError } from '@/lib/crm-ui/workspace'
import { localizePath } from '@/lib/i18n/localize'
import type { BusinessViewProps } from '@/lib/business-ui/server'
import {
  BUSINESS_API,
  BUSINESS_MODULES,
  isBusinessModule,
  snapshotFor,
  type BusinessModule,
  type BusinessOverviewResponse,
} from '@/lib/business-ui/types'
import { ModuleCard } from './module-card'
import { ActionList, type ModuleFilter } from './action-list'

/** Remounting per account drops filters and any previous account's cached view. */
export function BusinessCommandCenter(props: BusinessViewProps) {
  return <CommandCenterBody key={props.accountId} {...props} />
}

function CommandCenterBody({ accountId, locale, copy }: BusinessViewProps) {
  // The session account is sent so the API rejects the request if the active account changed elsewhere.
  const url = withQuery(BUSINESS_API.overview, { customerAccountId: accountId })
  const { data, error, isLoading, isValidating, mutate } = useSWR<BusinessOverviewResponse, WorkspaceError>(
    ['business-overview', accountId, url],
    ([, , path]: [string, string, string]) => workspaceGet<BusinessOverviewResponse>(path),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )

  const [filter, setFilter] = useState<ModuleFilter>('all')
  const [highOnly, setHighOnly] = useState(false)
  const actionsRef = useRef<HTMLElement>(null)

  const overview = data?.overview && data.overview.customerAccountId === accountId ? data.overview : null
  const actions = useMemo(
    () => (overview?.actions ?? []).filter((a) => isBusinessModule(a.module) && a.customerAccountId === accountId),
    [overview, accountId],
  )
  const counts = useMemo(() => {
    const c = Object.fromEntries(BUSINESS_MODULES.map((m) => [m, 0])) as Record<BusinessModule, number>
    for (const a of actions) c[a.module] += 1
    return c
  }, [actions])

  const showInList = (module: BusinessModule) => {
    setFilter(module)
    setHighOnly(false)
    actionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    actionsRef.current?.focus({ preventScroll: true })
  }

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {copy.distinction}{' '}
        <Link href={localizePath(locale, '/dashboard')} className="font-medium text-primary underline-offset-4 hover:underline">
          {copy.dashboardLink}
        </Link>
      </p>
      <div className="flex items-center gap-3">
        {overview && (
          <p className="text-xs text-muted-foreground">
            <time dateTime={overview.generatedAt}>{fill(copy.generatedAt, { time: formatDateTime(overview.generatedAt, locale) })}</time>
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
          <RefreshCw className={isValidating ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          {isValidating ? copy.refreshing : copy.refresh}
        </Button>
      </div>
    </div>
  )

  if (error && !overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <WorkspaceState error={error} kit={copy.kit} workspace={copy.name} onRetry={() => mutate()} />
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BUSINESS_MODULES.map((m) => (
            <div key={m} className="h-44 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
          ))}
        </div>
        <LoadingRows rows={4} label={copy.loading} />
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="status" className="rounded-xl border border-dashed bg-muted p-6 text-sm text-muted-foreground">
          {copy.staleAccount}
        </p>
      </div>
    )
  }

  const snapshots = BUSINESS_MODULES.map((m) => snapshotFor(overview.modules ?? [], m))
  const notReporting = snapshots.filter((s) => s.readiness.state !== 'available').map((s) => copy.modules[s.module].name)

  return (
    <div className="flex flex-col gap-10">
      {header}

      <section aria-labelledby="business-modules-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="business-modules-title" className="text-lg font-semibold text-foreground">
            {copy.modulesTitle}
          </h2>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">{copy.modulesDescription}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {snapshots.map((snapshot) => (
            <ModuleCard
              key={snapshot.module}
              snapshot={snapshot}
              listCount={counts[snapshot.module]}
              locale={locale}
              copy={copy}
              onShowInList={showInList}
            />
          ))}
        </div>
      </section>

      <ActionList
        ref={actionsRef}
        actions={actions}
        counts={counts}
        filter={filter}
        highOnly={highOnly}
        onFilter={setFilter}
        onHighOnly={setHighOnly}
        limits={overview.limits}
        notReporting={notReporting}
        locale={locale}
        copy={copy}
      />
    </div>
  )
}
