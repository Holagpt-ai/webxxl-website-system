import type { SeoFreshnessState } from '@/lib/platform/seo/types'

export type LocalRankObservationContract = {
  keyword: string
  searchSurface: 'ORGANIC_SERP' | 'MAPS_LOCAL_PACK' | 'GBP_PERFORMANCE' | 'GSC_AVERAGE_POSITION'
  rankPosition: number | null
  dataState: SeoFreshnessState
  limitations: string[]
}

export function localRankWhenProviderDisconnected(): LocalRankObservationContract {
  return {
    keyword: '',
    searchSurface: 'ORGANIC_SERP',
    rankPosition: null,
    dataState: 'NOT_CONNECTED',
    limitations: ['No rank provider connected; rank grids are not synthesized.'],
  }
}
