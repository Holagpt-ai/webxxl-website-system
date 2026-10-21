'use client'

import { useRef, useState } from 'react'
import { useAnalyticsProperties, type AnalyticsFilters } from '@/lib/analytics-ui/client'
import { presetRange } from '@/lib/analytics-ui/range'
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

const TABS = ['overview', 'traffic', 'search', 'local', 'conversions', 'connections'] as const
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
  const [tab, setTab] = useState<TabKey>('overview')
  const [choice, setChoice] = useState<RangeChoice>(28)
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({ ...presetRange(28), siteId: sites[0]?.id ?? '' }))
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Properties is the lightest guarded endpoint; it surfaces account-wide gates (disabled, forbidden, entitlement) once.
  const gate = useAnalyticsProperties(accountId, filters, true)
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
        }}
      />

      <div
        role="tablist"
        aria-label={copy.tablistLabel}
        onKeyDown={onTabKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
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
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
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
