import { describe, expect, it } from 'vitest'
import { formatDay } from '@/lib/local-seo-ui/format'
import { mergeGscLimitationMessages } from '@/lib/local-seo-ui/limitations'
import type { GscPerformance } from '@/lib/local-seo-ui/types'

describe('Batch 19C Local SEO UI integration', () => {
  it('merges gsc completeness and response limitations without duplicates', () => {
    const gsc: GscPerformance = {
      dataState: 'READY',
      clicks: 1,
      impressions: 2,
      ctr: 0.5,
      averagePosition: 3,
      completeness: {
        rowCount: 10,
        dedupedRowCount: 8,
        distinctDates: 3,
        aggregationMethod: 'query_page_date_deduped_sum',
        limitations: ['Totals sum query×page×day rows', 'Some rows marked partial or stale'],
      },
    }
    const merged = mergeGscLimitationMessages(gsc, [
      'Keyword rows are associated with the managed site and snapshot window',
      'Totals sum query×page×day rows',
    ])
    expect(merged).toHaveLength(3)
    expect(merged.some((l) => l.includes('snapshot'))).toBe(true)
    expect(merged.filter((l) => l.startsWith('Totals')).length).toBe(1)
  })

  it('formats GSC calendar days in UTC without local timezone shift', () => {
    const en = formatDay('2026-10-05', 'en')
    const es = formatDay('2026-10-05', 'es')
    expect(en).toMatch(/2026/)
    expect(en).toMatch(/5/)
    expect(es.length).toBeGreaterThan(0)
    expect(formatDay('2026-10-05T12:00:00.000Z', 'en')).toBe(en)
  })
})
