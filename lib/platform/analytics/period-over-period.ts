import type { AnalyticsPeriodChangeDto } from '@/lib/platform/analytics/dto'
import type { AnalyticsFreshnessState } from '@/lib/platform/analytics/types'

export function computePeriodChange(input: {
  metric: string
  current: number | null
  previous: number | null
  dataState: AnalyticsFreshnessState
  note?: string
}): AnalyticsPeriodChangeDto {
  const { current, previous } = input
  let absoluteChange: number | null = null
  let percentChange: number | null = null
  if (current != null && previous != null) {
    absoluteChange = current - previous
    if (previous !== 0) percentChange = (absoluteChange / previous) * 100
  }
  return {
    metric: input.metric,
    current,
    previous,
    absoluteChange,
    percentChange,
    dataState: input.dataState,
    note: input.note,
  }
}
