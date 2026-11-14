import { describe, expect, it } from 'vitest'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { analyticsFiltersFromSearchParams, analyticsSearchParamsFromState } from '@/lib/analytics-ui/deep-link'

describe('Batch 9C — Business Center destinations', () => {
  it('scopes SEO opportunities by site and opportunity id', () => {
    expect(BUSINESS_DESTINATIONS.seoOpportunity('site_a', 'opp_1')).toBe(
      '/dashboard/seo/opportunities?site=site_a&opportunityId=opp_1',
    )
  })

  it('routes communications inbox setup to the mapped inbox', () => {
    expect(BUSINESS_DESTINATIONS.commsInboxForInbox('inbox_9')).toBe('/dashboard/communications?inbox=inbox_9')
  })

  it('routes social campaigns awaiting approval to schedule preparation', () => {
    expect(BUSINESS_DESTINATIONS.marketingCampaignSchedulePrep('camp_1')).toBe(
      '/dashboard/marketing/campaigns/camp_1?prepare=schedule',
    )
  })

  it('deep-links AI employees by id', () => {
    expect(BUSINESS_DESTINATIONS.aiEmployee('emp_1')).toBe('/dashboard/ai-employees?tab=employees&employeeId=emp_1')
  })
})

describe('Batch 9C — Analytics URL state', () => {
  it('round-trips tab, site, and range in query params', () => {
    const params = new URLSearchParams('site=site_x&tab=traffic&range=90&start=2026-01-01&end=2026-03-31')
    const parsed = analyticsFiltersFromSearchParams(params, 'default_site')
    expect(parsed.tab).toBe('traffic')
    expect(parsed.rangeChoice).toBe(90)
    expect(parsed.filters.siteId).toBe('site_x')
    const back = analyticsSearchParamsFromState({
      filters: parsed.filters,
      tab: parsed.tab,
      rangeChoice: parsed.rangeChoice,
    })
    expect(back.get('tab')).toBe('traffic')
    expect(back.get('site')).toBe('site_x')
    expect(back.get('range')).toBe('90')
  })
})