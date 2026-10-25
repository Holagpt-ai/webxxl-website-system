import { isAnalyticsIngestionEnabled } from '@/config/analytics-backend'
import { verifyAutomationWorkerRequest } from '@/lib/automation/worker-auth'
import { runAnalyticsIngestionWorkerBatch } from '@/lib/platform/analytics/ingestion/worker-batch'

export type AnalyticsSyncWorkerResponse =
  | { status: 503; body: { code: string; message: string } }
  | { status: 401; body: { code: string; message: string } }
  | { status: 200; body: { ok: true; processed: number; outcomes: unknown[] } }

export async function handleAnalyticsSyncWorkerRequest(headers: Headers): Promise<AnalyticsSyncWorkerResponse> {
  if (!isAnalyticsIngestionEnabled()) {
    return {
      status: 503,
      body: { code: 'ANALYTICS_DISABLED', message: 'Analytics ingestion worker is disabled' },
    }
  }
  if (!verifyAutomationWorkerRequest(headers)) {
    return {
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Invalid or missing worker authorization' },
    }
  }
  const result = await runAnalyticsIngestionWorkerBatch()
  return {
    status: 200,
    body: { ok: true, processed: result.processed, outcomes: result.outcomes },
  }
}
