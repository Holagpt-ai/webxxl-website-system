'use client'

import { useId, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { selectClass } from '@/components/ai-employees/ui'
import type { AnalyticsFilters } from '@/lib/analytics-ui/client'
import {
  MAX_RANGE_DAYS,
  RANGE_PRESETS,
  type RangePreset,
  formatUtcDay,
  presetRange,
  spanDays,
  todayUtc,
  validateRange,
} from '@/lib/analytics-ui/range'
import { fill } from '@/lib/commerce-ui/format'
import type { AnalyticsCopy } from '@/lib/i18n/dictionaries/analytics-en'

export type SiteOption = { id: string; name: string; domain: string | null }
export type RangeChoice = RangePreset | 'custom'

export function AnalyticsFiltersBar({
  filters,
  choice,
  sites,
  locale,
  copy,
  onChange,
}: {
  filters: AnalyticsFilters
  choice: RangeChoice
  sites: SiteOption[]
  locale: string
  copy: AnalyticsCopy
  onChange: (filters: AnalyticsFilters, choice: RangeChoice) => void
}) {
  const ids = useId()
  const [draftStart, setDraftStart] = useState(filters.start)
  const [draftEnd, setDraftEnd] = useState(filters.end)
  const [showCustom, setShowCustom] = useState(choice === 'custom')
  const issue = showCustom ? validateRange(draftStart, draftEnd) : null
  const days = spanDays(filters.start, filters.end) ?? 0
  const longDay = { year: 'numeric', month: 'short', day: 'numeric' } as const

  function selectRange(value: string) {
    if (value === 'custom') {
      setShowCustom(true)
      setDraftStart(filters.start)
      setDraftEnd(filters.end)
      return
    }
    setShowCustom(false)
    const preset = Number(value) as RangePreset
    onChange({ ...filters, ...presetRange(preset) }, preset)
  }

  function applyCustom(event: React.FormEvent) {
    event.preventDefault()
    if (validateRange(draftStart, draftEnd)) return
    onChange({ ...filters, start: draftStart, end: draftEnd }, 'custom')
  }

  return (
    <div role="group" aria-label={copy.filters.groupLabel} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-col gap-1.5 md:w-52">
          <label htmlFor={`${ids}-range`} className="text-xs font-medium text-muted-foreground">
            {copy.filters.dateRange}
          </label>
          <select
            id={`${ids}-range`}
            className={selectClass}
            value={showCustom ? 'custom' : String(choice)}
            onChange={(e) => selectRange(e.target.value)}
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {copy.filters.presets[p]}
              </option>
            ))}
            <option value="custom">{copy.filters.custom}</option>
          </select>
        </div>

        {sites.length > 0 && (
          <div className="flex flex-col gap-1.5 md:w-64">
            <label htmlFor={`${ids}-site`} className="text-xs font-medium text-muted-foreground">
              {copy.filters.site}
            </label>
            <select
              id={`${ids}-site`}
              className={selectClass}
              value={filters.siteId}
              disabled={sites.length === 1}
              onChange={(e) => onChange({ ...filters, siteId: e.target.value }, choice)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain ? `${s.name} (${s.domain})` : s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground md:ml-auto md:pb-2">
          <CalendarRange className="size-4" aria-hidden="true" />
          <span>
            {fill(copy.filters.period, {
              start: formatUtcDay(filters.start, locale, longDay),
              end: formatUtcDay(filters.end, locale, longDay),
              days,
            })}
          </span>
          <span className="sr-only">{copy.filters.utcNote}</span>
          <span aria-hidden="true" className="text-xs">
            UTC
          </span>
        </p>
      </div>

      {showCustom && (
        <form onSubmit={applyCustom} className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-start`} className="text-xs font-medium text-muted-foreground">
              {copy.filters.start}
            </label>
            <Input
              id={`${ids}-start`}
              type="date"
              value={draftStart}
              max={todayUtc()}
              onChange={(e) => setDraftStart(e.target.value)}
              aria-invalid={issue ? true : undefined}
              aria-describedby={issue ? `${ids}-issue` : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-end`} className="text-xs font-medium text-muted-foreground">
              {copy.filters.end}
            </label>
            <Input
              id={`${ids}-end`}
              type="date"
              value={draftEnd}
              max={todayUtc()}
              onChange={(e) => setDraftEnd(e.target.value)}
              aria-invalid={issue ? true : undefined}
              aria-describedby={issue ? `${ids}-issue` : undefined}
            />
          </div>
          <Button type="submit" disabled={Boolean(issue)}>
            {copy.filters.apply}
          </Button>
          {issue && (
            <p id={`${ids}-issue`} role="alert" className="text-sm text-destructive sm:pb-2">
              {fill(copy.filters.rangeIssues[issue], { max: MAX_RANGE_DAYS })}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
