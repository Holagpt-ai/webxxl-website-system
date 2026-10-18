export type GscSearchAnalyticsRow = {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscSearchAnalyticsResponse = {
  rows?: GscSearchAnalyticsRow[]
  responseAggregationType?: string
}

export type GscSearchAnalyticsRequest = {
  startDate: string
  endDate: string
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[]
  rowLimit?: number
  startRow?: number
  dimensionFilterGroups?: unknown[]
}

export type GscNormalizedRow = {
  query?: string
  page?: string
  country?: string
  device?: string
  date?: string
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  metricSemantics: {
    positionIsAverage: true
    ctrIsRatio: true
    missingRowIsNotZero: true
  }
}

export type GscNormalizedReport = {
  propertyRef: string
  startDate: string
  endDate: string
  rows: GscNormalizedRow[]
  dataState: 'READY' | 'PARTIAL' | 'NOT_CONNECTED'
  sourceCompleteness: { rowCount: number; aggregationType?: string }
  observedAt: string
}
