import { presetRange, validateRange, type RangePreset, RANGE_PRESETS } from '@/lib/analytics-ui/range'
import type { AnalyticsFilters } from '@/lib/analytics-ui/client'

const TABS = ['overview', 'traffic', 'search', 'local', 'conversions', 'connections'] as const
export type AnalyticsTabKey = (typeof TABS)[number]

function parseRangeDays(value: string | null): RangePreset | null {
  if (!value) return null
  const days = Number(value)
  return RANGE_PRESETS.includes(days as RangePreset) ? (days as RangePreset) : null
}

export function analyticsFiltersFromSearchParams(
  search: URLSearchParams,
  defaultSiteId: string,
): { filters: AnalyticsFilters; tab: AnalyticsTabKey; rangeChoice: RangePreset } {
  const rangeChoice = parseRangeDays(search.get('range')) ?? 28
  const preset = presetRange(rangeChoice)
  const start = search.get('start') ?? preset.start
  const end = search.get('end') ?? preset.end
  const issue = validateRange(start, end)
  const safe = issue ? presetRange(rangeChoice) : { start, end }
  const tabRaw = search.get('tab')
  const tab = TABS.includes(tabRaw as AnalyticsTabKey) ? (tabRaw as AnalyticsTabKey) : 'overview'
  const siteId = search.get('site') ?? defaultSiteId
  return {
    filters: { ...safe, siteId },
    tab,
    rangeChoice,
  }
}

export function analyticsSearchParamsFromState(input: {
  filters: AnalyticsFilters
  tab: AnalyticsTabKey
  rangeChoice: RangePreset
}): URLSearchParams {
  const params = new URLSearchParams()
  if (input.filters.siteId) params.set('site', input.filters.siteId)
  params.set('tab', input.tab)
  params.set('range', String(input.rangeChoice))
  params.set('start', input.filters.start)
  params.set('end', input.filters.end)
  return params
}