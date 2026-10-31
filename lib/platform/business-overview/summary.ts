import type { BusinessSummaryMetric } from '@/lib/platform/business-overview/types'

export function accountTotal(value: number): BusinessSummaryMetric {
  return { value, scope: 'account_total' }
}

export function boundedSample(value: number): BusinessSummaryMetric {
  return { value, scope: 'bounded_sample' }
}

export function sumAccountTotals(summary: Record<string, BusinessSummaryMetric>): number {
  return Object.values(summary)
    .filter((m) => m.scope === 'account_total')
    .reduce((sum, m) => sum + m.value, 0)
}
