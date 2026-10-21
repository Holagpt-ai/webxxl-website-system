import { NextResponse } from 'next/server'
import { isAnalyticsIngestionEnabled } from '@/config/analytics-backend'

export async function POST() {
  if (!isAnalyticsIngestionEnabled()) {
    return NextResponse.json(
      { code: 'ANALYTICS_DISABLED', message: 'Analytics ingestion worker is disabled' },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      code: 'NOT_CONFIGURED',
      message: 'Analytics ingestion worker is enabled but no scheduled sync runner is configured in BATCH-14',
    },
    { status: 503 },
  )
}
