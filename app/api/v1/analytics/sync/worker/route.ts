import { NextResponse } from 'next/server'
import { isAnalyticsIngestionEnabled } from '@/config/analytics-backend'
import { runAnalyticsIngestionWorkerBatch } from '@/lib/platform/analytics/ingestion/worker-batch'

export async function POST() {
  if (!isAnalyticsIngestionEnabled()) {
    return NextResponse.json(
      { code: 'ANALYTICS_DISABLED', message: 'Analytics ingestion worker is disabled' },
      { status: 503 },
    )
  }
  const result = await runAnalyticsIngestionWorkerBatch()
  return NextResponse.json({
    ok: true,
    processed: result.processed,
    outcomes: result.outcomes,
  })
}
