'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAnalyticsProperties, useAnalyticsSyncStatus, type AnalyticsFilters } from '@/lib/analytics-ui/client'
import { analyticsFiltersFromSearchParams, analyticsSearchParamsFromState, type AnalyticsTabKey } from '@/lib/analytics-ui/deep-link'
import { fill } from '@/lib/commerce-ui/format'
import { spanDays } from '@/lib/analytics-ui/range'
import type { AnalyticsCopy } from '@/lib/i18n/dictionaries/analytics-en'
import { cn } from '@/lib/utils'
import { AnalyticsFiltersBar, type RangeChoice, type SiteOption } from '@/components/analytics/filters'
import { AnalyticsState, GATE_CODES, type TabProps } from '@/components/analytics/ui'
import { OverviewTab } from '@/components/analytics/overview-tab'
import { TrafficTab } from '@/components/analytics/traffic-tab'
import { SearchTab } from '@/components/analytics/search-tab'
import { LocalTab } from '@/components/analytics/local-tab'
import { ConversionsTab } from '@/components/analytics/conversions-tab'
import { ConnectionsTab } from '@/components/analytics/connections-tab'

const TABS = ['overview', 'traffic', 'search', 'local', 'conversions', 'connections'] as const satisfies readonly AnalyticsTabKey[]
type TabKey = (typeof TABS)[number]

const PANELS: Record<TabKey, (props: TabProps & { sites: SiteOption[] }) => React.ReactNode> = {
  overview: OverviewTab,
  traffic: TrafficTab,
  search: SearchTab,
  local: LocalTab,
  conversions: ConversionsTab,
  connections: ConnectionsTab,
}

export function AnalyticsView({
  accountId,
  sites,
  locale,
  copy,
  loginHref,
}: {
  accountId: string
  sites: SiteOption[]
  locale: string
  copy: AnalyticsCopy
  loginHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const defaultSite = sites[0]?.id ?? ''
  const initial = analyticsFiltersFromSearchParams(search, defaultSite)
  const [tab, setTab] = useState<TabKey>(initial.tab)
  const [choice, setChoice] = useState<RangeChoice>(initial.rangeChoice)
  const [filters, setFilters] = useState<AnalyticsFilters>(initial.filters)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    const parsed = analyticsFiltersFromSearchParams(search, defaultSite)
    setTab(parsed.tab)
    setChoice(parsed.rangeChoice)
    setFilters(parsed.filters)
  }, [search, defaultSite])

  function syncUrl(nextFilters: AnalyticsFilters, nextTab: TabKey, nextChoice: RangeChoice) {
    const rangeChoice = typeof nextChoice === 'number' ? nextChoice : 28
    const qs = analyticsSearchParamsFromState({ filters: nextFilters, tab: nextTab, rangeChoice }).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Properties is the lightest guarded endpoint; it surfaces account-wide gates (disabled, forbidden, entitlement) once.
  const gate = useAnalyticsProperties(accountId, filters, true)
  const sync = useAnalyticsSyncStatus(accountId, filters)
  if (gate.error && GATE_CODES.includes(gate.error.code)) {
    return <AnalyticsState error={gate.error} copy={copy} loginHref={loginHref} />
  }

  function onTabKeyDown(event: React.KeyboardEvent) {
    const index = TABS.indexOf(tab)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = TABS.length - 1
    if (next == null) return
    event.preventDefault()
    const key = TABS[next]!
    setTab(key)
    syncUrl(filters, key, choice)
    tabRefs.current[key]?.focus()
  }

  const Panel = PANELS[tab]

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsFiltersBar
        filters={filters}
        choice={choice}
        sites={sites}
        locale={locale}
        copy={copy}
        onChange={(next, nextChoice) => {
          setFilters(next)
          setChoice(nextChoice)
          syncUrl(next, tab, nextChoice)
        }}
      />

      <p className="text-pretty text-xs leading-relaxed text-muted-foreground" role="note">
        {fill(copy.filters.period, {
          start: filters.start,
          end: filters.end,
          days: String(spanDays(filters.start, filters.end) ?? '—'),
        })}{' '}
        · {copy.filters.utcNote}
        {sync.data && (
          <>
            {' '}
            · {copy.connections.title}: {sync.data.dataState}
          </>
        )}
      </p>

      <div
        role="tablist"
        aria-label={copy.tablistLabel}
        onKeyDown={onTabKeyDown}
        className="-mx-1 flex snap-x gap-1 overflow-x-auto border-b px-1 [scrollbar-width:thin]"
      >
        {TABS.map((key) => {
          const selected = key === tab
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[key] = el
              }}
              id={`analytics-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`analytics-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setTab(key)
                syncUrl(filters, key, choice)
              }}
              className={cn(
                '-mb-px inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                selected
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {copy.tabs[key]}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`analytics-panel-${tab}`}
        aria-labelledby={`analytics-tab-${tab}`}
        tabIndex={0}
        className="flex flex-col gap-6 outline-none"
      >
        <Panel accountId={accountId} filters={filters} locale={locale} copy={copy} loginHref={loginHref} sites={sites} />
      </div>
    </div>
  )
}
