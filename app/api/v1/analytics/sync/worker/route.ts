import { NextResponse } from 'next/server'
import { handleAnalyticsSyncWorkerRequest } from '@/lib/platform/analytics/ingestion/sync-worker-handler'

export async function POST(request: Request) {
  const result = await handleAnalyticsSyncWorkerRequest(request.headers)
  return NextResponse.json(result.body, { status: result.status })
}
